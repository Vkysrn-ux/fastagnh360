// app/api/tasks/lookup/route.ts
// Call Desk lookup: everything known about a VRN or phone number.
// Returns task cards (all stages) and matching tickets_nh rows (read-only).
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { CARD_SELECT, cleanPhone, ensureTaskTables, requireStaff } from "@/lib/tasks";
import { normalizeVrn } from "@/lib/task-constants";

const VRN_SQL = (col: string) => `REPLACE(REPLACE(REPLACE(UPPER(COALESCE(${col},'')),' ',''),'-',''),'.','')`;

export async function GET(req: NextRequest) {
  const s = await requireStaff();
  if (s instanceof NextResponse) return s;
  try {
    await ensureTaskTables();
    const q = (new URL(req.url).searchParams.get("q") || "").trim();
    const vrn = normalizeVrn(q);
    const digitsOnly = /^[\d\s+-]+$/.test(q);
    const phone = digitsOnly ? cleanPhone(q) : null;
    if ((!phone || phone.length < 6) && vrn.length < 4) {
      return NextResponse.json({ cards: [], tickets: [] });
    }

    const cardWhere: string[] = [];
    const cardParams: any[] = [];
    const tWhere: string[] = [];
    const tParams: any[] = [];
    if (phone && phone.length >= 6) {
      cardWhere.push(`c.caller_phone LIKE ? OR c.customer_phone LIKE ?`);
      cardParams.push(`%${phone}`, `%${phone}`);
      tWhere.push(`t.phone LIKE ? OR t.alt_phone LIKE ?`);
      tParams.push(`%${phone}`, `%${phone}`);
    } else {
      cardWhere.push(`c.vehicle_reg_no LIKE ?`);
      cardParams.push(`%${vrn}%`);
      tWhere.push(`${VRN_SQL("t.vehicle_reg_no")} LIKE ? OR ${VRN_SQL("t.alt_vehicle_reg_no")} LIKE ?`);
      tParams.push(`%${vrn}%`, `%${vrn}%`);
    }

    const [cards] = await pool.query(
      `${CARD_SELECT} WHERE ${cardWhere.join(" OR ")}
       ORDER BY (c.stage IN ('done','cancelled')) ASC, c.last_activity_at DESC LIMIT 50`,
      cardParams
    );

    let tickets: any[] = [];
    try {
      const [rows]: any = await pool.query(
        `SELECT t.id, t.ticket_no, t.vehicle_reg_no, t.customer_name, t.phone, t.subject, t.status,
                t.kyv_status, t.payment_received, t.payment_nil, t.delivery_done, t.delivery_nil,
                t.commission_done, t.lead_commission_paid, t.lead_commission_nil,
                t.fastag_bank, t.fastag_serial, t.comments, t.created_at, t.updated_at,
                COALESCE(u.name, '') AS assigned_to_name
           FROM tickets_nh t
           LEFT JOIN users u ON u.id = t.assigned_to
          WHERE ${tWhere.join(" OR ")}
          ORDER BY t.created_at DESC LIMIT 20`,
        tParams
      );
      tickets = Array.isArray(rows) ? rows : [];
    } catch {
      // tickets lookup is a bonus; never fail the call desk because of it
    }

    return NextResponse.json({ cards: cards || [], tickets });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lookup failed" }, { status: 500 });
  }
}
