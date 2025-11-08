import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserSession } from "@/lib/getSession";

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
    const items = (rows || []).map((r: any) => ({
      id: Number(r.id),
      name: r.name || `User #${r.id}`,
      lastAt: new Date(r.last_at).toISOString(),
    }));
    return NextResponse.json(items);
  } catch (e) {
    console.error("chat/recents GET error", e);
    return NextResponse.json([]);
  }
}

