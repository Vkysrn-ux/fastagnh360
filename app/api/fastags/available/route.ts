// app/api/fastags/available/route.ts
import { pool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bank = searchParams.get("bank");
  const fastagClass = searchParams.get("class");
  const assignedTo = searchParams.get("assigned_to");

  if (!bank || !fastagClass) {
    return NextResponse.json([], { status: 200 });
  }

  let sql = "SELECT tag_serial FROM fastags WHERE bank_name = ? AND fastag_class = ? ";
  let params = [bank, fastagClass];

  if (assignedTo && assignedTo !== "admin") {
    sql += "AND assigned_to = ? AND status = 'assigned' ORDER BY tag_serial ASC";
    params.push(Number(assignedTo));
  } else {
    // Admin warehouse
    sql += "AND assigned_to IS NULL AND status = 'in_stock' ORDER BY tag_serial ASC";
  }

  try {
    const [rows] = await pool.query(sql, params);
    return NextResponse.json(rows, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
