// app/api/reports/tickets/admin-pending-reasons/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserSession } from "@/lib/getSession";
import { hasTableColumn } from "@/lib/db-helpers";

type PendingReason =
  | 'unassigned'
  | 'payment_pending'
  | "paid_via_missing"
  | 'delivery_pending'
  | 'lead_commission_pending'
  | 'pickup_commission_pending'
  | 'kyv_pending';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session || session.displayRole !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const adminIdParam = searchParams.get('admin_id');
    const adminId = adminIdParam ? Number(adminIdParam) : null;

    const T = 'tickets_nh';
    const hasCreatedBy = await hasTableColumn(T, 'created_by').catch(() => false);
    if (!hasCreatedBy) {
      return NextResponse.json({
        tickets: [],
        summary: {},
        note: "created_by column not found; cannot attribute tickets to admin creators.",
      });
    }

    const cols = [
      't.id','t.ticket_no','t.status','t.kyv_status','t.assigned_to','t.created_by','t.created_at','t.updated_at',
      't.payment_received','t.payment_nil','t.paid_via','t.delivery_done','t.delivery_nil',
      't.lead_commission_paid','t.lead_commission_nil','t.pickup_commission_paid','t.pickup_commission_nil',
      't.customer_name','t.vehicle_reg_no'
    ];

    const normStatus = `LOWER(TRIM(COALESCE(t.status,'')))`;
    const isOpen = `(${normStatus} IN ('open','pending','activation pending','kyc pending','waiting','new lead'))`;

    const where: string[] = [isOpen, `LOWER(COALESCE(cu.role,'')) = 'admin'`];
    const params: any[] = [];
    if (adminId) { where.push('t.created_by = ?'); params.push(adminId); }

    const [rows]: any = await pool.query(
      `SELECT ${cols.join(',')}, COALESCE(cu.name,'') AS created_by_name,
              DATEDIFF(CURDATE(), DATE(COALESCE(t.created_at, t.updated_at))) AS days_open
         FROM ${T} t
         LEFT JOIN users cu ON cu.id = t.created_by
        WHERE ${where.join(' AND ')}
        ORDER BY t.created_at DESC`
    , params);

    const tickets = (Array.isArray(rows) ? rows : []).map((r) => {
      const reasons: PendingReason[] = [];
      const payment_received = !!(r.payment_received);
      const payment_nil = !!(r.payment_nil);
      const delivery_done = !!(r.delivery_done);
      const delivery_nil = !!(r.delivery_nil);
      const lead_paid = !!(r.lead_commission_paid);
      const lead_nil = !!(r.lead_commission_nil);
      const pickup_paid = !!(r.pickup_commission_paid);
      const pickup_nil = !!(r.pickup_commission_nil);
      const paid_via = String(r.paid_via ?? '').trim();
      const kyv = String(r.kyv_status ?? '').toLowerCase();

      if (!r.assigned_to) reasons.push('unassigned');
      if (!(payment_received || payment_nil)) reasons.push('payment_pending');
      if (payment_received && (paid_via === '' || paid_via === 'Pending')) reasons.push('paid_via_missing');
      if (!(delivery_done || delivery_nil)) reasons.push('delivery_pending');
      if (!(lead_paid || lead_nil)) reasons.push('lead_commission_pending');
      if (!(pickup_paid || pickup_nil)) reasons.push('pickup_commission_pending');
      if (!(kyv.includes('compliant') || kyv === 'nil' || kyv === 'kyv compliant')) reasons.push('kyv_pending');

      return {
        id: Number(r.id),
        ticket_no: r.ticket_no || null,
        created_by: Number(r.created_by) || null,
        created_by_name: String(r.created_by_name || ''),
        customer_name: r.customer_name || null,
        vehicle_reg_no: r.vehicle_reg_no || null,
        status: r.status,
        days_open: Number(r.days_open ?? 0),
        reasons,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    // Aggregate summary
    const summary: Record<string, number> = {};
    for (const t of tickets) {
      for (const key of t.reasons) {
        summary[key] = (summary[key] || 0) + 1;
      }
    }

    return NextResponse.json({ tickets, summary });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to analyze pending tickets' }, { status: 500 });
  }
}
