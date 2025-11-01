// app/api/reports/tickets/admin-performance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserSession } from "@/lib/getSession";
import { hasTableColumn } from "@/lib/db-helpers";

type AdminTicketPerformance = {
  id: number;
  name: string;
  email: string | null;
  created_count: number;
  assigned_count: number;
  open_count: number;
  in_progress_count: number;
  completed_count: number;
  closed_count: number;
  cancelled_count: number;
};

export async function GET(req: NextRequest) {
  try {
    // AuthZ: only Super Admin should access
    const session = await getUserSession();
    const displayRole = session?.displayRole as string | undefined;
    if (!session || displayRole !== "Super Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify optional columns in tickets table
    const TBL = "tickets_nh";
    const hasCreatedBy = await hasTableColumn(TBL, "created_by").catch(() => false);

    // Build status normalization SQL fragment (align with tickets route)
    const normStatus = `LOWER(TRIM(COALESCE(t.status,'')))`;
    const isOpen = `(${normStatus} IN ('open','pending','activation pending','kyc pending','waiting','new lead'))`;
    const isInProgress = `(${normStatus} IN ('in progress','in_progress','working'))`;
    const isCompleted = `(${normStatus} IN ('completed','done','activated','resolved'))`;
    const isClosed = `(${normStatus} = 'closed')`;
    const isCancelled = `(${normStatus} IN ('cancelled','cust cancelled'))`;

    // Note: restrict to DB users with role 'admin' (exclude 'super admin')
    // and return one row per admin with correlated subquery counts.
    const [rows]: any = await pool.query(
      `SELECT 
         u.id,
         COALESCE(u.name,'') AS name,
         COALESCE(u.email, NULL) AS email,
         ${hasCreatedBy ? `(
           SELECT COUNT(*) FROM ${TBL} t WHERE t.created_by = u.id
         )` : `0`} AS created_count,
         (
           SELECT COUNT(*) FROM ${TBL} t WHERE t.assigned_to = u.id
         ) AS assigned_count,
         (
           SELECT COUNT(*) FROM ${TBL} t WHERE t.assigned_to = u.id AND ${isOpen}
         ) AS open_count,
         (
           SELECT COUNT(*) FROM ${TBL} t WHERE t.assigned_to = u.id AND ${isInProgress}
         ) AS in_progress_count,
         (
           SELECT COUNT(*) FROM ${TBL} t WHERE t.assigned_to = u.id AND ${isCompleted}
         ) AS completed_count,
         (
           SELECT COUNT(*) FROM ${TBL} t WHERE t.assigned_to = u.id AND ${isClosed}
         ) AS closed_count,
         (
           SELECT COUNT(*) FROM ${TBL} t WHERE t.assigned_to = u.id AND ${isCancelled}
         ) AS cancelled_count
       FROM users u
       WHERE LOWER(COALESCE(u.role,'')) = 'admin'
       ORDER BY u.name ASC`
    );

    const data: AdminTicketPerformance[] = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id),
      name: String(r.name || ''),
      email: r.email ?? null,
      created_count: Number(r.created_count || 0),
      assigned_count: Number(r.assigned_count || 0),
      open_count: Number(r.open_count || 0),
      in_progress_count: Number(r.in_progress_count || 0),
      completed_count: Number(r.completed_count || 0),
      closed_count: Number(r.closed_count || 0),
      cancelled_count: Number(r.cancelled_count || 0),
    }));

    return NextResponse.json({ admins: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load admin performance" }, { status: 500 });
  }
}
