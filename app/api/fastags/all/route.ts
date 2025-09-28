import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        f.*,
        f.created_at,
        f.assigned_at,
        f.assigned_date,
        (SELECT MIN(fs.created_at) FROM fastag_sales fs WHERE fs.tag_serial = f.tag_serial) AS sold_at,
        COALESCE(u.name, '') AS agent_name
      FROM fastags f
      LEFT JOIN users u ON f.assigned_to_agent_id = u.id
    `);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("FASTags API error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
