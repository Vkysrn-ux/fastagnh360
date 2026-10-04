// lib/tasks.ts
// Server helpers for the Task Board. Uses its own tables only (task_cards, task_activity);
// tickets_nh is read, never written.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { getUserSession } from "@/lib/getSession";
import { getMobileUser } from "@/lib/mobile-auth";

let tablesReady = false;

export async function ensureTaskTables() {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_cards (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      vehicle_reg_no   VARCHAR(64)   NOT NULL,
      ticket_id        INT           NULL,
      customer_name    VARCHAR(255)  NULL,
      customer_phone   VARCHAR(32)   NULL,
      caller_type      VARCHAR(16)   NULL,
      caller_name      VARCHAR(255)  NULL,
      caller_phone     VARCHAR(32)   NULL,
      purpose          VARCHAR(64)   NOT NULL,
      stage            VARCHAR(32)   NOT NULL DEFAULT 'new',
      assigned_to      INT           NULL,
      kyc_done         TINYINT(1)    NOT NULL DEFAULT 0,
      kyv_done         TINYINT(1)    NOT NULL DEFAULT 0,
      payment_done     TINYINT(1)    NOT NULL DEFAULT 0,
      delivery_done    TINYINT(1)    NOT NULL DEFAULT 0,
      commission_done  TINYINT(1)    NOT NULL DEFAULT 0,
      stuck_reason     VARCHAR(64)   NULL,
      next_action      VARCHAR(255)  NULL,
      follow_up_date   DATE          NULL,
      created_by       INT           NULL,
      created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
      last_activity_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at        DATETIME      NULL,
      KEY idx_task_vrn (vehicle_reg_no),
      KEY idx_task_stage (stage),
      KEY idx_task_assigned (assigned_to),
      KEY idx_task_caller_phone (caller_phone),
      KEY idx_task_customer_phone (customer_phone),
      KEY idx_task_ticket (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_activity (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      card_id      INT           NOT NULL,
      kind         VARCHAR(16)   NOT NULL,
      caller_type  VARCHAR(16)   NULL,
      caller_phone VARCHAR(32)   NULL,
      purpose      VARCHAR(64)   NULL,
      note         TEXT          NULL,
      from_value   VARCHAR(255)  NULL,
      to_value     VARCHAR(255)  NULL,
      actor_id     INT           NULL,
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_task_activity_card (card_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tablesReady = true;
}

export type TaskSession = { id: number; name: string; userType: string };

/**
 * Admins and employees only. Returns the session or a 401/403 response.
 * Accepts the mobile app's bearer token (checked first) or the website session cookie.
 */
export async function requireStaff(): Promise<TaskSession | NextResponse> {
  const auth = (await headers()).get("authorization");
  if (auth) {
    const m = await getMobileUser(auth).catch(() => null);
    if (!m) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return { id: m.id, name: m.name, userType: m.userType };
  }
  const session = (await getUserSession().catch(() => null)) as any;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userType = String(session.userType || "");
  if (userType !== "admin" && userType !== "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { id: Number(session.id) || 0, name: String(session.name || ""), userType };
}

export function cleanPhone(v: any): string | null {
  const digits = String(v ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export async function logTaskActivity(a: {
  cardId: number;
  kind: "create" | "call" | "note" | "stage" | "assign" | "check" | "stuck" | "unstuck" | "edit";
  actorId: number | null;
  note?: string | null;
  from?: string | null;
  to?: string | null;
  callerType?: string | null;
  callerPhone?: string | null;
  purpose?: string | null;
}) {
  await pool.query(
    `INSERT INTO task_activity (card_id, kind, caller_type, caller_phone, purpose, note, from_value, to_value, actor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.cardId, a.kind, a.callerType ?? null, a.callerPhone ?? null, a.purpose ?? null,
      a.note ?? null, a.from ?? null, a.to ?? null, a.actorId || null,
    ]
  );
  await pool.query(`UPDATE task_cards SET last_activity_at = NOW() WHERE id = ?`, [a.cardId]);
}

export const CARD_SELECT = `
  SELECT c.*,
         COALESCE(au.name, '') AS assigned_to_name,
         COALESCE(cu.name, '') AS created_by_name,
         TIMESTAMPDIFF(HOUR, c.last_activity_at, NOW()) AS hours_since_activity,
         (SELECT COUNT(*) FROM task_activity a WHERE a.card_id = c.id AND a.kind = 'call') AS call_count
    FROM task_cards c
    LEFT JOIN users au ON au.id = c.assigned_to
    LEFT JOIN users cu ON cu.id = c.created_by
`;
