import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const supplier = (searchParams.get('supplier') || '').trim();

  try {
    let sql = "SELECT DISTINCT COALESCE(bank_name,'') AS bank_name FROM fastags";
    const where: string[] = [];
    const params: any[] = [];
    if (supplier) { where.push("COALESCE(supplier_id,0) = ?"); params.push(Number(supplier)); }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += " ORDER BY bank_name";
    const [rows] = await pool.query(sql, params);
    const names = (rows as any[]).map(r => String(r.bank_name || '')).filter(Boolean);
    return NextResponse.json(names);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

