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

export async function POST(req: Request) {
  try {
    const session = await getUserSession();
    const me = Number((session as any)?.id || 0);
    if (!me) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 200 });

    const body = await req.json().catch(() => ({}));
    const peerId = Number(body?.peerId || 0);
    const ticketIdRaw = body?.ticketId;
    const ticketId = ticketIdRaw == null || ticketIdRaw === '' ? null : Number(ticketIdRaw);
    if (!peerId) return NextResponse.json({ ok: false, error: "peer_required" }, { status: 200 });

    await ensureTable();

    // Clear for current user's view only
    const paramsA: any[] = [me, peerId];
    const paramsB: any[] = [peerId, me];
    const condA = ticketId != null && Number.isFinite(ticketId) ? ' AND ticket_id = ?' : '';
    if (condA) { paramsA.push(ticketId); paramsB.push(ticketId); }

    const [resA]: any = await pool.query(
      `UPDATE chat_messages SET cleared_by_sender = 1
       WHERE from_user_id = ? AND to_user_id = ? AND cleared_by_sender = 0${condA}`,
      paramsA
    );
    const [resB]: any = await pool.query(
      `UPDATE chat_messages SET cleared_by_recipient = 1
       WHERE from_user_id = ? AND to_user_id = ? AND cleared_by_recipient = 0${condA}`,
      paramsB
    );

    return NextResponse.json({ ok: true, affected: { sent: resA?.affectedRows || 0, received: resB?.affectedRows || 0 } });
  } catch (e) {
    console.error('chat/clear POST error', e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

