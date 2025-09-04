import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        f.id,
        f.tag_serial,
        f.status,
        CASE
          WHEN f.status = 'sold' THEN 'User'
          WHEN f.assigned_to_agent_id IS NOT NULL THEN 'Agent'
          ELSE 'Admin'
        END AS holder,
        f.assigned_to_agent_id,
        f.assigned_to_user_id,
        f.purchase_price,
        f.sale_price,
        f.purchase_date,
        f.assigned_date
      FROM fastags f
      ORDER BY f.created_at DESC
    `);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Failed to fetch FASTag inventory:", err);
    return NextResponse.json({ error: "Failed to fetch FASTag inventory" }, { status: 500 });
  }
}
