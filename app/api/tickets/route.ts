// app/api/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";
import type { PoolConnection } from "mysql2/promise";

const TICKETS_TABLE = "tickets_nh";

// --- utility: make a ticket_no like NH360-YYYYMMDD-###, inside a txn ---

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
  const todayCount = rows?.[0]?.count || 0;
  const seq = String(todayCount + 1).padStart(3, "0");
  return `NH360-${todayStr}-${seq}`;
}

// GET:
// - default: ONLY parent tickets (sub-tickets excluded)
// - ?parent_id=### -> only that parent's sub-tickets
// - optional ?scope=all -> all tickets (parents + subs)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get("parent_id");
  const scope = searchParams.get("scope");

  try {
    if (parentId) {
      // Children of one parent
      const [rows] = await pool.query(
        `
        SELECT
          t.id, t.ticket_no, t.subject, t.status, t.details, t.assigned_to,
          t.created_at, t.updated_at
        FROM tickets_nh t
        WHERE t.parent_ticket_id = ?
        ORDER BY t.created_at DESC
        `,
        [parentId]
      );
      return NextResponse.json(rows || []);
    }

    if (scope === "all") {
      const [rows] = await pool.query(`
        SELECT
          t.*,
          CASE
            WHEN t.lead_received_from = 'Shop' AND u.role = 'shop' THEN u.name
            ELSE NULL
          END AS shop_name
        FROM tickets_nh t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE COALESCE(t.status, '') <> 'draft'
        ORDER BY t.created_at DESC
      `);
      return NextResponse.json(rows || []);
    }

    // ROOTS ONLY (keep subs out of the main list)
    const [rows] = await pool.query(`
      SELECT
        t.*,
        CASE
          WHEN t.lead_received_from = 'Shop' AND u.role = 'shop' THEN u.name
          ELSE NULL
        END AS shop_name,
        COALESCE(s.cnt, 0) AS subs_count
      FROM tickets_nh t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN (
        SELECT parent_ticket_id, COUNT(*) AS cnt
        FROM tickets_nh
        WHERE parent_ticket_id IS NOT NULL
        GROUP BY parent_ticket_id
      ) s ON s.parent_ticket_id = t.id
      WHERE t.parent_ticket_id IS NULL
        AND COALESCE(t.status, '') <> 'draft'
      ORDER BY t.created_at DESC
    `);
    return NextResponse.json(rows || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST:
// 1) Create a single SUB-TICKET if body has parent_ticket_id.
// 2) Otherwise create a PARENT ticket (and optional sub_issues[]).
export async function POST(req: NextRequest) {
  const data = await req.json();

  const {
    // shared fields
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
    // payments (optional)
    payment_to_collect,
    payment_to_send,
    net_value,
    // pickup point (optional)
    pickup_point_name,
    fastag_serial,
    commission_amount,

    // for single sub-ticket creation
    parent_ticket_id,

    // for parent + many children creation
    sub_issues = [],
  } = data || {};

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const hasCommissionColumn = await hasTableColumn(TICKETS_TABLE, "commission_amount", conn);
    const hasFastagSerialColumn = await hasTableColumn(TICKETS_TABLE, "fastag_serial", conn);

    // --- CASE A: create only a sub-ticket (no new parent) ---
    if (parent_ticket_id) {
      const childTicketNo = await generateTicketNo(conn);

      if (!subject || !String(subject).trim()) {
        throw new Error("Subject is required for sub-ticket");
      }

      // Load parent to inherit missing fields
      const [prow] = await conn.query(`SELECT * FROM ${TICKETS_TABLE} WHERE id = ?`, [parent_ticket_id]);
      // @ts-ignore RowDataPacket
      const parent: any = (prow as any)?.[0] || {};

      const effectiveFastagSerial = (typeof fastag_serial !== "undefined" ? fastag_serial : null) ?? parent.fastag_serial ?? null;

      // derive payment values for this sub-ticket
      const c_ptc_raw = payment_to_collect;
      const c_pts_raw = payment_to_send;
      const c_ptc = c_ptc_raw === undefined || c_ptc_raw === null ? null : Number(c_ptc_raw);
      const c_pts = c_pts_raw === undefined || c_pts_raw === null ? null : Number(c_pts_raw);
      const c_net =
        c_ptc === null && c_pts === null
          ? null
          : Number((((c_ptc ?? 0) + (c_pts ?? 0)).toFixed?.(2) ?? (c_ptc ?? 0) + (c_pts ?? 0)));

      const childCommissionRaw = commission_amount ?? parent.commission_amount ?? 0;
      const childCommission =
        childCommissionRaw === undefined || childCommissionRaw === null
          ? 0
          : Number(childCommissionRaw);

      const effectiveVehicle = (typeof vehicle_reg_no !== "undefined" ? vehicle_reg_no : null) ?? parent.vehicle_reg_no ?? "";
      const effectivePhone = (typeof phone !== "undefined" ? phone : null) ?? parent.phone ?? "";
      const effectiveAltPhone = (typeof alt_phone !== "undefined" ? alt_phone : null) ?? parent.alt_phone ?? null;
      const effectiveAssignedTo = (typeof assigned_to !== "undefined" ? assigned_to : null) ?? parent.assigned_to ?? null;
      const effectiveLeadFrom = (typeof lead_received_from !== "undefined" ? lead_received_from : null) ?? parent.lead_received_from ?? null;
      const effectiveLeadBy = (typeof lead_by !== "undefined" ? lead_by : null) ?? parent.lead_by ?? null;
      const effectiveStatus = (typeof status !== "undefined" ? status : null) ?? "open";
      const effectiveKyvStatus = (typeof kyv_status !== "undefined" ? kyv_status : null) ?? parent.kyv_status ?? null;
      const effectiveCustomer = (typeof customer_name !== "undefined" ? customer_name : null) ?? parent.customer_name ?? null;
      const effectiveComments = (typeof comments !== "undefined" ? comments : null) ?? null;

      const childColumns = [
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
      const childPlaceholders = Array(childColumns.length).fill("?");
      const childValues: (string | number | null)[] = [
        childTicketNo,
        effectiveVehicle,
        subject,
        details ?? "",
        effectivePhone,
        effectiveAltPhone,
        effectiveAssignedTo,
        effectiveLeadFrom,
        effectiveLeadBy,
        effectiveStatus,
        effectiveKyvStatus,
        effectiveCustomer,
        effectiveComments,
        isNaN(c_ptc as any) ? null : c_ptc,
        isNaN(c_pts as any) ? null : c_pts,
        isNaN(c_net as any) ? null : c_net,
      ];

      if (hasCommissionColumn) {
        childColumns.push("commission_amount");
        childPlaceholders.push("?");
        childValues.push(isNaN(childCommission as any) ? 0 : childCommission);
      }

      childColumns.push("pickup_point_name");
      childPlaceholders.push("?");
      childValues.push(pickup_point_name ?? null);

      if (hasFastagSerialColumn) {
        childColumns.push("fastag_serial");
        childPlaceholders.push("?");
        childValues.push(effectiveFastagSerial ?? null);
      }

      childColumns.push("parent_ticket_id");
      childPlaceholders.push("?");
      childValues.push(parent_ticket_id);

      const childInsert = `INSERT INTO ${TICKETS_TABLE} (${childColumns.join(", ")}, created_at, updated_at) VALUES (${childPlaceholders.join(", ")}, NOW(), NOW())`;

      const [r]: any = await conn.query(childInsert, childValues);

      await markFastagAsUsed(conn, effectiveFastagSerial, effectiveVehicle);

      await conn.commit();
      try {
        await logTicketAction({ ticketId: Number(r.insertId), action: "create_child", req, meta: { child_ticket_no: childTicketNo } });
      } catch {}
      return NextResponse.json({
        ok: true,
        mode: "sub_only",
        parent_id: parent_ticket_id,
        child_id: r.insertId,
        child_ticket_no: childTicketNo,
      });
    }

    // --- CASE B: create parent (+ optional batch of sub_issues) ---
    const ticket_no_parent = await generateTicketNo(conn);
    // derive payment values for the parent ticket
    const p_ptc_raw = payment_to_collect;
    const p_pts_raw = payment_to_send;
    const p_ptc = p_ptc_raw === undefined || p_ptc_raw === null ? null : Number(p_ptc_raw);
    const p_pts = p_pts_raw === undefined || p_pts_raw === null ? null : Number(p_pts_raw);
    const p_net =
      p_ptc === null && p_pts === null
        ? null
        : Number((((p_ptc ?? 0) + (p_pts ?? 0)).toFixed?.(2) ?? (p_ptc ?? 0) + (p_pts ?? 0)));

    const parentCommissionRaw = commission_amount ?? 0;
    const parentCommission =
      parentCommissionRaw === undefined || parentCommissionRaw === null
        ? 0
        : Number(parentCommissionRaw);

    const parentColumns = [
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
    const parentPlaceholders = Array(parentColumns.length).fill("?");
    const parentValues: (string | number | null)[] = [
      ticket_no_parent,
      vehicle_reg_no ?? "",
      subject ?? "",
      details ?? "",
      phone ?? "",
      alt_phone ?? null,
      assigned_to ?? null,
      lead_received_from ?? null,
      lead_by ?? null,
      status ?? "open",
      kyv_status ?? null,
      customer_name ?? null,
      comments ?? null,
      isNaN(p_ptc as any) ? null : p_ptc,
      isNaN(p_pts as any) ? null : p_pts,
      isNaN(p_net as any) ? null : p_net,
    ];
    if (hasCommissionColumn) {
      parentColumns.push("commission_amount");
      parentPlaceholders.push("?");
      parentValues.push(isNaN(parentCommission as any) ? 0 : parentCommission);
    }
    parentColumns.push("pickup_point_name");
    parentPlaceholders.push("?");
    parentValues.push(pickup_point_name ?? null);

    if (hasFastagSerialColumn) {
      parentColumns.push("fastag_serial");
      parentPlaceholders.push("?");
      parentValues.push(fastag_serial ?? null);
    }

    parentColumns.push("parent_ticket_id");
    parentPlaceholders.push("?");
    parentValues.push(null);

    const parentInsert = `INSERT INTO ${TICKETS_TABLE} (${parentColumns.join(", ")}, created_at, updated_at) VALUES (${parentPlaceholders.join(", ")}, NOW(), NOW())`;

    const [r1]: any = await conn.query(parentInsert, parentValues);
    await markFastagAsUsed(conn, fastag_serial, vehicle_reg_no);
    const parentId = r1.insertId as number;

    let childrenCreated = 0;
    if (Array.isArray(sub_issues) && sub_issues.length > 0) {
      for (const row of sub_issues) {
        const c_subject = row.subject;
        if (!c_subject || !String(c_subject).trim()) continue;

        const childTicketNo = await generateTicketNo(conn);

        // derive payment for each child row
        const r_ptc_raw = row.payment_to_collect ?? payment_to_collect;
        const r_pts_raw = row.payment_to_send ?? payment_to_send;
        const r_ptc = r_ptc_raw === undefined || r_ptc_raw === null ? null : Number(r_ptc_raw);
        const r_pts = r_pts_raw === undefined || r_pts_raw === null ? null : Number(r_pts_raw);
        const r_net =
          r_ptc === null && r_pts === null
            ? null
            : Number((((r_ptc ?? 0) + (r_pts ?? 0)).toFixed?.(2) ?? (r_ptc ?? 0) + (r_pts ?? 0)));

        const rowCommissionRaw = row.commission_amount ?? commission_amount ?? 0;
        const rowCommission =
          rowCommissionRaw === undefined || rowCommissionRaw === null
            ? 0
            : Number(rowCommissionRaw);

        const subColumns = [
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
        const subPlaceholders = Array(subColumns.length).fill("?");
        const subValues: (string | number | null)[] = [
          childTicketNo,
          row.vehicle_reg_no ?? vehicle_reg_no ?? "",
          c_subject,
          row.details ?? "",
          row.phone ?? phone ?? "",
          row.alt_phone ?? alt_phone ?? null,
          row.assigned_to ?? assigned_to ?? null,
          row.lead_received_from ?? lead_received_from ?? null,
          row.lead_by ?? lead_by ?? null,
          row.status ?? "open",
          row.kyv_status ?? kyv_status ?? null,
          row.customer_name ?? customer_name ?? null,
          row.comments ?? null,
          isNaN(r_ptc as any) ? null : r_ptc,
          isNaN(r_pts as any) ? null : r_pts,
          isNaN(r_net as any) ? null : r_net,
        ];

        if (hasCommissionColumn) {
          subColumns.push("commission_amount");
          subPlaceholders.push("?");
          subValues.push(isNaN(rowCommission as any) ? 0 : rowCommission);
        }

        subColumns.push("pickup_point_name");
        subPlaceholders.push("?");
        subValues.push(row.pickup_point_name ?? pickup_point_name ?? null);

        if (hasFastagSerialColumn) {
          subColumns.push("fastag_serial");
          subPlaceholders.push("?");
          subValues.push(row.fastag_serial ?? fastag_serial ?? null);
        }

        subColumns.push("parent_ticket_id");
        subPlaceholders.push("?");
        subValues.push(parentId);

        const subInsert = `INSERT INTO ${TICKETS_TABLE} (${subColumns.join(", ")}, created_at, updated_at) VALUES (${subPlaceholders.join(", ")}, NOW(), NOW())`;

        await conn.query(subInsert, subValues);
        await markFastagAsUsed(conn, row.fastag_serial ?? fastag_serial ?? null, row.vehicle_reg_no ?? vehicle_reg_no ?? null);
        childrenCreated++;
        try {
          await logTicketAction({ ticketId: parentId, action: "create_child", req, meta: { child_ticket_no: childTicketNo } });
        } catch {}
      }
    }

    await conn.commit();
    try { await logTicketAction({ ticketId: parentId, action: "create", req, meta: { parent_ticket_no: ticket_no_parent } }); } catch {}
    return NextResponse.json({
      ok: true,
      mode: "parent_with_optional_subs",
      parent_id: parentId,
      parent_ticket_no: ticket_no_parent,
      children_created: childrenCreated,
    });
  } catch (e: any) {
    await conn.rollback();
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    conn.release();
  }
}

// PATCH: update selected fields
export async function PATCH(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data.id) {
      return NextResponse.json({ error: "Ticket ID is required" }, { status: 400 });
    }

    const includeCommissionColumn = await hasTableColumn(TICKETS_TABLE, "commission_amount");
    const includeFastagColumn = await hasTableColumn(TICKETS_TABLE, "fastag_serial");
    const allowedFields = [
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
    if (includeCommissionColumn) {
      allowedFields.push("commission_amount");
    }
    if (includeFastagColumn) {
      allowedFields.push("fastag_serial");
    }
    allowedFields.push("pickup_point_name");

    const updates: string[] = [];
    const values: any[] = [];
    for (const field of allowedFields) {
      if (typeof data[field] !== "undefined") {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(data.id);

    const [result]: any = await pool.query(
      `UPDATE tickets_nh SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return NextResponse.json({
      message: "Ticket updated",
      changedRows: result.changedRows ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


