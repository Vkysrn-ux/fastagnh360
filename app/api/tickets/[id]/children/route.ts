// app/api/tickets/[id]/children/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logTicketAction } from "@/lib/ticket-logs";
import { hasTableColumn } from "@/lib/db-helpers";
import type { PoolConnection } from "mysql2/promise";

const TICKETS_TABLE = "tickets_nh";

function normalizeIndianMobile(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  const m = s.match(/^(?:\+?91[\-\s]?|0)?([6-9]\d{9})$/);
  return m ? m[1] : null;
}

function normalizeStatus(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().toLowerCase();
  const map: Record<string, string> = {
    // Align with canonical app statuses used elsewhere
    "open": "open",
    "pending": "open",
    "activation pending": "open",
    "kyc pending": "open",
    "waiting": "open",
    "new lead": "open",

    "in progress": "in_progress",
    "in_progress": "in_progress",
    "working": "in_progress",

    "completed": "completed",
    "done": "completed",
    "activated": "completed",
    "resolved": "completed",

    "closed": "closed",
    "cancelled": "closed",
    "cust cancelled": "closed",
  };
  return map[s] || s || null;
}

function normalizeKyv(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().toLowerCase();
  const map: Record<string, string> = {
    "pending": "kyv_pending",
    "kyv pending": "kyv_pending",
    "kyv pending approval": "kyv_pending_approval",
    "kyv success": "kyv_success",
    "kyv hotlisted": "kyv_hotlisted",
  };
  return map[s] || s || null;
}

async function markFastagAsUsed(conn: PoolConnection, fastagSerial: string | null, vehicleRegNo?: string | null) {
  const serial = fastagSerial ? String(fastagSerial).trim() : "";
  if (!serial) return;

  try {
    const updates: string[] = ["status = 'sold'"];
    const values: (string | number | null)[] = [];

    if (await hasTableColumn('fastags', 'assigned_to', conn)) {
      updates.push("assigned_to = NULL");
    }
    if (await hasTableColumn('fastags', 'assigned_to_agent_id', conn)) {
      updates.push("assigned_to_agent_id = NULL");
    }

    const trimmedVehicle = vehicleRegNo ? String(vehicleRegNo).trim() : "";
    if (trimmedVehicle && await hasTableColumn('fastags', 'vehicle_reg_no', conn)) {
      updates.push("vehicle_reg_no = ?");
      values.push(trimmedVehicle);
    }

    const query = `UPDATE fastags SET ${updates.join(', ')} WHERE tag_serial = ? LIMIT 1`;
    values.push(serial);
    await conn.query(query, values);
  } catch (error) {
    console.error("Failed to update FASTag inventory for serial", serial, error);
  }
}

// Generate ticket number: TK-A0001 using next AUTO_INCREMENT
async function generateTicketNo(conn: PoolConnection): Promise<string> {
  try {
    const [rows]: any = await conn.query(
      `SELECT AUTO_INCREMENT AS nextId FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
      [TICKETS_TABLE]
    );
    const nextId = Number(rows?.[0]?.nextId || 1);
    const seq = String(nextId).padStart(4, '0');
    return `TK-A${seq}`;
  } catch {
    const [rows2]: any = await conn.query(`SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM ${TICKETS_TABLE}`);
    const nextId2 = Number(rows2?.[0]?.nextId || 1);
    const seq2 = String(nextId2).padStart(4, '0');
    return `TK-A${seq2}`;
  }
}

async function recordFastagSale(opts: {
  conn: PoolConnection;
  tagSerial: string | null | undefined;
  ticketId: number;
  vehicleRegNo?: string | null;
  assignedToUserId?: number | null;
  payment_to_collect?: number | null;
  payment_to_send?: number | null;
  net_value?: number | null;
  commission_amount?: number | null;
}) {
  const { conn } = opts;
  const serial = opts.tagSerial ? String(opts.tagSerial).trim() : "";
  if (!serial) return;
  try {
    const [rows]: any = await conn.query(
      `SELECT supplier_id, bank_name, fastag_class, assigned_to_agent_id FROM fastags WHERE tag_serial = ? LIMIT 1`,
      [serial]
    );
    const f = rows?.[0] || {};
    await conn.query(
      `INSERT INTO fastag_sales (
         tag_serial, ticket_id, vehicle_reg_no, bank_name, fastag_class, supplier_id,
         sold_by_user_id, sold_by_agent_id, payment_to_collect, payment_to_send, net_value,
         commission_amount, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        serial,
        opts.ticketId,
        opts.vehicleRegNo ?? null,
        f.bank_name ?? null,
        f.fastag_class ?? null,
        f.supplier_id ?? null,
        opts.assignedToUserId ?? null,
        f.assigned_to_agent_id ?? null,
        opts.payment_to_collect ?? null,
        opts.payment_to_send ?? null,
        opts.net_value ?? null,
        opts.commission_amount ?? null,
      ]
    );
  } catch {}
}

// GET: list all child sub-tickets for a parent ticket
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const parentId = Number(id);
    if (!Number.isFinite(parentId) || parentId <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [rows] = await pool.query(
      `
        SELECT t.*
        FROM tickets_nh t
        WHERE t.parent_ticket_id = ?
        ORDER BY t.created_at DESC
      `,
      [parentId]
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("GET /api/tickets/[id]/children error:", err);
    return NextResponse.json(
      {
        error: err?.message ?? "Failed to fetch child tickets",
        code: err?.code,
        errno: err?.errno,
        sqlMessage: err?.sqlMessage,
      },
      { status: 500 }
    );
  }
}

// POST: create one child sub-ticket under a parent
// Body: { subject: string, details?: string, ...optional overrides }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const conn = await pool.getConnection();
  try {
    const { id } = await ctx.params;
    const parentId = Number(id);
    if (!Number.isFinite(parentId) || parentId <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({} as any));
    const subject = String(body?.subject ?? "").trim();
    if (!subject) {
      return NextResponse.json({ error: "Subject required" }, { status: 400 });
    }

    // Pull parent (from tickets_nh) to inherit fields
    const [prow] = await pool.query(`SELECT * FROM tickets_nh WHERE id = ?`, [parentId]);
    // @ts-ignore - RowDataPacket
    const parent = (prow as any)?.[0];
    if (!parent) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }

    await conn.beginTransaction();

    // Ensure optional fields exist on tickets table (best-effort)
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'paid_via', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN paid_via VARCHAR(64) NOT NULL DEFAULT 'Pending'`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'rc_front_url', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN rc_front_url VARCHAR(255) NULL`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'rc_back_url', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN rc_back_url VARCHAR(255) NULL`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'pan_url', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN pan_url VARCHAR(255) NULL`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'aadhaar_front_url', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN aadhaar_front_url VARCHAR(255) NULL`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'aadhaar_back_url', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN aadhaar_back_url VARCHAR(255) NULL`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'vehicle_front_url', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN vehicle_front_url VARCHAR(255) NULL`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'vehicle_side_url', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN vehicle_side_url VARCHAR(255) NULL`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'sticker_pasted_url', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN sticker_pasted_url VARCHAR(255) NULL`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'fastag_bank', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN fastag_bank VARCHAR(64) NULL`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'fastag_class', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN fastag_class VARCHAR(32) NULL`); } catch {}
    try { const ok = await hasTableColumn(TICKETS_TABLE, 'fastag_owner', conn); if (!ok) await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN fastag_owner VARCHAR(64) NULL`); } catch {}

    const hasCommissionColumn = await hasTableColumn(TICKETS_TABLE, "commission_amount", conn);
    const hasFastagSerialColumn = await hasTableColumn(TICKETS_TABLE, "fastag_serial", conn);
    const hasPaidViaColumn = await hasTableColumn(TICKETS_TABLE, "paid_via", conn);
    const hasRcFront = await hasTableColumn(TICKETS_TABLE, 'rc_front_url', conn);
    const hasRcBack = await hasTableColumn(TICKETS_TABLE, 'rc_back_url', conn);
    const hasPan = await hasTableColumn(TICKETS_TABLE, 'pan_url', conn);
    const hasAadhaarFront = await hasTableColumn(TICKETS_TABLE, 'aadhaar_front_url', conn);
    const hasAadhaarBack = await hasTableColumn(TICKETS_TABLE, 'aadhaar_back_url', conn);
    const hasVehFront = await hasTableColumn(TICKETS_TABLE, 'vehicle_front_url', conn);
    const hasVehSide = await hasTableColumn(TICKETS_TABLE, 'vehicle_side_url', conn);
    const hasSticker = await hasTableColumn(TICKETS_TABLE, 'sticker_pasted_url', conn);
    const hasFastagBank = await hasTableColumn(TICKETS_TABLE, 'fastag_bank', conn);
    const hasFastagClass = await hasTableColumn(TICKETS_TABLE, 'fastag_class', conn);
    const hasFastagOwner = await hasTableColumn(TICKETS_TABLE, 'fastag_owner', conn);

    // Child ticket number: use parent ticket_no with incremental suffix -01, -02, ...
    let ticket_no: string;
    try {
      const base = String(parent.ticket_no || "").trim();
      if (!base) {
        ticket_no = await generateTicketNo(conn);
      } else {
        const [childNos]: any = await conn.query(
          `SELECT ticket_no FROM ${TICKETS_TABLE} WHERE parent_ticket_id = ?`,
          [parentId]
        );
        let maxSuffix = 0;
        for (const r of (Array.isArray(childNos) ? childNos : [])) {
          const tn = String(r.ticket_no || "");
          if (tn.startsWith(base + "-")) {
            const part = tn.slice((base + "-").length);
            const n = parseInt(part, 10);
            if (!isNaN(n) && n > maxSuffix) maxSuffix = n;
          }
        }
        const next = String(maxSuffix + 1).padStart(2, '0');
        ticket_no = `${base}-${next}`;
      }
    } catch {
      ticket_no = await generateTicketNo(conn);
    }

    // Inherit/override fields
    const vehicle_reg_no = body.vehicle_reg_no ?? parent.vehicle_reg_no ?? "";
    const details = body.details ?? "";
    const phone = normalizeIndianMobile(body.phone ?? parent.phone) ?? null;
    const alt_phone = normalizeIndianMobile(body.alt_phone ?? parent.alt_phone);
    const assigned_to = body.assigned_to ?? parent.assigned_to ?? null;
    const lead_received_from = body.lead_received_from ?? parent.lead_received_from ?? null;
    const lead_by = body.lead_by ?? parent.lead_by ?? null;
    const status = normalizeStatus(body.status) || "open";
    const kyv_status = normalizeKyv(body.kyv_status) || parent.kyv_status || null;
    const customer_name = body.customer_name ?? parent.customer_name ?? null;
    const comments = body.comments ?? null;
    const fastag_serial = body.fastag_serial ?? parent.fastag_serial ?? null;

    // derive payment values for this child
    const b_ptc_raw = body.payment_to_collect;
    const b_pts_raw = body.payment_to_send;
    const b_ptc = b_ptc_raw === undefined || b_ptc_raw === null ? null : Number(b_ptc_raw);
    const b_pts = b_pts_raw === undefined || b_pts_raw === null ? null : Number(b_pts_raw);
    const b_net =
      b_ptc === null && b_pts === null
        ? null
        : Number((((b_ptc ?? 0) + (b_pts ?? 0)).toFixed?.(2) ?? (b_ptc ?? 0) + (b_pts ?? 0)));

    const commissionRaw = body.commission_amount ?? parent.commission_amount ?? 0;
    const commissionValue =
      commissionRaw === undefined || commissionRaw === null ? 0 : Number(commissionRaw);

    // Normalize paid_via to allowed options and validate against payment_received
    const allowedPaidVia = new Set([
      'Pending',
      'Paytm QR',
      'GPay Box',
      'IDFC Box',
      'Cash',
      'Sriram Gpay',
      'Lakshman Gpay',
      'Arjunan Gpay',
      'Vishnu GPay',
      'Vimal GPay',
    ]);
    let paid_via: string = String(body.paid_via ?? parent.paid_via ?? 'Pending').trim();
    if (!allowedPaidVia.has(paid_via)) paid_via = 'Pending';
    if (body?.payment_received && paid_via === 'Pending') {
      await conn.rollback();
      return NextResponse.json({ error: "Paid via cannot be 'Pending' when Payment Received is checked." }, { status: 400 });
    }

    // Duplicate guard: do not allow creating a ticket with same phone + VRN
    try {
      const [dups]: any = await conn.query(
        `SELECT id, ticket_no, status, customer_name, created_at
           FROM ${TICKETS_TABLE}
          WHERE phone = ? AND UPPER(COALESCE(vehicle_reg_no,'')) = UPPER(?)
          ORDER BY created_at DESC
          LIMIT 10`,
        [phone, vehicle_reg_no]
      );
      if (Array.isArray(dups) && dups.length) {
        await conn.rollback();
        return NextResponse.json({
          error: 'Duplicate ticket exists for this phone and vehicle number',
          duplicates: dups,
        }, { status: 409 });
      }
    } catch {}

    const columns = [
      "ticket_no",
      "vehicle_reg_no",
      "subject",
      "details",
      "phone",
      "alt_phone",
      "assigned_to",
      "lead_received_from",
      "lead_by",
      "status",
      "kyv_status",
      "customer_name",
      "comments",
      "payment_to_collect",
      "payment_to_send",
      "net_value",
    ];
    const placeholders = Array(columns.length).fill("?");
    const insertValues: (string | number | null)[] = [
      ticket_no,
      vehicle_reg_no,
      subject,
      details,
      phone,
      alt_phone,
      assigned_to,
      lead_received_from,
      lead_by,
      status,
      kyv_status,
      customer_name,
      comments,
      isNaN(b_ptc as any) ? null : b_ptc,
      isNaN(b_pts as any) ? null : b_pts,
      isNaN(b_net as any) ? null : b_net,
    ];
    if (hasCommissionColumn) {
      columns.push("commission_amount");
      placeholders.push("?");
      insertValues.push(isNaN(commissionValue as any) ? 0 : commissionValue);
    }
    if (hasPaidViaColumn) {
      columns.push("paid_via");
      placeholders.push("?");
      insertValues.push(paid_via);
    }
    columns.push("pickup_point_name");
    placeholders.push("?");
    insertValues.push(body.pickup_point_name ?? null);

    if (hasFastagSerialColumn) {
      columns.push("fastag_serial");
      placeholders.push("?");
      insertValues.push(fastag_serial ?? null);
    }

    if (hasFastagBank) { columns.push('fastag_bank'); placeholders.push('?'); insertValues.push(body.fastag_bank ?? null); }
    if (hasFastagClass) { columns.push('fastag_class'); placeholders.push('?'); insertValues.push(body.fastag_class ?? null); }
    if (hasFastagOwner) { columns.push('fastag_owner'); placeholders.push('?'); insertValues.push(body.fastag_owner ?? null); }
    if (hasRcFront) { columns.push('rc_front_url'); placeholders.push('?'); insertValues.push(body.rc_front_url ?? null); }
    if (hasRcBack) { columns.push('rc_back_url'); placeholders.push('?'); insertValues.push(body.rc_back_url ?? null); }
    if (hasPan) { columns.push('pan_url'); placeholders.push('?'); insertValues.push(body.pan_url ?? null); }
    if (hasAadhaarFront) { columns.push('aadhaar_front_url'); placeholders.push('?'); insertValues.push(body.aadhaar_front_url ?? null); }
    if (hasAadhaarBack) { columns.push('aadhaar_back_url'); placeholders.push('?'); insertValues.push(body.aadhaar_back_url ?? null); }
    if (hasVehFront) { columns.push('vehicle_front_url'); placeholders.push('?'); insertValues.push(body.vehicle_front_url ?? null); }
    if (hasVehSide) { columns.push('vehicle_side_url'); placeholders.push('?'); insertValues.push(body.vehicle_side_url ?? null); }
    if (hasSticker) { columns.push('sticker_pasted_url'); placeholders.push('?'); insertValues.push(body.sticker_pasted_url ?? null); }

    columns.push("parent_ticket_id");
    placeholders.push("?");
    insertValues.push(parentId);

    const insertQuery = `INSERT INTO ${TICKETS_TABLE} (${columns.join(", ")}, created_at, updated_at) VALUES (${placeholders.join(", ")}, NOW(), NOW())`;

    const [r]: any = await conn.query(insertQuery, insertValues);
    const newId = Number(r.insertId);

    await markFastagAsUsed(conn, fastag_serial, vehicle_reg_no);
    await recordFastagSale({
      conn,
      tagSerial: fastag_serial,
      ticketId: newId,
      vehicleRegNo: vehicle_reg_no,
      assignedToUserId: assigned_to ? Number(assigned_to) : null,
      payment_to_collect: b_ptc,
      payment_to_send: b_pts,
      net_value: b_net,
      commission_amount: commissionValue,
    });

    await conn.commit();
    try {
      await logTicketAction({ ticketId: parentId, action: "create_child", req, meta: { id: newId, ticket_no } });
    } catch {}
    return NextResponse.json({ ok: true, id: newId, ticket_no }, { status: 201 });
  } catch (e: any) {
    await conn.rollback();
    console.error("POST /api/tickets/[id]/children error:", e);
    return NextResponse.json(
      {
        error: e?.message ?? "Failed to create child ticket",
        code: e?.code,
        errno: e?.errno,
        sqlMessage: e?.sqlMessage,
      },
      { status: 500 }
    );
  } finally {
    conn.release();
  }
}

