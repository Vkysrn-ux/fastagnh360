import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Returns sellers for a given FASTag class (e.g., class12)
// Optional filters: from, to (by fastag_sales.created_at), bank, agent (user id)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const klass = (searchParams.get("class") || "").trim();
    const from = (searchParams.get("from") || "").trim(); // YYYY-MM-DD
    const to = (searchParams.get("to") || "").trim();   // YYYY-MM-DD
    const bank = (searchParams.get("bank") || "").trim();
    const agent = (searchParams.get("agent") || "").trim();

    if (!klass) {
      return NextResponse.json({ error: "class is required (e.g., class12)" }, { status: 400 });
    }

    const where: string[] = [];
    const vals: any[] = [];

    // Match class using sales.fastag_class with fallback to fastags.fastag_class
    // Normalize collations to avoid bin/unicode_ci mix errors
    where.push("(COALESCE(NULLIF(s.fastag_class,''), f.fastag_class, '') COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)");
    vals.push(klass);
    if (bank) { 
      where.push("(COALESCE(NULLIF(s.bank_name,''), f.bank_name, '') COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)"); 
      vals.push(bank); 
    }
    if (from) { where.push("s.created_at >= ?"); vals.push(`${from} 00:00:00`); }
    if (to) { where.push("s.created_at <= ?"); vals.push(`${to} 23:59:59`); }
    if (agent) { where.push("COALESCE(s.sold_by_user_id, s.sold_by_agent_id) = ?"); vals.push(Number(agent)); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Primary: fastag_sales snapshot (distinct per tag)
    const [rows]: any = await pool.query(
      `SELECT COALESCE(s.sold_by_user_id, s.sold_by_agent_id) AS user_id,
              COALESCE(u.name, '') AS name,
              COUNT(DISTINCT s.tag_serial) AS sold_count
         FROM fastag_sales s
         LEFT JOIN fastags f ON (f.tag_serial COLLATE utf8mb4_general_ci) = (s.tag_serial COLLATE utf8mb4_general_ci)
         LEFT JOIN users u ON u.id = COALESCE(s.sold_by_user_id, s.sold_by_agent_id)
         ${whereSql}
         GROUP BY COALESCE(s.sold_by_user_id, s.sold_by_agent_id), u.name
         ORDER BY sold_count DESC`
      , vals
    );
    if (Array.isArray(rows) && rows.length) return NextResponse.json(rows);

    // Fallback: from fastags table if snapshot empty
    const where2: string[] = ["f.status = 'sold'", "(f.fastag_class COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)"]; const vals2: any[] = [klass];
    if (bank) { where2.push("(COALESCE(f.bank_name,'') COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)"); vals2.push(bank); }
    if (agent) { where2.push("(f.sold_by_user_id = ? OR f.assigned_to_agent_id = ?)"); vals2.push(Number(agent), Number(agent)); }
    const whereSql2 = `WHERE ${where2.join(' AND ')}`;
    const [fb]: any = await pool.query(
      `SELECT f.sold_by_user_id AS user_id, COALESCE(u.name,'') AS name,
              COUNT(DISTINCT f.tag_serial) AS sold_count
         FROM fastags f
         LEFT JOIN users u ON u.id = f.sold_by_user_id
         ${whereSql2}
         GROUP BY f.sold_by_user_id, u.name
         ORDER BY sold_count DESC`
      , vals2
    );
    return NextResponse.json(fb || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
