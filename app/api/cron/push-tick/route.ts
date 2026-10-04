// app/api/cron/push-tick/route.ts
// Called every minute by cron on Server 2: GET /api/cron/push-tick?token=<CRON_SECRET or API_KEY>
//  1. ticket assigned / closed (detected by comparing with ticket_push_state, so changes made
//     from the website, the WhatsApp bot or the API are all caught) -> push to that user
//  2. 10:00-19:00 IST, Mon-Sat, once a day per user: tickets/tasks pending > 24h, task follow-ups due,
//     and a team summary for super admins
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { CLOSED_TICKET_SQL } from "@/lib/mobile-api";
import { ensurePushTables, pushOnce, pushToUser } from "@/lib/push";
import { ensureTaskTables } from "@/lib/tasks";

const REMIND_FROM_HOUR = 10; // IST
const REMIND_UNTIL_HOUR = 19;
const SUPER_ROLES = ["super", "super-admin", "super_admin", "super admin", "superadmin"];

function ist() {
  const d = new Date(Date.now() + 330 * 60_000);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours(), weekday: d.getUTCDay() };
}

const label = (t: any) =>
  [t.ticket_no || `#${t.id}`, t.vehicle_reg_no, t.subject].filter(Boolean).join(" · ");

async function ticketChanges() {
  const [[{ n }]]: any = await pool.query(`SELECT COUNT(*) AS n FROM ticket_push_state`);
  if (Number(n) === 0) {
    // First run: remember the current state, notify nobody
    await pool.query(
      `INSERT IGNORE INTO ticket_push_state (ticket_id, assigned_to, closed)
       SELECT t.id, t.assigned_to, (${CLOSED_TICKET_SQL}) FROM tickets_nh t`
    );
    return { seeded: true, assigned: 0, closed: 0 };
  }
  const [rows]: any = await pool.query(
    `SELECT t.id, t.ticket_no, t.vehicle_reg_no, t.subject, t.status, t.assigned_to, t.created_by,
            (${CLOSED_TICKET_SQL}) AS closed_now,
            s.ticket_id AS known, s.assigned_to AS prev_assigned, s.closed AS prev_closed
       FROM tickets_nh t
       LEFT JOIN ticket_push_state s ON s.ticket_id = t.id
      WHERE s.ticket_id IS NULL
         OR COALESCE(t.updated_at, t.created_at) >= NOW() - INTERVAL 15 MINUTE`
  );
  let assigned = 0, closed = 0;
  for (const t of rows || []) {
    const closedNow = Number(t.closed_now) === 1;
    const prevAssigned = t.known ? t.prev_assigned : null;
    if (t.assigned_to && t.assigned_to !== prevAssigned && !closedNow) {
      await pushToUser(t.assigned_to, {
        title: "🎫 Ticket assigned to you",
        body: label(t),
        data: { type: "ticket", id: String(t.id) },
      });
      assigned++;
    }
    if (t.known && closedNow && Number(t.prev_closed) !== 1) {
      const people = new Set([t.created_by, t.assigned_to].filter((x: any) => Number(x) > 0).map(Number));
      for (const uid of people) {
        await pushToUser(uid, {
          title: "✅ Ticket closed",
          body: `${label(t)} · ${String(t.status || "").replace("_", " ")}`,
          data: { type: "ticket", id: String(t.id) },
        });
      }
      closed++;
    }
    await pool.query(
      `INSERT INTO ticket_push_state (ticket_id, assigned_to, closed) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE assigned_to = VALUES(assigned_to), closed = VALUES(closed)`,
      [t.id, t.assigned_to ?? null, closedNow ? 1 : 0]
    );
  }
  return { seeded: false, assigned, closed };
}

async function dailyReminders(date: string) {
  const counts = new Map<number, { tickets: number; tasks: number }>();
  const [tk]: any = await pool.query(
    `SELECT t.assigned_to AS uid, COUNT(*) AS n FROM tickets_nh t
      WHERE t.assigned_to IS NOT NULL AND NOT ${CLOSED_TICKET_SQL}
        AND COALESCE(t.updated_at, t.created_at) < NOW() - INTERVAL 24 HOUR
      GROUP BY t.assigned_to`
  );
  const [ts]: any = await pool.query(
    `SELECT assigned_to AS uid, COUNT(*) AS n FROM task_cards
      WHERE assigned_to IS NOT NULL AND stage NOT IN ('done','cancelled')
        AND last_activity_at < NOW() - INTERVAL 24 HOUR
      GROUP BY assigned_to`
  );
  for (const r of tk || []) counts.set(Number(r.uid), { tickets: Number(r.n), tasks: 0 });
  for (const r of ts || []) {
    const c = counts.get(Number(r.uid)) || { tickets: 0, tasks: 0 };
    c.tasks = Number(r.n);
    counts.set(Number(r.uid), c);
  }
  let sent = 0;
  for (const [uid, c] of counts) {
    const parts = [c.tickets && `${c.tickets} ticket${c.tickets > 1 ? "s" : ""}`, c.tasks && `${c.tasks} task${c.tasks > 1 ? "s" : ""}`].filter(Boolean);
    if (await pushOnce(`remind:${date}:${uid}`, uid, {
      title: "⏰ Pending for more than a day",
      body: `You have ${parts.join(" and ")} with no update for over 24 hours. Tap to view.`,
      data: { type: c.tasks && !c.tickets ? "tasks" : "tickets", filter: "stale" },
    })) sent++;
  }

  // Follow-up dates set when a task was marked stuck
  const [fu]: any = await pool.query(
    `SELECT id, vehicle_reg_no, assigned_to, next_action, stuck_reason FROM task_cards
      WHERE assigned_to IS NOT NULL AND stage NOT IN ('done','cancelled')
        AND follow_up_date IS NOT NULL AND follow_up_date <= ?`,
    [date]
  );
  for (const f of fu || []) {
    if (await pushOnce(`followup:${f.id}:${date}`, f.assigned_to, {
      title: `📞 Follow up today: ${f.vehicle_reg_no}`,
      body: f.next_action || f.stuck_reason || "Follow-up date reached",
      data: { type: "task", id: String(f.id) },
    })) sent++;
  }

  // Team summary for super admins
  const totalTickets = [...counts.values()].reduce((a, c) => a + c.tickets, 0);
  const totalTasks = [...counts.values()].reduce((a, c) => a + c.tasks, 0);
  const [[stuck]]: any = await pool.query(
    `SELECT COUNT(*) AS n FROM task_cards WHERE stuck_reason IS NOT NULL AND stage NOT IN ('done','cancelled')`
  );
  if (totalTickets || totalTasks || Number(stuck.n)) {
    const [admins]: any = await pool.query(
      `SELECT id FROM users WHERE LOWER(role) IN (${SUPER_ROLES.map(() => "?").join(",")})
         AND LOWER(COALESCE(status,'active')) = 'active'`,
      SUPER_ROLES
    );
    for (const a of admins || []) {
      if (await pushOnce(`adminsum:${date}:${a.id}`, a.id, {
        title: "📊 Team pending today",
        body: `${totalTickets} tickets and ${totalTasks} tasks pending over 24h across ${counts.size} staff; ${stuck.n} tasks stuck.`,
        data: { type: "team" },
      })) sent++;
    }
  }
  return sent;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const validKey = process.env.CRON_SECRET || process.env.API_KEY;
  if (!validKey || token !== validKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensurePushTables();
    await ensureTaskTables();
    const tickets = await ticketChanges();
    const { date, hour, weekday } = ist();
    let reminders = 0;
    if (weekday >= 1 && weekday <= 6 && hour >= REMIND_FROM_HOUR && hour < REMIND_UNTIL_HOUR) {
      reminders = await dailyReminders(date);
    }
    return NextResponse.json({ ok: true, tickets, reminders, ist: { date, hour } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "push tick failed" }, { status: 500 });
  }
}
