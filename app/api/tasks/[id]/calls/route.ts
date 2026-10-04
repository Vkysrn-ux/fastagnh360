// app/api/tasks/[id]/calls/route.ts
// Log an incoming/outgoing call against a task card. A note is mandatory.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { cleanPhone, ensureTaskTables, logTaskActivity, requireStaff } from "@/lib/tasks";
import { CALLER_TYPES } from "@/lib/task-constants";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  if (s instanceof NextResponse) return s;
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    await ensureTaskTables();
    const b = await req.json().catch(() => ({}));
    const note = String(b.note || "").trim();
    const callerType = String(b.caller_type || "").trim();
    if (!note) return NextResponse.json({ error: "Add a note about the call" }, { status: 400 });
    if (!CALLER_TYPES.some((c) => c.key === callerType)) return NextResponse.json({ error: "Select who is calling" }, { status: 400 });

    const [rows]: any = await pool.query(`SELECT id FROM task_cards WHERE id = ?`, [id]);
    if (!rows?.[0]) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    await logTaskActivity({
      cardId: id, kind: "call", actorId: s.id, note,
      callerType, callerPhone: cleanPhone(b.caller_phone),
      purpose: String(b.purpose || "").trim() || null,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to log call" }, { status: 500 });
  }
}
