import { pool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, context: { params: any }) {
  const { id } = context.params;

  try {
    const [rows] = await pool.query(
      `SELECT id, tag_serial, fastag_class, batch_number, status
       FROM fastags 
       WHERE assigned_to_agent_id = ?`,
      [id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch FASTags" }, { status: 500 });
  }
}
