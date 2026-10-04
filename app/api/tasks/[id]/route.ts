// app/api/tasks/[id]/route.ts
// Task Board: read one card with its full activity history, and update it.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { CARD_SELECT, cleanPhone, ensureTaskTables, logTaskActivity, requireStaff } from "@/lib/tasks";
import { ALL_STAGE_KEYS, STUCK_REASONS, TASK_CHECKS, stageLabel } from "@/lib/task-constants";

type Ctx = { params: Promise<{ id: string }> };

async function loadCard(id: number) {
  const [rows]: any = await pool.query(`${CARD_SELECT} WHERE c.id = ?`, [id]);
  return rows?.[0] ?? null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const s = await requireStaff();
  if (s instanceof NextResponse) return s;
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    await ensureTaskTables();
    const card = await loadCard(id);
    if (!card) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const [activity] = await pool.query(
      `SELECT a.*, COALESCE(u.name, '') AS actor_name
         FROM task_activity a
         LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.card_id = ?
        ORDER BY a.created_at DESC, a.id DESC`,
      [id]
    );
    return NextResponse.json({ card, activity: activity || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load task" }, { status: 500 });
  }
}

// PATCH /api/tasks/:id
// Any subset of: { stage, assigned_to, kyc_done, kyv_done, payment_done, delivery_done, commission_done,
//                  stuck_reason (null to clear), next_action, follow_up_date, customer_name, customer_phone,
//                  ticket_id, note }
// Marking stuck or clearing stuck requires a note. Every change is written to task_activity.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const s = await requireStaff();
  if (s instanceof NextResponse) return s;
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    await ensureTaskTables();
    const card = await loadCard(id);
    if (!card) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const b = await req.json().catch(() => ({}));
    const note = String(b.note || "").trim() || null;

    const sets: string[] = [];
    const vals: any[] = [];
    const logs: Parameters<typeof logTaskActivity>[0][] = [];
    const set = (col: string, val: any) => { sets.push(`${col} = ?`); vals.push(val); };

    if (b.stage !== undefined && b.stage !== card.stage) {
      const stage = String(b.stage);
      if (!ALL_STAGE_KEYS.includes(stage)) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      set("stage", stage);
      const closing = stage === "done" || stage === "cancelled";
      sets.push(closing ? "closed_at = NOW()" : "closed_at = NULL");
      if (closing && card.stuck_reason) set("stuck_reason", null);
      logs.push({ cardId: id, kind: "stage", actorId: s.id, from: stageLabel(card.stage), to: stageLabel(stage), note });
    }

    if (b.assigned_to !== undefined) {
      const to = Number(b.assigned_to) > 0 ? Number(b.assigned_to) : null;
      if (to !== (card.assigned_to ?? null)) {
        set("assigned_to", to);
        let toName = "Unassigned";
        if (to) {
          const [u]: any = await pool.query(`SELECT name FROM users WHERE id = ?`, [to]);
          toName = u?.[0]?.name || String(to);
        }
        logs.push({ cardId: id, kind: "assign", actorId: s.id, from: card.assigned_to_name || "Unassigned", to: toName, note });
      }
    }

    for (const c of TASK_CHECKS) {
      if (b[c.key] === undefined) continue;
      const v = b[c.key] ? 1 : 0;
      if (v !== Number(card[c.key])) {
        set(c.key, v);
        logs.push({ cardId: id, kind: "check", actorId: s.id, from: c.label, to: v ? "Done" : "Not done" });
      }
    }

    if (b.stuck_reason !== undefined) {
      const reason = b.stuck_reason ? String(b.stuck_reason) : null;
      if (reason && !(STUCK_REASONS as readonly string[]).includes(reason)) {
        return NextResponse.json({ error: "Invalid stuck reason" }, { status: 400 });
      }
      if (reason !== (card.stuck_reason ?? null)) {
        if (!note) return NextResponse.json({ error: reason ? "Explain why it is stuck" : "Add a note on how it was resolved" }, { status: 400 });
        set("stuck_reason", reason);
        logs.push(reason
          ? { cardId: id, kind: "stuck", actorId: s.id, to: reason, note }
          : { cardId: id, kind: "unstuck", actorId: s.id, from: card.stuck_reason, note });
      }
    }

    if (b.next_action !== undefined) {
      const v = String(b.next_action || "").trim().slice(0, 255) || null;
      if (v !== (card.next_action ?? null)) {
        set("next_action", v);
        logs.push({ cardId: id, kind: "edit", actorId: s.id, from: "Next action", to: v || "(cleared)" });
      }
    }

    if (b.follow_up_date !== undefined) {
      const v = /^\d{4}-\d{2}-\d{2}$/.test(String(b.follow_up_date || "")) ? String(b.follow_up_date) : null;
      const cur = card.follow_up_date ? new Date(card.follow_up_date).toLocaleDateString("en-CA") : null;
      if (v !== cur) {
        set("follow_up_date", v);
        logs.push({ cardId: id, kind: "edit", actorId: s.id, from: "Follow-up date", to: v || "(cleared)" });
      }
    }

    if (b.customer_name !== undefined) set("customer_name", String(b.customer_name || "").trim() || null);
    if (b.customer_phone !== undefined) set("customer_phone", cleanPhone(b.customer_phone));
    if (b.ticket_id !== undefined) {
      const t = Number(b.ticket_id) > 0 ? Number(b.ticket_id) : null;
      if (t !== (card.ticket_id ?? null)) {
        set("ticket_id", t);
        logs.push({ cardId: id, kind: "edit", actorId: s.id, from: "Linked ticket", to: t ? `#${t}` : "(removed)" });
      }
    }

    if (sets.length === 0 && !note) return NextResponse.json({ card });
    if (sets.length > 0) {
      await pool.query(`UPDATE task_cards SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
    }
    // A note that wasn't attached to a stage/assign/stuck change is saved as a plain note
    const noteUsed = logs.some((l) => l.note);
    if (note && !noteUsed) logs.push({ cardId: id, kind: "note", actorId: s.id, note });
    for (const l of logs) await logTaskActivity(l);

    return NextResponse.json({ card: await loadCard(id) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to update task" }, { status: 500 });
  }
}
