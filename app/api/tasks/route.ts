// app/api/tasks/route.ts
// Task Board: list and create cards.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { CARD_SELECT, cleanPhone, ensureTaskTables, logTaskActivity, requireStaff } from "@/lib/tasks";
import { pushToUser } from "@/lib/push";
import { ALL_STAGE_KEYS, CALLER_TYPES, STALE_HOURS, TASK_PURPOSES, normalizeVrn } from "@/lib/task-constants";

// GET /api/tasks
//   ?stage=open (default: everything not done/cancelled) | all | <stage key>
//   ?assigned=me | <user id> | none
//   ?stuck=1          only cards with a stuck reason
//   ?stale=1          only open cards with no activity for STALE_HOURS
//   ?q=<vrn or phone> partial match
export async function GET(req: NextRequest) {
  const s = await requireStaff();
  if (s instanceof NextResponse) return s;
  try {
    await ensureTaskTables();
    const sp = new URL(req.url).searchParams;
    const where: string[] = [];
    const params: any[] = [];

    const stage = sp.get("stage") || "open";
    if (stage === "open") where.push(`c.stage NOT IN ('done','cancelled')`);
    else if (stage !== "all" && ALL_STAGE_KEYS.includes(stage)) { where.push(`c.stage = ?`); params.push(stage); }

    const assigned = sp.get("assigned");
    if (assigned === "me") { where.push(`c.assigned_to = ?`); params.push(s.id); }
    else if (assigned === "none") where.push(`c.assigned_to IS NULL`);
    else if (assigned && Number(assigned) > 0) { where.push(`c.assigned_to = ?`); params.push(Number(assigned)); }

    if (sp.get("stuck") === "1") where.push(`c.stuck_reason IS NOT NULL`);
    if (sp.get("stale") === "1") {
      where.push(`c.stage NOT IN ('done','cancelled') AND c.last_activity_at < NOW() - INTERVAL ? HOUR`);
      params.push(STALE_HOURS);
    }

    const q = (sp.get("q") || "").trim();
    if (q) {
      const vrn = normalizeVrn(q);
      const phone = cleanPhone(q);
      const ors: string[] = [];
      if (vrn) { ors.push(`c.vehicle_reg_no LIKE ?`); params.push(`%${vrn}%`); }
      if (phone && phone.length >= 4) {
        ors.push(`c.caller_phone LIKE ? OR c.customer_phone LIKE ?`);
        params.push(`%${phone}%`, `%${phone}%`);
      }
      if (ors.length) where.push(`(${ors.join(" OR ")})`);
    }

    const [rows] = await pool.query(
      `${CARD_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY (c.stuck_reason IS NOT NULL) DESC, c.last_activity_at ASC
       LIMIT 500`,
      params
    );
    return NextResponse.json(rows || []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load tasks" }, { status: 500 });
  }
}

// POST /api/tasks
// Body: { vehicle_reg_no, purpose, caller_type, caller_name?, caller_phone?, customer_name?,
//         customer_phone?, assigned_to?, ticket_id?, note, force? }
// Returns 409 with the existing open cards for this VRN unless force=true.
export async function POST(req: NextRequest) {
  const s = await requireStaff();
  if (s instanceof NextResponse) return s;
  try {
    await ensureTaskTables();
    const b = await req.json().catch(() => ({}));
    const vrn = normalizeVrn(b.vehicle_reg_no);
    const purpose = String(b.purpose || "").trim();
    const callerType = String(b.caller_type || "").trim();
    const note = String(b.note || "").trim();

    if (vrn.length < 4) return NextResponse.json({ error: "Enter a valid vehicle number" }, { status: 400 });
    if (!(TASK_PURPOSES as readonly string[]).includes(purpose)) return NextResponse.json({ error: "Select a purpose" }, { status: 400 });
    if (!CALLER_TYPES.some((c) => c.key === callerType)) return NextResponse.json({ error: "Select who is calling" }, { status: 400 });
    if (!note) return NextResponse.json({ error: "Add a note about the call" }, { status: 400 });

    if (!b.force) {
      const [open]: any = await pool.query(
        `${CARD_SELECT} WHERE c.vehicle_reg_no = ? AND c.stage NOT IN ('done','cancelled') ORDER BY c.created_at DESC`,
        [vrn]
      );
      if (Array.isArray(open) && open.length > 0) {
        return NextResponse.json({ error: "This vehicle already has an open task", existing: open }, { status: 409 });
      }
    }

    const callerPhone = cleanPhone(b.caller_phone);
    const assignedTo = Number(b.assigned_to) > 0 ? Number(b.assigned_to) : null;
    const ticketId = Number(b.ticket_id) > 0 ? Number(b.ticket_id) : null;

    const [res]: any = await pool.query(
      `INSERT INTO task_cards
         (vehicle_reg_no, ticket_id, customer_name, customer_phone, caller_type, caller_name, caller_phone,
          purpose, stage, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
      [
        vrn, ticketId, String(b.customer_name || "").trim() || null, cleanPhone(b.customer_phone),
        callerType, String(b.caller_name || "").trim() || null, callerPhone,
        purpose, assignedTo, s.id || null,
      ]
    );
    const id = Number(res.insertId);
    await logTaskActivity({
      cardId: id, kind: "create", actorId: s.id, note,
      callerType, callerPhone, purpose,
    });
    if (assignedTo) {
      const [u]: any = await pool.query(`SELECT name FROM users WHERE id = ?`, [assignedTo]);
      await logTaskActivity({ cardId: id, kind: "assign", actorId: s.id, to: u?.[0]?.name || String(assignedTo) });
      if (assignedTo !== s.id) {
        await pushToUser(assignedTo, {
          title: `📋 New task assigned: ${vrn}`,
          body: `${purpose} · from ${s.name || "staff"}${note ? ` · ${note.slice(0, 80)}` : ""}`,
          data: { type: "task", id: String(id) },
        });
      }
    }
    return NextResponse.json({ id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create task" }, { status: 500 });
  }
}
