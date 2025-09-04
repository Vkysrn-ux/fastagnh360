import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const [rows] = await pool.query(`
      SELECT f.*, u.name AS agent_name
      FROM fastags f
      LEFT JOIN users u ON f.assigned_to = u.id AND u.role = 'agent'
        `);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("FASTags API error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
