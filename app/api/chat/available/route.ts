import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function GET() {
  try {
    const idleMinutes = Number(process.env.HEARTBEAT_IDLE_MINUTES || 10);

    const hasLastLogin = await hasTableColumn("users", "last_login");
    const hasUpdatedAt = await hasTableColumn("users", "updated_at");
    const hasLastActivity = await hasTableColumn("users", "last_activity");
    const hasStatus = await hasTableColumn("users", "status");
    const hasRole = await hasTableColumn("users", "role");

    // Build a last activity expression similar to users-activity route
    let lastActivityExpr = "NULL";
    if (hasLastActivity) lastActivityExpr = "last_activity";
    else if (hasUpdatedAt && hasLastLogin)
      lastActivityExpr = "GREATEST(updated_at, last_login)";
    else if (hasUpdatedAt)
      lastActivityExpr = "updated_at";
    else if (hasLastLogin)
      lastActivityExpr = "last_login";

    const cols = [
      "id",
      "name",
      hasRole ? "role" : "NULL as role",
      hasStatus ? "status" : "NULL as status",
      `${lastActivityExpr} as last_activity`,
    ];

    // Filter: last_activity within idleMinutes and (optional) active status
    const whereParts: string[] = [];
    if (lastActivityExpr !== "NULL") {
      whereParts.push(`${lastActivityExpr} >= (NOW() - INTERVAL ${idleMinutes} MINUTE)`);
    } else {
      // If we can't compute last activity, return empty list
      return NextResponse.json([]);
    }
    if (hasStatus) {
      // Treat status case-insensitively (trim) and accept common truthy variants
      whereParts.push(`(status IS NULL OR TRIM(LOWER(status)) = 'active' OR status = '1' OR status = 1)`);
    }

    const sql = `SELECT ${cols.join(", ")} FROM users ${
      whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : ""
    } ORDER BY last_activity DESC LIMIT 200`;

    const [rows]: any = await pool.query(sql);

    let items = (rows || []).map((r: any) => ({
      id: Number(r.id),
      name: r.name || `User #${r.id}`,
      displayRole: r.role || undefined,
    }));

    // Fallback: derive availability from user_sessions (maintained by heartbeat)
    if (!items.length) {
      try {
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

        const sessionSql = `
          SELECT u.id, u.name,
                 ${hasRole ? 'u.role' : "NULL as role"},
                 ${hasStatus ? 'u.status' : "NULL as status"},
                 s.last_seen_at AS last_activity
          FROM (
            SELECT user_id, MAX(last_seen_at) AS last_seen_at
            FROM user_sessions
            WHERE last_seen_at >= (NOW() - INTERVAL ${idleMinutes} MINUTE)
            GROUP BY user_id
          ) s
          JOIN users u ON u.id = s.user_id
          ${hasStatus ? "WHERE (u.status IS NULL OR TRIM(LOWER(u.status)) = 'active' OR u.status = '1' OR u.status = 1)" : ''}
          ORDER BY s.last_seen_at DESC
          LIMIT 200`;

        const [rows2]: any = await pool.query(sessionSql);
        items = (rows2 || []).map((r: any) => ({
          id: Number(r.id),
          name: r.name || `User #${r.id}`,
          displayRole: r.role || undefined,
        }));
      } catch (_e) {
        // ignore, just return empty
      }
    }

    return NextResponse.json(items);
  } catch (e) {
    console.error("available-users error", e);
    return NextResponse.json([]);
  }
}
