// app/api/pickup-points/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Returns a combined list of pickup points from users table.
// Previously this endpoint only included a subset of roles
// (agent, toll-agent, shop, office). To ensure the Pick-up Point
// search can find everything that "Lead Received From" can, we
// now include all users by default, with an optional roles filter.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = (searchParams.get("name") ?? "").trim();
    const rolesParam = (searchParams.get("roles") ?? "").trim();

    // Base query now includes all roles; callers may optionally
    // pass a comma-separated "roles" param to narrow results.
    let sql = `SELECT id, name, role FROM users WHERE 1`;
    const params: any[] = [];
    if (rolesParam) {
      const list = rolesParam.split(',').map(r => r.trim()).filter(Boolean);
      if (list.length) {
        sql += ` AND role IN (${list.map(() => '?').join(',')})`;
        params.push(...list);
      }
    }
    if (name) {
      sql += ` AND name LIKE ?`;
      params.push(`%${name}%`);
    }
    sql += ` ORDER BY name LIMIT 20`;

    const [rows]: any = await pool.query(sql, params);
    const mapped = (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.role === 'office' ? 'warehouse' : r.role,
    }));
    return NextResponse.json(mapped);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
