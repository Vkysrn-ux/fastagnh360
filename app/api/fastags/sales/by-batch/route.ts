import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Returns per-day sold counts for a given batch (optionally filtered by seller/agent)
// Query params:
// - bank: string (optional)
// - class: string (optional)
// - batch: string (optional)
// - seller: number (optional) — matches COALESCE(sold_by_user_id, sold_by_agent_id)
// - from: YYYY-MM-DD (optional)
// - to: YYYY-MM-DD (optional)
// - limit: number (optional, default 90 days)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bank = (searchParams.get("bank") || "").trim();
    const fastagClass = (searchParams.get("class") || "").trim();
    const batch = (searchParams.get("batch") || "").trim();
    const seller = (searchParams.get("seller") || "").trim();
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();
    const limitParam = Number(searchParams.get("limit") || 90);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(3650, Math.floor(limitParam))) : 90;

    // Build WHERE
    const where: string[] = [
      // join condition via WHERE to control collation safely
      "(s.tag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci)",
    ];
    const vals: any[] = [];
    if (bank) { where.push("f.bank_name = ?"); vals.push(bank); }
    if (fastagClass) { where.push("f.fastag_class = ?"); vals.push(fastagClass); }
    if (batch) { where.push("f.batch_number = ?"); vals.push(batch); }
    if (seller) { where.push("COALESCE(s.sold_by_user_id, s.sold_by_agent_id) = ?"); vals.push(Number(seller)); }
    if (from) { where.push("s.created_at >= ?"); vals.push(`${from} 00:00:00`); }
    if (to) { where.push("s.created_at <= ?"); vals.push(`${to} 23:59:59`); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT DATE(s.created_at) AS sale_date, COUNT(*) AS sold_count
      FROM fastag_sales s, fastags f
      ${whereSql}
      GROUP BY DATE(s.created_at)
      ORDER BY sale_date DESC
      LIMIT ?`;

    const [rows] = await pool.query(sql, [...vals, limit]);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

