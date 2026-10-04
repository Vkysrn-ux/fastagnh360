// app/api/mobile/tickets/route.ts
// GET ?user_id= &status=open|closed|all (default open) &q=<vrn/phone/ticket no> &limit=
// Tickets assigned to or created by the user (same scope employees get on the website). Read-only.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { CLOSED_TICKET_SQL, TICKET_FLAGS_SQL, requireMobile, targetUserId } from "@/lib/mobile-api";

export async function GET(req: NextRequest) {
  const me = await requireMobile(req);
  if (me instanceof NextResponse) return me;
  const uid = targetUserId(me, req);
  if (uid instanceof NextResponse) return uid;
  try {
    const sp = new URL(req.url).searchParams;
    const where: string[] = [];
    const params: any[] = [];

    // ?id=  one ticket (opened from a push notification): admins any ticket, staff only their own
    const oneId = Number(sp.get("id"));
    if (oneId > 0) {
      where.push(`t.id = ?`);
      params.push(oneId);
      if (me.userType !== "admin") {
        where.push(`(t.assigned_to = ? OR t.created_by = ?)`);
        params.push(me.id, me.id);
      }
    } else {
      where.push(`(t.assigned_to = ? OR t.created_by = ?)`);
      params.push(uid, uid);
    }

    const status = oneId > 0 ? "all" : sp.get("status") || "open";
    if (status === "open") where.push(`NOT ${CLOSED_TICKET_SQL}`);
    else if (status === "closed") where.push(CLOSED_TICKET_SQL);

    const q = (sp.get("q") || "").trim();
    if (q) {
      const vrn = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
      where.push(`(REPLACE(REPLACE(UPPER(COALESCE(t.vehicle_reg_no,'')),' ',''),'-','') LIKE ?
                   OR t.phone LIKE ? OR t.ticket_no LIKE ? OR t.customer_name LIKE ?)`);
      params.push(`%${vrn}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 300);

    const [rows]: any = await pool.query(
      `SELECT t.id, t.ticket_no, t.parent_ticket_id, t.vehicle_reg_no, t.customer_name, t.phone, t.subject,
              t.status, t.kyv_status, t.npci_status, t.fastag_bank, t.fastag_serial, t.comments,
              t.created_at, t.updated_at, t.assigned_to,
              COALESCE(au.name,'') AS assigned_to_name, COALESCE(cu.name,'') AS created_by_name,
              DATEDIFF(CURDATE(), DATE(t.created_at)) AS days_open,
              ${TICKET_FLAGS_SQL}
         FROM tickets_nh t
         LEFT JOIN users au ON au.id = t.assigned_to
         LEFT JOIN users cu ON cu.id = t.created_by
        WHERE ${where.join(" AND ")}
        ORDER BY COALESCE(t.updated_at, t.created_at) DESC
        LIMIT ${limit}`,
      params
    );
    const tickets = (rows || []).map((r: any) => ({
      ...r,
      payment_ok: !!Number(r.payment_ok),
      delivery_ok: !!Number(r.delivery_ok),
      commission_ok: !!Number(r.commission_ok),
      kyv_ok: !!Number(r.kyv_ok),
      days_open: Number(r.days_open) || 0,
    }));
    return NextResponse.json({ tickets });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load tickets" }, { status: 500 });
  }
}
