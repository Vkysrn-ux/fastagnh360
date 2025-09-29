import { pool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = Number(id);
  if (!agentId || isNaN(agentId)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id = ?",
      [agentId]
    );
    if ((rows as any[]).length === 0) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json((rows as any[])[0]);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch agent" }, { status: 500 });
  }
}
