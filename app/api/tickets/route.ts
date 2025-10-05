// app/api/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserSession } from "@/lib/getSession";
import { logTicketAction } from "@/lib/ticket-logs";
import { hasTableColumn } from "@/lib/db-helpers";
import type { PoolConnection } from "mysql2/promise";

const TICKETS_TABLE = "tickets_nh";

function normalizeStatus(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().toLowerCase();
  const map: Record<string, string> = {
    // canonical set we use across app: open | in_progress | completed | closed
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

// Normalize 'paid_via' to a fixed set of options
function normalizePaidVia(v: any): string {
  const allowed = new Set<string>([
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
  const val = String(v ?? 'Pending').trim();
  return allowed.has(val) ? val : 'Pending';
}

// --- utility: make a ticket_no like TK-A0001 (prefix + 4-digit id-based sequence)

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
  // Robust: derive from current max(ticket_no) under lock to avoid duplicates
  try {
    const [rows]: any = await conn.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_no, 5) AS UNSIGNED)), 0) AS max_no FROM ${TICKETS_TABLE} FOR UPDATE`
    );
    const next = Number(rows?.[0]?.max_no || 0) + 1;
    const seq = String(next).padStart(4, '0');
    return `TK-A${seq}`;
  } catch {
    try {
      const [rows2]: any = await conn.query(
        `SELECT AUTO_INCREMENT AS nextId FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
        [TICKETS_TABLE]
      );
      const nextId = Number(rows2?.[0]?.nextId || 1);
      const seq = String(nextId).padStart(4, '0');
      return `TK-A${seq}`;
    } catch {
      const [rows3]: any = await conn.query(`SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM ${TICKETS_TABLE}`);
      const nextId3 = Number(rows3?.[0]?.nextId || 1);
      const seq3 = String(nextId3).padStart(4, '0');
      return `TK-A${seq3}`;
    }
  }
}

function normalizeIndianMobile(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  const m = s.match(/^(?:\+?91[\-\s]?|0)?([6-9]\d{9})$/);
  return m ? m[1] : null;
}

// --- Sales + Ledger helpers (best-effort, won't break request) ---
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
    // Ensure table exists so inserts don't silently fail
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS fastag_sales (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tag_serial VARCHAR(255) NOT NULL,
          ticket_id INT NULL,
          vehicle_reg_no VARCHAR(64) NULL,
          bank_name VARCHAR(255) NULL,
          fastag_class VARCHAR(32) NULL,
          supplier_id INT NULL,
          sold_by_user_id INT NULL,
          sold_by_agent_id INT NULL,
          payment_to_collect DECIMAL(10,2) NULL,
          payment_to_send DECIMAL(10,2) NULL,
          net_value DECIMAL(10,2) NULL,
          commission_amount DECIMAL(10,2) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch {}

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

async function recordMoneyLedger(opts: {
  conn: PoolConnection;
  refType: 'ticket' | 'fastag_sale';
  refId: number;
  collect?: number | null;
  payout?: number | null;
  commission?: number | null;
}) {
  const { conn } = opts;
  try {
    const rows: Array<[string, number | null]> = [
      ['collect', opts.collect ?? null],
      ['payout', opts.payout ?? null],
      ['commission', opts.commission ?? null],
    ];
    for (const [entryType, amount] of rows) {
      if (amount === null || isNaN(Number(amount))) continue;
      await conn.query(
        `INSERT INTO money_ledger (ref_type, ref_id, entry_type, amount, created_at) VALUES (?, ?, ?, ?, NOW())`,
        [opts.refType, opts.refId, entryType, Number(amount)]
      );
    }
  } catch {}
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
    // Determine if created_by column exists; use safe selects/joins accordingly
    let hasCreatedByCol = false;
    try { hasCreatedByCol = await hasTableColumn(TICKETS_TABLE, 'created_by'); } catch {}
    const createdBySelect = hasCreatedByCol ? ", COALESCE(cu.name, '') AS created_by_name" : ", '' AS created_by_name";
    const createdByJoin = hasCreatedByCol ? " LEFT JOIN users cu ON t.created_by = cu.id" : "";
    if (parentId) {
      // Children of one parent
      // Return the same rich columns as root list so UI can show identical columns
      try {
        const [rows] = await pool.query(
          `
          SELECT
            t.*,
            COALESCE(u.name, '') AS assigned_to_name${createdBySelect},
            f.bank_name AS fastag_bank,
            f.fastag_class,
            CASE
              WHEN f.status = 'sold' THEN 'User'
              WHEN f.assigned_to_agent_id IS NOT NULL THEN 'Agent'
              ELSE 'Admin'
            END AS fastag_owner
          FROM tickets_nh t
          LEFT JOIN users u ON t.assigned_to = u.id${createdByJoin}
          LEFT JOIN fastags f ON f.tag_serial = t.fastag_serial
          WHERE t.parent_ticket_id = ?
          ORDER BY t.created_at DESC
          `,
          [parentId]
        );
        return NextResponse.json(rows || []);
      } catch {
        const [rows] = await pool.query(
          `
          SELECT
            t.*,
            COALESCE(u.name, '') AS assigned_to_name${createdBySelect}
          FROM tickets_nh t
          LEFT JOIN users u ON t.assigned_to = u.id${createdByJoin}
          WHERE t.parent_ticket_id = ?
          ORDER BY t.created_at DESC
          `,
          [parentId]
        );
        return NextResponse.json(rows || []);
      }
    }

    if (scope === "all") {
      try {
        const [rows] = await pool.query(`
          SELECT
            t.*,
            COALESCE(u.name, '') AS assigned_to_name${createdBySelect},
            CASE
              WHEN t.lead_received_from = 'Shop' AND u.role = 'shop' THEN u.name
              ELSE NULL
            END AS shop_name,
            f.bank_name AS fastag_bank,
            f.fastag_class,
            CASE
              WHEN f.status = 'sold' THEN 'User'
              WHEN f.assigned_to_agent_id IS NOT NULL THEN 'Agent'
              ELSE 'Admin'
            END AS fastag_owner
          FROM tickets_nh t
          LEFT JOIN users u ON t.assigned_to = u.id${createdByJoin}
          LEFT JOIN fastags f ON f.tag_serial = t.fastag_serial
          WHERE COALESCE(t.status, '') <> 'draft'
          ORDER BY t.created_at DESC
        `);
        return NextResponse.json(rows || []);
      } catch {
        const [rows] = await pool.query(`
          SELECT
            t.*,
            COALESCE(u.name, '') AS assigned_to_name${createdBySelect},
            CASE
              WHEN t.lead_received_from = 'Shop' AND u.role = 'shop' THEN u.name
              ELSE NULL
            END AS shop_name
          FROM tickets_nh t
          LEFT JOIN users u ON t.assigned_to = u.id${createdByJoin}
          WHERE COALESCE(t.status, '') <> 'draft'
          ORDER BY t.created_at DESC
        `);
        return NextResponse.json(rows || []);
      }
    }

    // ROOTS ONLY (keep subs out of the main list)
    try {
      const [rows] = await pool.query(`
        SELECT
          t.*,
          COALESCE(u.name, '') AS assigned_to_name${createdBySelect},
          CASE
            WHEN t.lead_received_from = 'Shop' AND u.role = 'shop' THEN u.name
            ELSE NULL
          END AS shop_name,
          f.bank_name AS fastag_bank,
          f.fastag_class,
          CASE
            WHEN f.status = 'sold' THEN 'User'
            WHEN f.assigned_to_agent_id IS NOT NULL THEN 'Agent'
            ELSE 'Admin'
          END AS fastag_owner,
          COALESCE(s.cnt, 0) AS subs_count
        FROM tickets_nh t
        LEFT JOIN users u ON t.assigned_to = u.id${createdByJoin}
        LEFT JOIN fastags f ON f.tag_serial = t.fastag_serial
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
    } catch {
      const [rows] = await pool.query(`
        SELECT
          t.*,
          COALESCE(u.name, '') AS assigned_to_name${createdBySelect},
          CASE
            WHEN t.lead_received_from = 'Shop' AND u.role = 'shop' THEN u.name
            ELSE NULL
          END AS shop_name,
          COALESCE(s.cnt, 0) AS subs_count
        FROM tickets_nh t
        LEFT JOIN users u ON t.assigned_to = u.id${createdByJoin}
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
    }
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

    // Ensure new field 'paid_via' exists on tickets table (idempotent)
    try {
      const hasPaidVia = await hasTableColumn(TICKETS_TABLE, 'paid_via', conn);
      if (!hasPaidVia) {
        await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN paid_via VARCHAR(64) NOT NULL DEFAULT 'Pending'`);
      }
    } catch {}

    const hasCommissionColumn = await hasTableColumn(TICKETS_TABLE, "commission_amount", conn);
    const hasFastagSerialColumn = await hasTableColumn(TICKETS_TABLE, "fastag_serial", conn);
    const hasPaymentReceived = await hasTableColumn(TICKETS_TABLE, "payment_received", conn);
    const hasDeliveryDone = await hasTableColumn(TICKETS_TABLE, "delivery_done", conn);
    const hasCommissionDone = await hasTableColumn(TICKETS_TABLE, "commission_done", conn);
    const hasPaidVia = await hasTableColumn(TICKETS_TABLE, 'paid_via', conn);

    // Business rule validation: if payment is received, paid_via must not be 'Pending'
    try {
      const normalizedVia = normalizePaidVia((data as any)?.paid_via);
      const paymentIsReceived = !!(data as any)?.payment_received;
      if (paymentIsReceived && normalizedVia === 'Pending') {
        await conn.rollback();
        return NextResponse.json({ error: "Paid via cannot be 'Pending' when Payment Received is checked." }, { status: 400 });
      }
      // If creating sub_issues, ensure each child respects the same rule
      if (Array.isArray((data as any)?.sub_issues)) {
        for (const row of (data as any).sub_issues) {
          const childVia = normalizePaidVia((row as any)?.paid_via ?? (data as any)?.paid_via);
          const childReceived = !!(row as any)?.payment_received;
          if (childReceived && childVia === 'Pending') {
            await conn.rollback();
            return NextResponse.json({ error: "Paid via cannot be 'Pending' for a sub-ticket when Payment Received is checked." }, { status: 400 });
          }
        }
      }
    } catch {}

    // Ensure additional optional columns exist (idempotent)
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN alt_vehicle_reg_no VARCHAR(64) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN payment_nil TINYINT(1) NOT NULL DEFAULT 0`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN delivery_nil TINYINT(1) NOT NULL DEFAULT 0`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN lead_commission DECIMAL(10,2) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN lead_commission_paid TINYINT(1) NOT NULL DEFAULT 0`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN lead_commission_nil TINYINT(1) NOT NULL DEFAULT 0`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN pickup_commission DECIMAL(10,2) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN pickup_commission_paid TINYINT(1) NOT NULL DEFAULT 0`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN pickup_commission_nil TINYINT(1) NOT NULL DEFAULT 0`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN fastag_bank VARCHAR(64) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN fastag_class VARCHAR(32) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN fastag_owner VARCHAR(64) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN rc_front_url VARCHAR(255) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN rc_back_url VARCHAR(255) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN pan_url VARCHAR(255) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN aadhaar_front_url VARCHAR(255) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN aadhaar_back_url VARCHAR(255) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN vehicle_front_url VARCHAR(255) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN vehicle_side_url VARCHAR(255) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN sticker_pasted_url VARCHAR(255) NULL`); } catch {}
    try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN npci_status VARCHAR(64) NULL`); } catch {}
    // created_by: ensure existence, but track flag for safe inserts
    let hasCreatedBy = await hasTableColumn(TICKETS_TABLE, 'created_by', conn);
    if (!hasCreatedBy) {
      try { await conn.query(`ALTER TABLE ${TICKETS_TABLE} ADD COLUMN created_by INT NULL`); } catch {}
      try { hasCreatedBy = await hasTableColumn(TICKETS_TABLE, 'created_by', conn); } catch {}
    }

    // helper: duplicate guard by phone + vehicle
    async function findDuplicates(phoneRaw: any, vrnRaw: any) {
      const p = normalizeIndianMobile(phoneRaw);
      const vrn = (vrnRaw ?? '').toString().trim();
      if (!p || !vrn) return [] as any[];
      const [rows]: any = await conn.query(
        `SELECT id, ticket_no, status, customer_name, created_at
           FROM ${TICKETS_TABLE}
          WHERE phone = ? AND UPPER(COALESCE(vehicle_reg_no,'')) = UPPER(?)
          ORDER BY created_at DESC
          LIMIT 10`,
        [p, vrn]
      );
      return Array.isArray(rows) ? rows : [];
    }

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
      const effectiveStatus = normalizeStatus(typeof status !== "undefined" ? status : null) || "open";
      const effectiveKyvStatus = normalizeKyv(typeof kyv_status !== "undefined" ? kyv_status : null) || parent.kyv_status || null;
      const effectiveCustomer = (typeof customer_name !== "undefined" ? customer_name : null) ?? parent.customer_name ?? null;
      const effectiveComments = (typeof comments !== "undefined" ? comments : null) ?? null;

      // Duplicate guard: prevent creating a sub-ticket with same phone+VRN
      const dupSub = await findDuplicates(effectivePhone, effectiveVehicle);
      if (dupSub.length) {
        await conn.rollback();
        return NextResponse.json({
          error: 'Duplicate ticket exists for this phone and vehicle number',
          duplicates: dupSub,
        }, { status: 409 });
      }

      const childColumns = [
        "ticket_no",
        "vehicle_reg_no",
        "subject",
        "details",
        "phone",
        "alt_phone",
        "alt_vehicle_reg_no",
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
        normalizeIndianMobile(effectivePhone) ?? null,
        normalizeIndianMobile(effectiveAltPhone),
        data?.alt_vehicle_reg_no ?? null,
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

      if (hasPaymentReceived) {
        childColumns.push("payment_received");
        childPlaceholders.push("?");
        childValues.push(data?.payment_received ? 1 : 0);
      }
      if (hasDeliveryDone) {
        childColumns.push("delivery_done");
        childPlaceholders.push("?");
        childValues.push(data?.delivery_done ? 1 : 0);
      }
      if (hasCommissionDone) {
        childColumns.push("commission_done");
        childPlaceholders.push("?");
        childValues.push(data?.commission_done ? 1 : 0);
      }

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
      // Extra optional fields (avoid duplicates already handled above)
      if (hasPaidVia) { childColumns.push('paid_via'); childPlaceholders.push('?'); childValues.push(normalizePaidVia(data?.paid_via)); }
      childColumns.push('payment_nil'); childPlaceholders.push('?'); childValues.push(data?.payment_nil ? 1 : 0);
      childColumns.push('delivery_nil'); childPlaceholders.push('?'); childValues.push(data?.delivery_nil ? 1 : 0);
      // commission_amount already added above when present
      childColumns.push('lead_commission'); childPlaceholders.push('?'); childValues.push(data?.lead_commission ?? null);
      childColumns.push('lead_commission_paid'); childPlaceholders.push('?'); childValues.push(data?.lead_commission_paid ? 1 : 0);
      childColumns.push('lead_commission_nil'); childPlaceholders.push('?'); childValues.push(data?.lead_commission_nil ? 1 : 0);
      childColumns.push('pickup_commission'); childPlaceholders.push('?'); childValues.push(data?.pickup_commission ?? null);
      childColumns.push('pickup_commission_paid'); childPlaceholders.push('?'); childValues.push(data?.pickup_commission_paid ? 1 : 0);
      childColumns.push('pickup_commission_nil'); childPlaceholders.push('?'); childValues.push(data?.pickup_commission_nil ? 1 : 0);
      childColumns.push('fastag_bank'); childPlaceholders.push('?'); childValues.push(data?.fastag_bank ?? null);
      childColumns.push('fastag_class'); childPlaceholders.push('?'); childValues.push(data?.fastag_class ?? null);
      childColumns.push('fastag_owner'); childPlaceholders.push('?'); childValues.push(data?.fastag_owner ?? null);
      childColumns.push('rc_front_url'); childPlaceholders.push('?'); childValues.push(data?.rc_front_url ?? null);
      childColumns.push('rc_back_url'); childPlaceholders.push('?'); childValues.push(data?.rc_back_url ?? null);
      childColumns.push('pan_url'); childPlaceholders.push('?'); childValues.push(data?.pan_url ?? null);
      childColumns.push('aadhaar_front_url'); childPlaceholders.push('?'); childValues.push(data?.aadhaar_front_url ?? null);
      childColumns.push('aadhaar_back_url'); childPlaceholders.push('?'); childValues.push(data?.aadhaar_back_url ?? null);
      childColumns.push('vehicle_front_url'); childPlaceholders.push('?'); childValues.push(data?.vehicle_front_url ?? null);
      childColumns.push('vehicle_side_url'); childPlaceholders.push('?'); childValues.push(data?.vehicle_side_url ?? null);
      childColumns.push('sticker_pasted_url'); childPlaceholders.push('?'); childValues.push(data?.sticker_pasted_url ?? null);

      childColumns.push("parent_ticket_id");
      childPlaceholders.push("?");
      childValues.push(parent_ticket_id);

      const childInsert = `INSERT INTO ${TICKETS_TABLE} (${childColumns.join(", ")}, created_at, updated_at) VALUES (${childPlaceholders.join(", ")}, NOW(), NOW())`;

      const [r]: any = await conn.query(childInsert, childValues);

      await markFastagAsUsed(conn, effectiveFastagSerial, effectiveVehicle);
      await recordFastagSale({
        conn,
        tagSerial: effectiveFastagSerial,
        ticketId: Number(r.insertId),
        vehicleRegNo: effectiveVehicle,
        assignedToUserId: effectiveAssignedTo ? Number(effectiveAssignedTo) : null,
        payment_to_collect: c_ptc,
        payment_to_send: c_pts,
        net_value: c_net,
        commission_amount: childCommission,
      });
      await recordMoneyLedger({
        conn,
        refType: 'ticket',
        refId: Number(r.insertId),
        collect: c_ptc,
        payout: c_pts,
        commission: childCommission,
      });

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

    // Enforce status business rules before composing insert
    const reqPaymentOK = !!data?.payment_received || !!data?.payment_nil;
    const reqLeadOK = !!data?.lead_commission_paid || !!data?.lead_commission_nil;
    const reqPickupOK = !!data?.pickup_commission_paid || !!data?.pickup_commission_nil;
    const reqK = (data?.kyv_status ?? '').toString().toLowerCase();
    const reqKyvOK = reqK.includes('compliant') || reqK === 'nil' || reqK === 'kyv compliant';
    const reqDeliveryOK = !!data?.delivery_done || !!data?.delivery_nil;
    let requestedStatusNorm = normalizeStatus(status) || 'open';
    if (requestedStatusNorm === 'closed' && !(reqPaymentOK && reqLeadOK && reqPickupOK && reqKyvOK && reqDeliveryOK)) {
      await conn.rollback();
      return NextResponse.json({ error: 'Cannot close ticket until Payment, Lead Commission, Pickup Commission, KYV and Delivery are completed or marked Nil.' }, { status: 400 });
    }
    if (!(reqPaymentOK || reqLeadOK || reqPickupOK || reqKyvOK || reqDeliveryOK)) {
      requestedStatusNorm = 'open';
    }

    const parentColumns = [
      "ticket_no",
      "vehicle_reg_no",
      "alt_vehicle_reg_no",
      "subject",
      "details",
      "phone",
      "alt_phone",
      "assigned_to",
      "lead_received_from",
      "lead_by",
      "status",
      "kyv_status",
      "npci_status",
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
      data?.alt_vehicle_reg_no ?? null,
      subject ?? "",
      details ?? "",
      normalizeIndianMobile(phone) ?? null,
      normalizeIndianMobile(alt_phone),
      assigned_to ?? null,
      lead_received_from ?? null,
      lead_by ?? null,
      requestedStatusNorm || "open",
      normalizeKyv(kyv_status) || null,
      (data?.npci_status ?? null),
      customer_name ?? null,
      comments ?? null,
      isNaN(p_ptc as any) ? null : p_ptc,
      isNaN(p_pts as any) ? null : p_pts,
      isNaN(p_net as any) ? null : p_net,
    ];
    if (hasPaymentReceived) {
      parentColumns.push("payment_received");
      parentPlaceholders.push("?");
      parentValues.push(data?.payment_received ? 1 : 0);
    }
    if (hasDeliveryDone) {
      parentColumns.push("delivery_done");
      parentPlaceholders.push("?");
      parentValues.push(data?.delivery_done ? 1 : 0);
    }
    if (hasCommissionDone) {
      parentColumns.push("commission_done");
      parentPlaceholders.push("?");
      parentValues.push(data?.commission_done ? 1 : 0);
    }
    if (hasCommissionColumn) {
      parentColumns.push("commission_amount");
      parentPlaceholders.push("?");
      parentValues.push(isNaN(parentCommission as any) ? 0 : parentCommission);
    }
    if (hasPaidVia) { parentColumns.push('paid_via'); parentPlaceholders.push('?'); parentValues.push(normalizePaidVia(data?.paid_via)); }
    parentColumns.push('payment_nil'); parentPlaceholders.push('?'); parentValues.push(data?.payment_nil ? 1 : 0);
    parentColumns.push('delivery_nil'); parentPlaceholders.push('?'); parentValues.push(data?.delivery_nil ? 1 : 0);
    parentColumns.push('lead_commission'); parentPlaceholders.push('?'); parentValues.push(data?.lead_commission ?? null);
    parentColumns.push('lead_commission_paid'); parentPlaceholders.push('?'); parentValues.push(data?.lead_commission_paid ? 1 : 0);
    parentColumns.push('lead_commission_nil'); parentPlaceholders.push('?'); parentValues.push(data?.lead_commission_nil ? 1 : 0);
    parentColumns.push('pickup_commission'); parentPlaceholders.push('?'); parentValues.push(data?.pickup_commission ?? null);
    parentColumns.push('pickup_commission_paid'); parentPlaceholders.push('?'); parentValues.push(data?.pickup_commission_paid ? 1 : 0);
    parentColumns.push('pickup_commission_nil'); parentPlaceholders.push('?'); parentValues.push(data?.pickup_commission_nil ? 1 : 0);
    parentColumns.push('fastag_bank'); parentPlaceholders.push('?'); parentValues.push(data?.fastag_bank ?? null);
    parentColumns.push('fastag_class'); parentPlaceholders.push('?'); parentValues.push(data?.fastag_class ?? null);
    parentColumns.push('fastag_owner'); parentPlaceholders.push('?'); parentValues.push(data?.fastag_owner ?? null);
    parentColumns.push('rc_front_url'); parentPlaceholders.push('?'); parentValues.push(data?.rc_front_url ?? null);
    parentColumns.push('rc_back_url'); parentPlaceholders.push('?'); parentValues.push(data?.rc_back_url ?? null);
    parentColumns.push('pan_url'); parentPlaceholders.push('?'); parentValues.push(data?.pan_url ?? null);
    parentColumns.push('aadhaar_front_url'); parentPlaceholders.push('?'); parentValues.push(data?.aadhaar_front_url ?? null);
    parentColumns.push('aadhaar_back_url'); parentPlaceholders.push('?'); parentValues.push(data?.aadhaar_back_url ?? null);
    parentColumns.push('vehicle_front_url'); parentPlaceholders.push('?'); parentValues.push(data?.vehicle_front_url ?? null);
    parentColumns.push('vehicle_side_url'); parentPlaceholders.push('?'); parentValues.push(data?.vehicle_side_url ?? null);
    parentColumns.push('sticker_pasted_url'); parentPlaceholders.push('?'); parentValues.push(data?.sticker_pasted_url ?? null);
    // paid_via already included above if available
    parentColumns.push("pickup_point_name");
    parentPlaceholders.push("?");
    parentValues.push(pickup_point_name ?? null);

    // created_by (from session cookie)
    try {
      if (hasCreatedBy) {
        const session = await getUserSession();
        const creatorId = session?.id ? Number(session.id) : null;
        parentColumns.push('created_by');
        parentPlaceholders.push('?');
        parentValues.push(creatorId);
      }
    } catch {}

    if (hasFastagSerialColumn) {
      parentColumns.push("fastag_serial");
      parentPlaceholders.push("?");
      parentValues.push(fastag_serial ?? null);
    }

    parentColumns.push("parent_ticket_id");
    parentPlaceholders.push("?");
    parentValues.push(null);

    // Duplicate guard for parent creation
    const dupParent = await findDuplicates(phone, vehicle_reg_no);
    if (dupParent.length) {
      await conn.rollback();
      return NextResponse.json({
        error: 'Duplicate ticket exists for this phone and vehicle number',
        duplicates: dupParent,
      }, { status: 409 });
    }

    const parentInsert = `INSERT INTO ${TICKETS_TABLE} (${parentColumns.join(", ")}, created_at, updated_at) VALUES (${parentPlaceholders.join(", ")}, NOW(), NOW())`;

    const [r1]: any = await conn.query(parentInsert, parentValues);
    // Only mark FASTag as sold if ticket is created already in 'closed' state (rare)
    try {
      const desiredStatus = normalizeStatus(status);
      if (desiredStatus === 'closed' || desiredStatus === 'completed') {
        await markFastagAsUsed(conn, fastag_serial, vehicle_reg_no);
        await recordFastagSale({
          conn,
          tagSerial: fastag_serial,
          ticketId: r1.insertId as number,
          vehicleRegNo: vehicle_reg_no ?? null,
          assignedToUserId: assigned_to ? Number(assigned_to) : null,
          payment_to_collect: p_ptc,
          payment_to_send: p_pts,
          net_value: p_net,
          commission_amount: parentCommission,
        });
      }
    } catch {}
    const parentId = r1.insertId as number;
    // Record money ledger for parent ticket (still useful for analytics)
    await recordMoneyLedger({ conn, refType: 'ticket', refId: parentId, collect: p_ptc, payout: p_pts, commission: parentCommission });

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
          normalizeIndianMobile(row.phone ?? phone) ?? null,
          normalizeIndianMobile(row.alt_phone ?? alt_phone),
          row.assigned_to ?? assigned_to ?? null,
          row.lead_received_from ?? lead_received_from ?? null,
          row.lead_by ?? lead_by ?? null,
          normalizeStatus(row.status) || "open",
          normalizeKyv(row.kyv_status) || normalizeKyv(kyv_status) || null,
          row.customer_name ?? customer_name ?? null,
          row.comments ?? null,
          isNaN(r_ptc as any) ? null : r_ptc,
          isNaN(r_pts as any) ? null : r_pts,
          isNaN(r_net as any) ? null : r_net,
        ];

        if (hasPaymentReceived) {
          subColumns.push("payment_received");
          subPlaceholders.push("?");
          // @ts-ignore
          subValues.push(row.payment_received ?? data?.payment_received ? 1 : 0);
        }
        if (hasDeliveryDone) {
          subColumns.push("delivery_done");
          subPlaceholders.push("?");
          // @ts-ignore
          subValues.push(row.delivery_done ?? data?.delivery_done ? 1 : 0);
        }
        if (hasCommissionDone) {
          subColumns.push("commission_done");
          subPlaceholders.push("?");
          // @ts-ignore
          subValues.push(row.commission_done ?? data?.commission_done ? 1 : 0);
        }

        if (hasCommissionColumn) {
          subColumns.push("commission_amount");
          subPlaceholders.push("?");
          subValues.push(isNaN(rowCommission as any) ? 0 : rowCommission);
        }
        if (hasPaidVia) {
          subColumns.push('paid_via');
          subPlaceholders.push('?');
          // child row can override paid_via, else inherit from parent payload
          subValues.push(normalizePaidVia((row as any)?.paid_via ?? (data as any)?.paid_via));
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
        const usedSerial = row.fastag_serial ?? fastag_serial ?? null;
        const usedVehicle = row.vehicle_reg_no ?? vehicle_reg_no ?? null;
        // Only finalize FASTag sale if a child is immediately created as 'closed'
        try {
          const childDesired = normalizeStatus(row.status);
          if (childDesired === 'closed' || childDesired === 'completed') {
            await markFastagAsUsed(conn, usedSerial, usedVehicle);
            await recordFastagSale({
              conn,
              tagSerial: usedSerial,
              ticketId: parentId,
              vehicleRegNo: usedVehicle,
              assignedToUserId: (row.assigned_to ?? assigned_to) ? Number(row.assigned_to ?? assigned_to) : null,
              payment_to_collect: r_ptc,
              payment_to_send: r_pts,
              net_value: r_net,
              commission_amount: rowCommission,
            });
          }
        } catch {}
        await recordMoneyLedger({ conn, refType: 'ticket', refId: parentId, collect: r_ptc, payout: r_pts, commission: rowCommission });
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
    const includePaymentReceived = await hasTableColumn(TICKETS_TABLE, "payment_received");
    const includeDeliveryDone = await hasTableColumn(TICKETS_TABLE, "delivery_done");
    const includeCommissionDone = await hasTableColumn(TICKETS_TABLE, "commission_done");
    const includePaidVia = await hasTableColumn(TICKETS_TABLE, 'paid_via');
    const includeNpci = await hasTableColumn(TICKETS_TABLE, 'npci_status');
    const includeAltVRN = await hasTableColumn(TICKETS_TABLE, 'alt_vehicle_reg_no');
    const allowedFields = [
      "vehicle_reg_no",
      "alt_vehicle_reg_no",
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
    if (includeNpci) {
      allowedFields.push("npci_status");
    }
  if (includeCommissionColumn) {
      allowedFields.push("commission_amount");
    }
  if (includeFastagColumn) {
      allowedFields.push("fastag_serial");
    }
    if (includePaymentReceived) {
      allowedFields.push("payment_received");
    }
    if (includeDeliveryDone) {
      allowedFields.push("delivery_done");
    }
    if (includeCommissionDone) {
      allowedFields.push("commission_done");
    }
    if (includePaidVia) {
      allowedFields.push('paid_via');
    }
    allowedFields.push('payment_nil');
    allowedFields.push('delivery_nil');
    allowedFields.push("pickup_point_name");
    // commissions and extras
    allowedFields.push('lead_commission','lead_commission_paid','lead_commission_nil','pickup_commission','pickup_commission_paid','pickup_commission_nil');
    allowedFields.push('fastag_bank','fastag_class','fastag_owner');
    allowedFields.push('rc_front_url','rc_back_url','pan_url','aadhaar_front_url','aadhaar_back_url','vehicle_front_url','vehicle_side_url','sticker_pasted_url');

    // Enforce close rules if status is being set to closed
    if (typeof data.status !== 'undefined') {
      const desired = normalizeStatus(data.status) || '';
      if (desired === 'closed') {
        const [rows]: any = await pool.query(
          `SELECT payment_received, payment_nil, delivery_done, delivery_nil, kyv_status, 
                  lead_commission_paid, lead_commission_nil, pickup_commission_paid, pickup_commission_nil
             FROM ${TICKETS_TABLE} WHERE id = ? LIMIT 1`,
          [data.id]
        );
        const cur = rows?.[0] || {};
        const paymentOK = (includePaymentReceived ? (typeof data.payment_received !== 'undefined' ? !!data.payment_received : !!cur.payment_received) : false)
          || (typeof data.payment_nil !== 'undefined' ? !!data.payment_nil : !!cur.payment_nil);
        const deliveryOK = (includeDeliveryDone ? (typeof data.delivery_done !== 'undefined' ? !!data.delivery_done : !!cur.delivery_done) : false)
          || (typeof data.delivery_nil !== 'undefined' ? !!data.delivery_nil : !!cur.delivery_nil);
        const leadOK = (typeof data.lead_commission_paid !== 'undefined' ? !!data.lead_commission_paid : !!cur.lead_commission_paid)
          || (typeof data.lead_commission_nil !== 'undefined' ? !!data.lead_commission_nil : !!cur.lead_commission_nil);
        const pickupOK = (typeof data.pickup_commission_paid !== 'undefined' ? !!data.pickup_commission_paid : !!cur.pickup_commission_paid)
          || (typeof data.pickup_commission_nil !== 'undefined' ? !!data.pickup_commission_nil : !!cur.pickup_commission_nil);
        const kyvText = String(typeof data.kyv_status !== 'undefined' ? data.kyv_status : (cur.kyv_status ?? '')).toLowerCase();
        const kyvOK = kyvText.includes('compliant') || kyvText === 'nil' || kyvText === 'kyv compliant';
        const allOK = paymentOK && leadOK && pickupOK && kyvOK && deliveryOK;
        if (!allOK) {
          return NextResponse.json({ error: 'Cannot close ticket until Payment, Lead Commission, Pickup Commission, KYV and Delivery are completed or marked Nil.' }, { status: 400 });
        }
      }
    }

  // Business rule validation: if final payment_received is true and final paid_via is 'Pending', block update
  try {
    const [rows]: any = await pool.query(`SELECT paid_via, payment_received FROM ${TICKETS_TABLE} WHERE id = ? LIMIT 1`, [data.id]);
    const cur = rows?.[0] || {};
    const finalReceived = includePaymentReceived ? (typeof (data as any).payment_received !== 'undefined' ? !!(data as any).payment_received : !!cur.payment_received) : !!cur.payment_received;
    const finalVia = includePaidVia ? (typeof (data as any).paid_via !== 'undefined' ? normalizePaidVia((data as any).paid_via) : (cur.paid_via ?? 'Pending')) : (cur.paid_via ?? 'Pending');
    if (finalReceived && finalVia === 'Pending') {
      return NextResponse.json({ error: "Paid via cannot be 'Pending' when Payment Received is checked." }, { status: 400 });
    }
  } catch {}

  const updates: string[] = [];
    const values: any[] = [];
    for (const field of allowedFields) {
      if (typeof data[field] !== "undefined") {
        updates.push(`${field} = ?`);
        if (field === "status") {
          values.push(normalizeStatus(data[field]) || "open");
        } else if (field === "kyv_status") {
          values.push(normalizeKyv(data[field]) || null);
        } else if (field === "phone" || field === "alt_phone") {
          values.push(normalizeIndianMobile(data[field]));
        } else if (field === 'paid_via') {
          values.push(normalizePaidVia(data[field]));
        } else {
          values.push(data[field]);
        }
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

    // After successful update, if ticket is transitioning to 'closed', mark FASTag sold and record sale
    try {
      if (typeof data.status !== 'undefined') {
        const desired = normalizeStatus(data.status) || '';
        if (desired === 'closed' || desired === 'completed') {
          // Load updated ticket essentials
          const [rows]: any = await pool.query(
            `SELECT id, fastag_serial, vehicle_reg_no, assigned_to, payment_to_collect, payment_to_send, net_value, commission_amount FROM ${TICKETS_TABLE} WHERE id = ? LIMIT 1`,
            [data.id]
          );
          const t = rows?.[0] || {};
          if (t.fastag_serial) {
            const conn = await pool.getConnection();
            try {
              await markFastagAsUsed(conn, t.fastag_serial, t.vehicle_reg_no ?? null);
              await recordFastagSale({
                conn,
                tagSerial: t.fastag_serial,
                ticketId: Number(data.id),
                vehicleRegNo: t.vehicle_reg_no ?? null,
                assignedToUserId: t.assigned_to ? Number(t.assigned_to) : null,
                payment_to_collect: t.payment_to_collect ?? null,
                payment_to_send: t.payment_to_send ?? null,
                net_value: t.net_value ?? null,
                commission_amount: t.commission_amount ?? null,
              });
            } finally {
              conn.release();
            }
          }
        }
      }
    } catch {}

    return NextResponse.json({
      message: "Ticket updated",
      changedRows: result.changedRows ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

