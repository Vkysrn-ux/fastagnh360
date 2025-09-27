import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = Number(id);
  if (!Number.isFinite(agentId) || agentId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const [rows] = await pool.query(
      `SELECT 
         COALESCE(bank_name, '') AS bank_name,
         COALESCE(fastag_class, '') AS fastag_class,
         COUNT(*) AS available
       FROM fastags
       WHERE assigned_to_agent_id = ? AND status = 'assigned'
       GROUP BY bank_name, fastag_class
       ORDER BY bank_name, fastag_class`,
      [agentId]
    );
    return NextResponse.json(rows || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
