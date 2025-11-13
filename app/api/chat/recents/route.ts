import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserSession } from "@/lib/getSession";
import { hasTableColumn } from "@/lib/db-helpers";

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      from_user_id INT UNSIGNED NOT NULL,
      to_user_id INT UNSIGNED NOT NULL,
      ticket_id BIGINT UNSIGNED NULL,
      text TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      cleared_by_sender TINYINT(1) NOT NULL DEFAULT 0,
      cleared_by_recipient TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY idx_users (from_user_id, to_user_id, created_at),
      KEY idx_to (to_user_id, created_at),
      KEY idx_ticket (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function GET() {
  try {
    const session = await getUserSession();
    const me = Number((session as any)?.id || 0);
    if (!me) return NextResponse.json([]);

    await ensureTable();

    const sql = `
      SELECT peer.id AS id, peer.name AS name, MAX(m.created_at) AS last_at
      FROM chat_messages m
      JOIN users peer
        ON peer.id = (CASE WHEN m.from_user_id = ? THEN m.to_user_id ELSE m.from_user_id END)
      WHERE (m.from_user_id = ? AND m.cleared_by_sender = 0)
         OR (m.to_user_id = ? AND m.cleared_by_recipient = 0)
      GROUP BY peer.id, peer.name
      ORDER BY last_at DESC
      LIMIT 200`;
    const [rows]: any = await pool.query(sql, [me, me, me]);
    const baseItems = (rows || []).map((r: any) => ({
      id: Number(r.id),
      name: r.name || `User #${r.id}`,
      lastAt: r.last_at ? new Date(r.last_at).toISOString() : null,
    }));

    // Enrich with last activity if available (users.last_activity / updated_at / last_login or user_sessions)
    const peerIds = baseItems.map((i: any) => i.id);
    if (peerIds.length) {
      try {
        const hasLastLogin = await hasTableColumn("users", "last_login");
        const hasUpdatedAt = await hasTableColumn("users", "updated_at");
        const hasLastActivity = await hasTableColumn("users", "last_activity");

        const cols = ["id"] as string[];
        if (hasLastActivity) cols.push("last_activity");
        if (hasUpdatedAt) cols.push("updated_at");
        if (hasLastLogin) cols.push("last_login");

        // Guard: if none of the columns exist, skip users table fetch
        let usersMap: Record<number, any> = {};
        if (cols.length > 1) {
          const [urows]: any = await pool.query(`SELECT ${cols.join(", ")} FROM users WHERE id IN (?)`, [peerIds]);
          for (const r of (urows || [])) usersMap[Number(r.id)] = r;
        }

        // Also pull last_seen_at from user_sessions
        const [srows]: any = await pool.query(
          `SELECT user_id, MAX(last_seen_at) AS last_seen_at FROM user_sessions WHERE user_id IN (?) GROUP BY user_id`,
          [peerIds]
        );
        const sessMap: Record<number, string> = {};
        for (const r of (srows || [])) {
          if (r && r.user_id) sessMap[Number(r.user_id)] = r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null;
        }

        const items = baseItems.map((it: any) => {
          const u = usersMap[it.id] || {};
          const cands: number[] = [];
          if (u.last_activity) cands.push(new Date(u.last_activity).getTime());
          if (u.updated_at) cands.push(new Date(u.updated_at).getTime());
          if (u.last_login) cands.push(new Date(u.last_login).getTime());
          if (sessMap[it.id]) cands.push(new Date(sessMap[it.id]).getTime());
          const lastActive = cands.length ? new Date(Math.max(...cands)).toISOString() : null;
          return { ...it, lastActive };
        });

        return NextResponse.json(items);
      } catch {
        // On any enrichment error, fall back to base list
        return NextResponse.json(baseItems);
      }
    }

    return NextResponse.json(baseItems);
  } catch (e) {
    console.error("chat/recents GET error", e);
    return NextResponse.json([]);
  }
}

