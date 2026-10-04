// lib/mobile-api.ts
// Shared helpers for /api/mobile/* routes.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { MobileUser, getMobileUser } from "@/lib/mobile-auth";
import { STALE_HOURS } from "@/lib/task-constants";
import { ensureTaskTables } from "@/lib/tasks";

export async function requireMobile(req: NextRequest): Promise<MobileUser | NextResponse> {
  try {
    const u = await getMobileUser(req.headers.get("authorization"));
    if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return u;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Auth failed" }, { status: 500 });
  }
}

/** Employees may only look at themselves; admins may look at anyone via ?user_id=. */
export function targetUserId(me: MobileUser, req: NextRequest): number | NextResponse {
  const raw = new URL(req.url).searchParams.get("user_id");
  if (!raw || Number(raw) === me.id) return me.id;
  if (me.userType !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : NextResponse.json({ error: "Invalid user_id" }, { status: 400 });
}

// Ticket statuses that count as finished (tickets_nh.status is free text in older rows)
export const CLOSED_TICKET_SQL = `LOWER(TRIM(COALESCE(t.status,''))) IN
  ('completed','closed','cancelled','cust cancelled','done','activated','resolved')`;

// Per-ticket pending flags, same rules as /api/reports/tickets/admin-pending-reasons
export const TICKET_FLAGS_SQL = `
  (COALESCE(t.payment_received,0) = 1 OR COALESCE(t.payment_nil,0) = 1) AS payment_ok,
  (COALESCE(t.delivery_done,0) = 1 OR COALESCE(t.delivery_nil,0) = 1) AS delivery_ok,
  (COALESCE(t.lead_commission_paid,0) = 1 OR COALESCE(t.lead_commission_nil,0) = 1) AS commission_ok,
  (LOWER(COALESCE(t.kyv_status,'')) LIKE '%compliant%' OR LOWER(COALESCE(t.kyv_status,'')) LIKE '%success%'
     OR LOWER(COALESCE(t.kyv_status,'')) = 'nil') AS kyv_ok
`;

const ticketScope = `(t.assigned_to = ? OR t.created_by = ?)`;

export async function userSummary(userId: number) {
  await ensureTaskTables();
  const [[tasks]]: any = await pool.query(
    `SELECT
       COUNT(*) AS open,
       COALESCE(SUM(stuck_reason IS NOT NULL), 0) AS stuck,
       COALESCE(SUM(last_activity_at < NOW() - INTERVAL ? HOUR), 0) AS no_update,
       COALESCE(SUM(follow_up_date IS NOT NULL AND follow_up_date <= CURDATE()), 0) AS follow_up_due
     FROM task_cards
     WHERE assigned_to = ? AND stage NOT IN ('done','cancelled')`,
    [STALE_HOURS, userId]
  );
  const [byStage]: any = await pool.query(
    `SELECT stage, COUNT(*) AS n FROM task_cards
      WHERE assigned_to = ? AND stage NOT IN ('done','cancelled') GROUP BY stage`,
    [userId]
  );
  const [[doneToday]]: any = await pool.query(
    `SELECT COUNT(*) AS n FROM task_cards WHERE assigned_to = ? AND stage = 'done' AND closed_at >= CURDATE()`,
    [userId]
  );

  let tickets: any = { open: 0, payment_pending: 0, delivery_pending: 0, kyv_pending: 0, commission_pending: 0 };
  try {
    const [[t]]: any = await pool.query(
      `SELECT COUNT(*) AS open,
              COALESCE(SUM(NOT payment_ok), 0) AS payment_pending,
              COALESCE(SUM(NOT delivery_ok), 0) AS delivery_pending,
              COALESCE(SUM(NOT kyv_ok), 0) AS kyv_pending,
              COALESCE(SUM(NOT commission_ok), 0) AS commission_pending
         FROM (SELECT ${TICKET_FLAGS_SQL} FROM tickets_nh t
                WHERE ${ticketScope} AND NOT ${CLOSED_TICKET_SQL}) x`,
      [userId, userId]
    );
    tickets = t;
  } catch {}

  const num = (o: any) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Number(v) || 0]));
  return {
    tasks: {
      ...num(tasks),
      done_today: Number(doneToday?.n) || 0,
      by_stage: Object.fromEntries((byStage || []).map((r: any) => [r.stage, Number(r.n)])),
    },
    tickets: num(tickets),
  };
}
