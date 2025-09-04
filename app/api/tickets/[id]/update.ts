// app/api/tickets/[id]/update.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logTicketAction } from "@/lib/ticket-logs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ticket_id = Number(params.id);
    if (!ticket_id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { status, details, comment, updated_by } = await req.json();

    // Update the main ticket
    await pool.query(
      `UPDATE tickets_nh
       SET status = ?, details = ?, updated_at = NOW(), updated_by = ?
       WHERE id = ?`,
      [status ?? null, details ?? null, updated_by ?? null, ticket_id]
    );

    // Insert the comment into ticket_comments
    if (comment && String(comment).trim()) {
      await pool.query(
        `INSERT INTO ticket_comments (ticket_id, comment, status, updated_by)
         VALUES (?, ?, ?, ?)`,
        [ticket_id, comment, status ?? null, updated_by ?? null]
      );
      try {
        await logTicketAction({ ticketId: ticket_id, action: "comment", req, actorId: updated_by ?? undefined, meta: { comment, status } });
      } catch {}
    }

    try {
      await logTicketAction({ ticketId: ticket_id, action: "update", req, actorId: updated_by ?? undefined, meta: { status, details } });
    } catch {}
    return NextResponse.json({ message: "Ticket updated & (optional) comment added." });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
