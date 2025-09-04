import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        child.id,
        child.name,
        child.phone,
        child.pincode,
        child.status,
        child.role,
        child.parent_user_id,
        (
          SELECT COUNT(*)
          FROM fastags f
          WHERE f.assigned_to = child.id AND f.status = 'assigned'
        ) AS fastags_available,
        parent.name AS parent_name,
        parent.role AS parent_role
      FROM users child
      LEFT JOIN users parent ON child.parent_user_id = parent.id
      WHERE child.role IN (
        'admin', 'asm', 'manager', 'team-leader', 'tl', 'shop', 'showroom', 'agent', 'toll-agent', 'executive'
      )
      ORDER BY child.id DESC
    `);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
