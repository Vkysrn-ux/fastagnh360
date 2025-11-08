import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";

// Create table if missing (idempotent)
async function ensureTable() {
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
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("user-session")?.value;
    if (!raw) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Cookie value may be URI-encoded. Try to decode, then parse JSON.
    let parsedRaw = raw;
    try { parsedRaw = decodeURIComponent(raw); } catch {}

    let session: any;
    try { session = JSON.parse(parsedRaw); } catch {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session?.id || 0);
    const userType = String(session?.userType || "");
    if (!userId || !userType) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const isVisible = body?.isVisible !== false; // default true

    const idleMinutes = Number(process.env.HEARTBEAT_IDLE_MINUTES || 5);

    await ensureTable();

    // Update last activity on users table (best-effort). Also bump updated_at
    try {
      await pool.query("UPDATE users SET last_activity = NOW(), updated_at = NOW() WHERE id = ?", [userId]);
    } catch {}

    // Fetch latest open session
    const [rows]: any = await pool.query(
      "SELECT id, last_seen_at FROM user_sessions WHERE user_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1",
      [userId]
    );

    const nowExpr = "NOW()";

    if (rows && rows.length > 0) {
      const s = rows[0];
      // Determine staleness
      const [[{ mins_since }]]: any = await pool.query(
        "SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) AS mins_since",
        [s.last_seen_at]
      );

      const stale = Number(mins_since) > idleMinutes;

      if (!isVisible) {
        // Close the session at last_seen_at (no idle accumulation)
        await pool.query("UPDATE user_sessions SET ended_at = last_seen_at WHERE id = ?", [s.id]);
        return NextResponse.json({ ok: true, closed: true });
      }

      if (stale) {
        // Close old, start new
        await pool.query("UPDATE user_sessions SET ended_at = last_seen_at WHERE id = ?", [s.id]);
        await pool.query(
          `INSERT INTO user_sessions (user_id, user_type, started_at, last_seen_at, ended_at)
           VALUES (?, ?, ${nowExpr}, ${nowExpr}, NULL)`,
          [userId, userType]
        );
        return NextResponse.json({ ok: true, restarted: true });
      } else {
        // Continue same session
        await pool.query("UPDATE user_sessions SET last_seen_at = NOW() WHERE id = ?", [s.id]);
        return NextResponse.json({ ok: true, continued: true });
      }
    } else {
      if (!isVisible) {
        // No session and not visible: nothing to open
        return NextResponse.json({ ok: true, skipped: true });
      }
      // Start first session
      await pool.query(
        `INSERT INTO user_sessions (user_id, user_type, started_at, last_seen_at, ended_at)
         VALUES (?, ?, ${nowExpr}, ${nowExpr}, NULL)`,
        [userId, userType]
      );
      return NextResponse.json({ ok: true, started: true });
    }
  } catch (e) {
    console.error("heartbeat error", e);
    return NextResponse.json({ ok: false });
  }
}
