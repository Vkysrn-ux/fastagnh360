// /app/api/fastag/assign-one/route.ts

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { tag_serial, agent_id } = await req.json();

  if (!tag_serial || !agent_id) {
    return NextResponse.json({ error: "Missing tag_serial or agent_id" }, { status: 400 });
  }

  try {
    await pool.query(
      `UPDATE fastags 
       SET status = 'assigned', 
           assigned_to = ?, 
           assigned_at = NOW()
       WHERE tag_serial = ?`,
      [agent_id, tag_serial]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
