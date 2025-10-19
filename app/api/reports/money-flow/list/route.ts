// app/api/reports/money-flow/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const supplier = searchParams.get('supplier');
    const bank = searchParams.get('bank');
    const klass = searchParams.get('class');
    const payment = (searchParams.get('payment') || 'all').toLowerCase(); // all|received|pending|nil

    let sql = `
      SELECT
        t.id,
        t.ticket_no,
        t.created_at,
        t.fastag_serial,
        t.assigned_to,
        COALESCE(u.name,'') AS assigned_to_name,
        t.paid_via,
        COALESCE(t.payment_to_collect,0) AS payment_to_collect,
        COALESCE(t.payment_to_send,0) AS payment_to_send,
        COALESCE(t.net_value,0) AS net_value,
        COALESCE(t.commission_amount,0) AS commission_amount,
        COALESCE(t.lead_commission,0) AS lead_commission,
        COALESCE(t.pickup_commission,0) AS pickup_commission,
        COALESCE(t.payment_received,0) AS payment_received,
        COALESCE(t.payment_nil,0) AS payment_nil,
        COALESCE(t.lead_commission_paid,0) AS lead_commission_paid,
        COALESCE(t.lead_commission_nil,0) AS lead_commission_nil,
        COALESCE(t.pickup_commission_paid,0) AS pickup_commission_paid,
        COALESCE(t.pickup_commission_nil,0) AS pickup_commission_nil,
        COALESCE(f.bank_name, t.fastag_bank) AS bank_name,
        COALESCE(f.fastag_class, t.fastag_class) AS fastag_class,
        f.supplier_id,
        COALESCE(s.name,'') AS supplier_name,
        COALESCE(blu.name,'') AS bank_login_user_name,
        CASE
          WHEN f.status = 'sold' THEN 'User'
          WHEN f.assigned_to_agent_id IS NOT NULL THEN 'Agent'
          ELSE 'Admin'
        END AS fastag_owner
      FROM tickets_nh t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN fastags f ON (f.tag_serial COLLATE utf8mb4_general_ci) = (t.fastag_serial COLLATE utf8mb4_general_ci)
      LEFT JOIN users blu ON blu.id = f.bank_login_user_id
      LEFT JOIN suppliers s ON s.id = f.supplier_id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (from) { sql += " AND COALESCE(t.created_at, t.updated_at) >= ?"; params.push(from); }
    if (to) { sql += " AND COALESCE(t.created_at, t.updated_at) <= ?"; params.push(to); }
    if (supplier) { sql += " AND COALESCE(f.supplier_id,0) = ?"; params.push(Number(supplier)); }
    if (bank) { sql += " AND (COALESCE(f.bank_name, t.fastag_bank) COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)"; params.push(String(bank)); }
    if (klass) { sql += " AND (COALESCE(f.fastag_class, t.fastag_class) COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)"; params.push(String(klass)); }

    if (payment === 'received') {
      sql += " AND COALESCE(t.payment_received,0) = 1";
    } else if (payment === 'pending') {
      sql += " AND COALESCE(t.payment_received,0) = 0 AND COALESCE(t.payment_nil,0) = 0";
    } else if (payment === 'nil') {
      sql += " AND COALESCE(t.payment_nil,0) = 1";
    }

    sql += " ORDER BY COALESCE(t.created_at, t.updated_at) DESC, t.id DESC LIMIT 2000";

    const [rows]: any = await pool.query(sql, params);
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load list' }, { status: 500 });
  }
}
