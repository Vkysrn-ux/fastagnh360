import { pool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, context: { params: any }) {
  const { id } = context.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id = ? AND role = 'agent'",
      [id]
    );
    if ((rows as any[]).length === 0) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json((rows as any[])[0]);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch agent" }, { status: 500 });
  }
}
