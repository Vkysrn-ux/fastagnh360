// app/api/reports/tickets/metrics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type DayMetrics = {
  date: string;
  created: number;
  hotlisted: number;
  open: number;
  in_progress: number;
  completed: number;
  closed: number;
  cancelled: number;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = Number(searchParams.get("days") || 30);
    const toParam = searchParams.get("to");
    const fromParam = searchParams.get("from");

    const to = toParam ? new Date(toParam) : new Date();
    // normalize to end-of-day
    to.setHours(23, 59, 59, 999);
    const from = fromParam
      ? new Date(fromParam)
      : new Date(to.getTime() - (daysParam - 1) * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);

    // Prepare base date array
    const days: DayMetrics[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const yyyy = cursor.getFullYear();
      const mm = String(cursor.getMonth() + 1).padStart(2, "0");
      const dd = String(cursor.getDate()).padStart(2, "0");
      days.push({ date: `${yyyy}-${mm}-${dd}`, created: 0, hotlisted: 0, open: 0, in_progress: 0, completed: 0, closed: 0, cancelled: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const fromSql = from.toISOString().slice(0, 19).replace("T", " ");
    const toSql = to.toISOString().slice(0, 19).replace("T", " ");

    // Created per day (fallback to updated_at if created_at is null)
    const [createdRows]: any = await pool.query(
      `SELECT DATE_FORMAT(COALESCE(created_at, updated_at), '%Y-%m-%d') AS d, COUNT(*) AS cnt
         FROM tickets_nh
        WHERE COALESCE(created_at, updated_at) BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(COALESCE(created_at, updated_at), '%Y-%m-%d')`,
      [fromSql, toSql]
    );

    // Hotlisted per day: use normalized variants and group by updated_at (when status likely changed)
    const [hotRows]: any = await pool.query(
      `SELECT DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%d') AS d, COUNT(*) AS cnt
         FROM tickets_nh
        WHERE (
               LOWER(kyv_status) = 'kyv_hotlisted'
            OR LOWER(kyv_status) = 'kyv hotlisted'
            OR LOWER(kyv_status) = 'hotlisted'
            OR LOWER(kyv_status) = 'hotlist'
        )
          AND COALESCE(updated_at, created_at) BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%d')`,
      [fromSql, toSql]
    );

    const map = new Map(days.map((r) => [r.date, r]));
    for (const r of Array.isArray(createdRows) ? createdRows : []) {
      const key = String(r.d);
      const row = map.get(key);
      if (row) row.created = Number(r.cnt || 0);
    }
    for (const r of Array.isArray(hotRows) ? hotRows : []) {
      const key = String(r.d);
      const row = map.get(key);
      if (row) row.hotlisted = Number(r.cnt || 0);
    }

    // Daily counts by normalized status based on last change date (updated_at fallback to created_at)
    const [statusRows]: any = await pool.query(
      `SELECT DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%d') AS d,
              SUM(CASE WHEN LOWER(TRIM(COALESCE(status,''))) IN ('open','pending','activation pending','kyc pending','waiting','new lead') THEN 1 ELSE 0 END) AS open,
              SUM(CASE WHEN LOWER(TRIM(COALESCE(status,''))) IN ('in progress','in_progress','working') THEN 1 ELSE 0 END) AS in_progress,
              SUM(CASE WHEN LOWER(TRIM(COALESCE(status,''))) IN ('completed','done','activated','resolved') THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN LOWER(TRIM(COALESCE(status,''))) IN ('closed') THEN 1 ELSE 0 END) AS closed,
              SUM(CASE WHEN LOWER(TRIM(COALESCE(status,''))) IN ('cancelled','cust cancelled') THEN 1 ELSE 0 END) AS cancelled
         FROM tickets_nh
        WHERE COALESCE(updated_at, created_at) BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%d')`,
      [fromSql, toSql]
    );
    for (const r of Array.isArray(statusRows) ? statusRows : []) {
      const key = String(r.d);
      const row = map.get(key);
      if (row) {
        row.open = Number(r.open || 0);
        row.in_progress = Number(r.in_progress || 0);
        row.completed = Number(r.completed || 0);
        row.closed = Number(r.closed || 0);
        row.cancelled = Number(r.cancelled || 0);
      }
    }

    return NextResponse.json({ from: fromSql, to: toSql, days });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load metrics" }, { status: 500 });
  }
}
