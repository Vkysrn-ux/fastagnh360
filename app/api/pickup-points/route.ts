// app/api/pickup-points/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Returns a combined list of pickup points from users table
// Roles considered: agent, toll-agent, shop, office
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = (searchParams.get("name") ?? "").trim();

    let sql = `SELECT id, name, role FROM users WHERE role IN ('agent','toll-agent','shop','office')`;
    const params: any[] = [];
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
