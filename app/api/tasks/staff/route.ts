// app/api/tasks/staff/route.ts
// Everyone a task can be assigned to: active admins, super admins and employees.
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireStaff } from "@/lib/tasks";

export async function GET() {
  const s = await requireStaff();
  if (s instanceof NextResponse) return s;
  try {
    const [rows] = await pool.query(
      `SELECT id, name FROM users
        WHERE LOWER(role) IN ('admin','administrator','super','super-admin','super_admin','super admin','superadmin','employee')
          AND LOWER(COALESCE(status,'active')) = 'active'
        ORDER BY name`
    );
    return NextResponse.json({ me: s.id, staff: rows || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load staff" }, { status: 500 });
  }
}
