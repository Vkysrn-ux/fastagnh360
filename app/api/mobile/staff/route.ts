// app/api/mobile/staff/route.ts
// Admins only: every staff member with their open task / ticket counts, worst first.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { CLOSED_TICKET_SQL, requireMobile } from "@/lib/mobile-api";
import { STALE_HOURS } from "@/lib/task-constants";
import { ensureTaskTables } from "@/lib/tasks";

export async function GET(req: NextRequest) {
  const me = await requireMobile(req);
  if (me instanceof NextResponse) return me;
  if (me.userType !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await ensureTaskTables();
    const [rows]: any = await pool.query(
      `SELECT u.id, u.name, u.role,
              COALESCE(tc.open_tasks, 0)  AS open_tasks,
              COALESCE(tc.stuck, 0)       AS stuck,
              COALESCE(tc.no_update, 0)   AS no_update,
              COALESCE(tk.open_tickets, 0) AS open_tickets
         FROM users u
         LEFT JOIN (
           SELECT assigned_to,
                  COUNT(*) AS open_tasks,
                  SUM(stuck_reason IS NOT NULL) AS stuck,
                  SUM(last_activity_at < NOW() - INTERVAL ? HOUR) AS no_update
             FROM task_cards
            WHERE stage NOT IN ('done','cancelled') AND assigned_to IS NOT NULL
            GROUP BY assigned_to
         ) tc ON tc.assigned_to = u.id
         LEFT JOIN (
           SELECT t.assigned_to, COUNT(*) AS open_tickets
             FROM tickets_nh t
            WHERE t.assigned_to IS NOT NULL AND NOT ${CLOSED_TICKET_SQL}
            GROUP BY t.assigned_to
         ) tk ON tk.assigned_to = u.id
        WHERE LOWER(u.role) IN ('admin','administrator','super','super-admin','super_admin','super admin','superadmin',
                                'employee','accountant','hr','accounts')
          AND LOWER(COALESCE(u.status,'active')) = 'active'
        ORDER BY stuck DESC, no_update DESC, open_tasks DESC, u.name`,
      [STALE_HOURS]
    );
    const staff = (rows || []).map((r: any) => ({
      id: Number(r.id), name: r.name, role: r.role,
      open_tasks: Number(r.open_tasks), stuck: Number(r.stuck), no_update: Number(r.no_update),
      open_tickets: Number(r.open_tickets),
    }));
    return NextResponse.json({ staff });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load staff" }, { status: 500 });
  }
}
