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
    "activation pending": "open",
    "activated": "completed",
    "cust cancelled": "closed",
    "closed": "closed",
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

// Generate daily ticket number: NH360-YYYYMMDD-###
async function generateTicketNo(conn: PoolConnection): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}${mm}${dd}`;

  const [rows] = await conn.query(
    "SELECT COUNT(*) AS count FROM tickets_nh WHERE DATE(created_at) = CURDATE()"
  );
  // @ts-ignore - RowDataPacket
  const todayCount = rows?.[0]?.count ?? 0;
  const seq = String(todayCount + 1).padStart(3, "0");
  return `NH360-${todayStr}-${seq}`;
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
  ctx: { params: { id: string } }
) {
  try {
    const { id } = ctx.params;
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
  ctx: { params: { id: string } }
) {
  const conn = await pool.getConnection();
  try {
    const { id } = ctx.params;
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

    const hasCommissionColumn = await hasTableColumn(TICKETS_TABLE, "commission_amount", conn);
    const hasFastagSerialColumn = await hasTableColumn(TICKETS_TABLE, "fastag_serial", conn);

    const ticket_no = await generateTicketNo(conn);

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
    columns.push("pickup_point_name");
    placeholders.push("?");
    insertValues.push(body.pickup_point_name ?? null);

    if (hasFastagSerialColumn) {
      columns.push("fastag_serial");
      placeholders.push("?");
      insertValues.push(fastag_serial ?? null);
    }

    columns.push("parent_ticket_id");
    placeholders.push("?");
    insertValues.push(parentId);

    const insertQuery = `INSERT INTO ${TICKETS_TABLE} (${columns.join(", ")}, created_at, updated_at) VALUES (${placeholders.join(", ")}, NOW(), NOW())`;

    const [r]: any = await conn.query(insertQuery, insertValues);

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

    const newId = Number(r.insertId);

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

