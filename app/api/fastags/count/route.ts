// app/api/fastags/count/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const bank = url.searchParams.get("bank");
  const fastag_class = url.searchParams.get("class");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!bank || !fastag_class || !start || !end) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM fastags
     WHERE bank_name = ? AND fastag_class = ? AND tag_serial BETWEEN ? AND ? AND status = 'in_stock'`,
    [bank, fastag_class, start, end]
  );
  return NextResponse.json({ count: rows[0]?.count ?? 0 });
}
