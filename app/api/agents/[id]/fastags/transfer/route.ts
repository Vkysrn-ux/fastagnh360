// app/api/fastags/transfer/route.ts

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { from_agent_id, to_agent_id, class_type, batch_number } = await req.json();

    if (!from_agent_id || !to_agent_id || !class_type || !batch_number) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get eligible FASTags from from_agent_id
    const [rows] = await pool.query(
      `SELECT id FROM fastags WHERE assigned_to_agent_id = ? AND fastag_class = ? AND batch_number = ? AND status = 'assigned'`,
      [from_agent_id, class_type, batch_number]
    );

    const fastags = rows as { id: number }[];

    if (fastags.length === 0) {
      return NextResponse.json({ error: "No matching FASTags found for transfer." }, { status: 404 });
    }

    // Update the agent assignment
    const ids = fastags.map(tag => tag.id);
    await pool.query(
      `UPDATE fastags SET assigned_to_agent_id = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
      [to_agent_id, ...ids]
    );

    return NextResponse.json({ success: true, transferred: ids.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
