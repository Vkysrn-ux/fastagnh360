import { pool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = Number(id);
  if (!agentId || isNaN(agentId)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  try {
    // Basic summary: counts of assigned and sold tags
    const [[assigned]]: any = await pool.query(
      "SELECT COUNT(*) AS cnt FROM fastags WHERE assigned_to_agent_id = ? AND status = 'assigned'",
      [agentId]
    );
    const [[sold]]: any = await pool.query(
      "SELECT COUNT(*) AS cnt FROM fastag_sales WHERE sold_by_user_id = ? OR sold_by_agent_id = ?",
      [agentId, agentId]
    );
    return NextResponse.json({ assigned: Number(assigned?.cnt || 0), sold: Number(sold?.cnt || 0) });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}
