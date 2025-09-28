import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Backfill sales rows for tags with status='sold' but missing in fastag_sales.
// Accepts optional filters and seller attribution so agent views show Sold correctly.
// Body JSON (all optional):
// - bank: string
// - class: string
// - batch: string
// - seller: number (sets sold_by_user_id; if omitted, remains NULL)
// - use_assigned_as_seller: boolean (when seller is null, copy assigned_to_agent_id into sold_by_agent_id)
// - sold_date: YYYY-MM-DD (fixed created_at); otherwise uses NOW()
// - from, to: YYYY-MM-DD range on f.created_at to narrow selection
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const bank = (body?.bank || "").trim();
    const fastagClass = (body?.class || "").trim();
    const batch = (body?.batch || "").trim();
    const seller = body?.seller !== undefined && body?.seller !== null ? Number(body.seller) : null;
    const useAssignedAsSeller = Boolean(body?.use_assigned_as_seller);
    const soldDate = (body?.sold_date || "").trim();
    const from = (body?.from || "").trim();
    const to = (body?.to || "").trim();

    // Ensure snapshot table exists (idempotent)
    try {
      await pool.query(`
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

    const where: string[] = [
      "f.status = 'sold'",
      "NOT EXISTS (SELECT 1 FROM fastag_sales s WHERE (s.tag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci))",
    ];
    const vals: any[] = [];
    if (bank) { where.push("f.bank_name = ?"); vals.push(bank); }
    if (fastagClass) { where.push("f.fastag_class = ?"); vals.push(fastagClass); }
    if (batch) { where.push("f.batch_number = ?"); vals.push(batch); }
    if (from) { where.push("f.created_at >= ?"); vals.push(`${from} 00:00:00`); }
    if (to) { where.push("f.created_at <= ?"); vals.push(`${to} 23:59:59`); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Choose created_at for inserted sales rows
    const createdAtExpr = soldDate ? `STR_TO_DATE(?, '%Y-%m-%d')` : `NOW()`;
    const createdAtVals = soldDate ? [soldDate] : [];

    // Insert minimal but attributed snapshot rows
    const sql = `
      INSERT INTO fastag_sales (tag_serial, ticket_id, bank_name, fastag_class, supplier_id, sold_by_user_id, sold_by_agent_id, created_at)
      SELECT f.tag_serial, 0 AS ticket_id, f.bank_name, f.fastag_class, f.supplier_id,
             ${seller !== null ? `?` : `NULL`} AS sold_by_user_id,
             ${useAssignedAsSeller ? `f.assigned_to_agent_id` : `NULL`} AS sold_by_agent_id,
             ${createdAtExpr} AS created_at
      FROM fastags f
      ${whereSql}
    `;
    const [result]: any = await pool.query(sql, [...(seller !== null ? [seller] : []), ...createdAtVals, ...vals]);

    return NextResponse.json({ success: true, inserted: result?.affectedRows || 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
