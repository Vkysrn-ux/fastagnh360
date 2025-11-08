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

export async function GET(req: Request) {
  try {
    const session = await getUserSession();
    const me = Number((session as any)?.id || 0);
    if (!me) return NextResponse.json([], { status: 200 });

    const { searchParams } = new URL(req.url);
    const peerId = Number(searchParams.get("peerId") || 0);
    const ticketIdRaw = searchParams.get("ticketId");
    const ticketId = ticketIdRaw ? Number(ticketIdRaw) : null;
    if (!peerId) return NextResponse.json([], { status: 200 });

    await ensureTable();

    const where: string[] = [];
    const params: any[] = [];
    // Only messages between me and peer, hide anything I've cleared on my side
    where.push(
      `((from_user_id = ? AND to_user_id = ? AND cleared_by_sender = 0) OR (from_user_id = ? AND to_user_id = ? AND cleared_by_recipient = 0))`
    );
    params.push(me, peerId, peerId, me);
    if (ticketId && Number.isFinite(ticketId)) {
      where.push(`(ticket_id = ?)`);
      params.push(ticketId);
    }

    const sql = `
      SELECT m.id,
             m.from_user_id, m.to_user_id, m.text, m.ticket_id,
             m.created_at,
             fu.name AS from_name
      FROM chat_messages m
      LEFT JOIN users fu ON fu.id = m.from_user_id
      WHERE ${where.join(" AND ")}
      ORDER BY m.created_at ASC, m.id ASC
      LIMIT 1000`;

    const [rows]: any = await pool.query(sql, params);
    const items = (rows || []).map((r: any) => ({
      id: Number(r.id),
      fromUserId: Number(r.from_user_id),
      fromName: r.from_name || `User #${r.from_user_id}`,
      toUserId: Number(r.to_user_id),
      text: String(r.text || ""),
      ticketId: r.ticket_id == null ? null : Number(r.ticket_id),
      ts: new Date(r.created_at).getTime(),
    }));
    return NextResponse.json(items);
  } catch (e) {
    console.error("chat/messages GET error", e);
    return NextResponse.json([], { status: 200 });
  }
}

