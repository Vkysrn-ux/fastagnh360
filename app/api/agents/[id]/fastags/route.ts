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
      `SELECT id, tag_serial, fastag_class, batch_number, status
       FROM fastags 
       WHERE assigned_to_agent_id = ?`,
      [agentId]
    );
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch FASTags" }, { status: 500 });
  }
}
