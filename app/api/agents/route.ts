import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function GET() {
  try {
    // Build fastags_available subquery based on available columns
    const canAssignedTo = await hasTableColumn('fastags', 'assigned_to').catch(() => false);
    const canAssignedToAgent = await hasTableColumn('fastags', 'assigned_to_agent_id').catch(() => false);
    let fastagsAvailableExpr = '0';
    if (canAssignedToAgent && canAssignedTo) {
      fastagsAvailableExpr = `(
        SELECT COUNT(*) FROM fastags f
         WHERE (f.assigned_to_agent_id = child.id OR f.assigned_to = child.id)
           AND f.status = 'assigned'
      )`;
    } else if (canAssignedToAgent) {
      fastagsAvailableExpr = `(
        SELECT COUNT(*) FROM fastags f
         WHERE f.assigned_to_agent_id = child.id AND f.status = 'assigned'
      )`;
    } else if (canAssignedTo) {
      fastagsAvailableExpr = `(
        SELECT COUNT(*) FROM fastags f
         WHERE f.assigned_to = child.id AND f.status = 'assigned'
      )`;
    }

    const sql = `
      SELECT
        child.id,
        child.name,
        child.phone,
        child.pincode,
        child.status,
        child.role,
        child.parent_user_id,
        ${fastagsAvailableExpr} AS fastags_available,
        parent.name AS parent_name,
        parent.role AS parent_role
      FROM users child
      LEFT JOIN users parent ON child.parent_user_id = parent.id
      WHERE child.role IN (
        'admin', 'asm', 'manager', 'team-leader', 'tl', 'shop', 'showroom', 'agent', 'toll-agent', 'executive'
      )
      ORDER BY child.id DESC`;

    const [rows] = await pool.query(sql);
    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch agents" }, { status: 500 });
  }
}
