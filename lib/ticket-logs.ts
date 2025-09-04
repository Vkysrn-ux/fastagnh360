// lib/ticket-logs.ts
import { pool } from "@/lib/db";

type AnyObj = Record<string, any>;

export async function logTicketAction(opts: {
  ticketId: number;
  action: string; // view | create | create_child | update | comment
  req?: Request | { headers?: any };
  actorId?: number | null;
  meta?: AnyObj | null;
}) {
  try {
    const { ticketId, action } = opts;
    const meta = opts.meta ?? null;
    const actorId = typeof opts.actorId === "number" ? opts.actorId : null;

    // Try to infer actor from header if not provided
    let headerActor: number | null = null;
    const headers: any = (opts.req as any)?.headers;
    if (headers) {
      const hVal = headers.get ? headers.get("x-user-id") : headers["x-user-id"]; 
      if (hVal && !isNaN(Number(hVal))) headerActor = Number(hVal);
    }

    const ip = headers?.get ? headers.get("x-forwarded-for") || headers.get("x-real-ip") : (headers?.["x-forwarded-for"] || headers?.["x-real-ip"]);
    const ua = headers?.get ? headers.get("user-agent") : headers?.["user-agent"];    

    await pool.query(
      `INSERT INTO ticket_logs (ticket_id, action, actor_id, meta, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [ticketId, action, actorId ?? headerActor, meta ? JSON.stringify(meta) : null, ip ?? null, ua ?? null]
    );
  } catch {
    // logging must never break the request
  }
}

