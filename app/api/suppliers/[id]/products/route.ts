import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  // Await params if it's a Promise (dynamic route quirk)
  const params = typeof context.params.then === "function"
    ? await context.params
    : context.params;

  const supplierId = params.id;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM fastags WHERE supplier_id = ? ORDER BY created_at DESC",
      [supplierId]
    );
    console.log(rows);
    return NextResponse.json(rows);
  } catch (error: any) {

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
