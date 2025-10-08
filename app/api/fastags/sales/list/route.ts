import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = (searchParams.get("from") || "").trim(); // YYYY-MM-DD
    const to = (searchParams.get("to") || "").trim();   // YYYY-MM-DD
    const seller = (searchParams.get("seller") || "").trim(); // user id
    const bank = (searchParams.get("bank") || "").trim();
    const klass = (searchParams.get("class") || "").trim();
    const supplier = (searchParams.get("supplier") || searchParams.get("supplier_id") || "").trim();
    const q = (searchParams.get("q") || "").trim(); // barcode search
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const limit = limitParam ? Math.max(1, Math.min(10000, Math.floor(Number(limitParam)))) : 1000;
    const offset = offsetParam ? Math.max(0, Math.floor(Number(offsetParam))) : 0;

    // Ensure snapshot table exists (no-op if present)
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

    // Build filters
    const where: string[] = [];
    const vals: any[] = [];

    // Limit to latest sale row per tag_serial to avoid duplicates
    const latestJoin = `JOIN (
        SELECT MAX(id) AS id
        FROM fastag_sales
        GROUP BY tag_serial
      ) latest ON latest.id = s.id`;

    if (from) { where.push("s.created_at >= ?"); vals.push(`${from} 00:00:00`); }
    if (to) { where.push("s.created_at <= ?"); vals.push(`${to} 23:59:59`); }
    if (seller) { where.push("COALESCE(s.sold_by_user_id, s.sold_by_agent_id) = ?"); vals.push(Number(seller)); }
    if (bank) { where.push("(COALESCE(NULLIF(s.bank_name,''), f.bank_name, '') COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)"); vals.push(bank); }
    if (klass) { where.push("(COALESCE(NULLIF(s.fastag_class,''), f.fastag_class, '') COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)"); vals.push(klass); }
    if (supplier) { where.push("COALESCE(s.supplier_id, f.supplier_id) = ?"); vals.push(Number(supplier)); }
    if (q) { where.push("(s.tag_serial COLLATE utf8mb4_general_ci) LIKE (? COLLATE utf8mb4_general_ci)"); vals.push(`%${q}%`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT 
        s.tag_serial,
        s.created_at AS sold_at,
        COALESCE(s.sold_by_user_id, s.sold_by_agent_id) AS seller_id,
        COALESCE(u.name, '') AS seller_name,
        COALESCE(NULLIF(s.bank_name,''), f.bank_name, '') AS bank_name,
        COALESCE(NULLIF(s.fastag_class,''), f.fastag_class, '') AS fastag_class,
        COALESCE(s.supplier_id, f.supplier_id) AS supplier_id,
        COALESCE(sup.name, '') AS supplier_name,
        s.vehicle_reg_no,
        s.ticket_id
      FROM fastag_sales s
      ${latestJoin}
      LEFT JOIN fastags f ON (f.tag_serial COLLATE utf8mb4_general_ci) = (s.tag_serial COLLATE utf8mb4_general_ci)
      LEFT JOIN suppliers sup ON sup.id = COALESCE(s.supplier_id, f.supplier_id)
      LEFT JOIN users u ON u.id = COALESCE(s.sold_by_user_id, s.sold_by_agent_id)
      ${whereSql}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(sql, [...vals, limit, offset]);
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
