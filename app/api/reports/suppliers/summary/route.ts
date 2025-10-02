import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = (searchParams.get("name") || "").trim();
    const paid = (searchParams.get("paid") || "all").trim().toLowerCase(); // paid|credit|all
    const from = (searchParams.get("from") || "").trim(); // YYYY-MM-DD
    const to = (searchParams.get("to") || "").trim();

    // Detect optional columns on fastags
    const hasPurchaseType = await hasTableColumn('fastags', 'purchase_type').catch(()=>false);
    const hasPaymentType = await hasTableColumn('fastags', 'payment_type').catch(()=>false);

    // Build WHERE conditions
    const where: string[] = [];
    const vals: any[] = [];
    if (name) { where.push("s.name LIKE ?"); vals.push(`%${name}%`); }
    if (from) { where.push("f.purchase_date >= ?"); vals.push(`${from} 00:00:00`); }
    if (to) { where.push("f.purchase_date <= ?"); vals.push(`${to} 23:59:59`); }
    if (paid === 'credit' || paid === 'paid') {
      const creditExpr = [
        hasPurchaseType ? "LOWER(f.purchase_type) = 'credit'" : null,
        hasPaymentType ? "LOWER(f.payment_type) = 'credit'" : null,
      ].filter(Boolean).join(" OR ") || "FALSE";
      if (paid === 'credit') {
        where.push(`(${creditExpr})`);
      } else {
        where.push(`NOT (${creditExpr})`);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const paidExpr = [
      hasPurchaseType ? "LOWER(f.purchase_type) = 'credit'" : null,
      hasPaymentType ? "LOWER(f.payment_type) = 'credit'" : null,
    ].filter(Boolean).join(" OR ") || "FALSE";

    const sql = `
      SELECT 
        s.id AS supplier_id,
        s.name AS supplier_name,
        COUNT(f.id) AS purchased_count,
        SUM(CASE WHEN f.status = 'sold' THEN 1 ELSE 0 END) AS sold_count,
        SUM(CASE WHEN f.status <> 'sold' OR f.status IS NULL THEN 1 ELSE 0 END) AS available_count,
        COALESCE(SUM(f.purchase_price), 0) AS total_purchase_cost,
        SUM(CASE WHEN (${paidExpr}) THEN 1 ELSE 0 END) AS credit_items,
        SUM(CASE WHEN NOT (${paidExpr}) THEN 1 ELSE 0 END) AS paid_items,
        MIN(f.purchase_date) AS first_purchase_date,
        MAX(f.purchase_date) AS last_purchase_date
      FROM suppliers s
      LEFT JOIN fastags f ON f.supplier_id = s.id
      ${whereSql}
      GROUP BY s.id, s.name
      ORDER BY s.name ASC`;

    const [rows]: any = await pool.query(sql, vals);
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load supplier summary' }, { status: 500 });
  }
}

