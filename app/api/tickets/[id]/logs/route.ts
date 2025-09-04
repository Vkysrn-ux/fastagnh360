// app/api/tickets/[id]/logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const [rows] = await pool.query(
      `SELECT l.id, l.action, l.actor_id, u.name AS actor_name, l.meta, l.ip, l.user_agent, l.created_at
       FROM ticket_logs l
       LEFT JOIN users u ON l.actor_id = u.id
       WHERE l.ticket_id = ?
       ORDER BY l.created_at ASC, l.id ASC`,
      [id]
    );
    return NextResponse.json(rows || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

