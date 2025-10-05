import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to");     // YYYY-MM-DD
    // Ignore any limit param – return all rows

    const where: string[] = [];
    const vals: any[] = [];
    if (from) { where.push("s.created_at >= ?"); vals.push(`${from} 00:00:00`); }
    if (to) { where.push("s.created_at <= ?"); vals.push(`${to} 23:59:59`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Ensure table exists (no-op if present)
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

    const [rows] = await pool.query(
      `SELECT COALESCE(s.sold_by_user_id, s.sold_by_agent_id) AS user_id,
              COALESCE(u.name, '') AS name,
              COUNT(*) AS sold_count
       FROM fastag_sales s
       LEFT JOIN users u ON u.id = COALESCE(s.sold_by_user_id, s.sold_by_agent_id)
       ${whereSql}
       GROUP BY COALESCE(s.sold_by_user_id, s.sold_by_agent_id), u.name
       ORDER BY sold_count DESC`,
      vals
    );
    const result = Array.isArray(rows) ? rows : [];
    if (result.length > 0) {
      return NextResponse.json(result);
    }
    // Fallback: compute from fastags table if snapshot is empty
    const [fb] = await pool.query(
      `SELECT f.sold_by_user_id AS user_id, COALESCE(u.name, '') AS name, COUNT(*) AS sold_count
       FROM fastags f
       LEFT JOIN users u ON u.id = f.sold_by_user_id
       WHERE f.status = 'sold' AND f.sold_by_user_id IS NOT NULL
       GROUP BY f.sold_by_user_id, u.name
       ORDER BY sold_count DESC`
    );
    return NextResponse.json(fb || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
