import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";

function toDayBounds(dateStr?: string) {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const start = `${y}-${m}-${day} 00:00:00`;
  const end = `${y}-${m}-${day} 23:59:59`;
  return { start, end };
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("user-session")?.value;
    if (!raw) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    let session: any;
    try { session = JSON.parse(raw); } catch {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Only Super Admin can view usage report
    if (String(session?.displayRole || "").toLowerCase() !== "super admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const role = (url.searchParams.get("role") || "admin").toLowerCase();
    const date = url.searchParams.get("date") || undefined;
    const { start, end } = toDayBounds(date);

    // Ensure table exists (no-op if already there)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        user_type VARCHAR(20) NOT NULL,
        started_at DATETIME NOT NULL,
        last_seen_at DATETIME NOT NULL,
        ended_at DATETIME NULL,
        PRIMARY KEY (id),
        KEY idx_user_started (user_id, started_at),
        KEY idx_user_last_seen (user_id, last_seen_at),
        KEY idx_open_sessions (user_id, ended_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const sql = `
      SELECT 
        u.id AS user_id,
        u.name,
        u.email,
        SUM(
          GREATEST(
            0,
            TIMESTAMPDIFF(
              SECOND,
              GREATEST(s.started_at, ?),
              LEAST(COALESCE(s.ended_at, s.last_seen_at), ?)
            )
          )
        ) AS seconds
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.user_type = ?
        AND s.started_at < ?
        AND COALESCE(s.ended_at, s.last_seen_at) > ?
      GROUP BY u.id, u.name, u.email
      ORDER BY seconds DESC, u.name ASC
    `;

    const [rows]: any = await pool.query(sql, [start, end, role, end, start]);

    return NextResponse.json({ ok: true, role, date: date || new Date().toISOString().slice(0,10), start, end, data: rows });
  } catch (e) {
    console.error("usage report error", e);
    return NextResponse.json({ ok: false, data: [] });
  }
}

