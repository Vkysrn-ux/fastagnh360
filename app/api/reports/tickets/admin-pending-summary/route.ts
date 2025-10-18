// app/api/reports/tickets/admin-pending-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserSession } from "@/lib/getSession";
import { hasTableColumn } from "@/lib/db-helpers";

type AdminPendingSummary = {
  id: number;
  name: string;
  email: string | null;
  total_open: number;
  avg_days_open: number;
  max_days_open: number;
  unassigned: number;
  payment_pending: number;
  paid_via_missing: number;
  delivery_pending: number;
  lead_commission_pending: number;
  pickup_commission_pending: number;
  kyv_pending: number;
};

export async function GET(req: NextRequest) {
  try {
    const session = getUserSession();
    if (!session || session.displayRole !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const T = 'tickets_nh';

    // Ensure we can attribute tickets to admin creators
    const hasCreatedBy = await hasTableColumn(T, 'created_by').catch(() => false);
    if (!hasCreatedBy) {
      return NextResponse.json({ admins: [], note: 'created_by column not found' });
    }

    // Optional columns used in reasons
    const hasPaymentReceived = await hasTableColumn(T, 'payment_received').catch(() => false);
    const hasPaymentNil = await hasTableColumn(T, 'payment_nil').catch(() => false);
    const hasPaidVia = await hasTableColumn(T, 'paid_via').catch(() => false);
    const hasDeliveryDone = await hasTableColumn(T, 'delivery_done').catch(() => false);
    const hasDeliveryNil = await hasTableColumn(T, 'delivery_nil').catch(() => false);
    const hasLeadPaid = await hasTableColumn(T, 'lead_commission_paid').catch(() => false);
    const hasLeadNil = await hasTableColumn(T, 'lead_commission_nil').catch(() => false);
    const hasPickupPaid = await hasTableColumn(T, 'pickup_commission_paid').catch(() => false);
    const hasPickupNil = await hasTableColumn(T, 'pickup_commission_nil').catch(() => false);
    const hasKyv = await hasTableColumn(T, 'kyv_status').catch(() => false);

    const normStatus = `LOWER(TRIM(COALESCE(t.status,'')))`;
    const isOpen = `(${normStatus} IN ('open','pending','activation pending','kyc pending','waiting','new lead'))`;

    // Expressions for reason checks (fallback to 0 when column missing)
    const exprUnassigned = `CASE WHEN t.assigned_to IS NULL THEN 1 ELSE 0 END`;
    const exprPaymentPending = (hasPaymentReceived || hasPaymentNil)
      ? `CASE WHEN ${(hasPaymentReceived? 'COALESCE(t.payment_received,0)=0' : '1=1')} AND ${(hasPaymentNil? 'COALESCE(t.payment_nil,0)=0' : '1=1')} THEN 1 ELSE 0 END`
      : `0`;
    const exprPaidViaMissing = (hasPaymentReceived && hasPaidVia)
      ? `CASE WHEN COALESCE(t.payment_received,0)=1 AND (COALESCE(t.paid_via,'')='' OR t.paid_via='Pending') THEN 1 ELSE 0 END`
      : `0`;
    const exprDeliveryPending = (hasDeliveryDone || hasDeliveryNil)
      ? `CASE WHEN ${(hasDeliveryDone? 'COALESCE(t.delivery_done,0)=0' : '1=1')} AND ${(hasDeliveryNil? 'COALESCE(t.delivery_nil,0)=0' : '1=1')} THEN 1 ELSE 0 END`
      : `0`;
    const exprLeadPending = (hasLeadPaid || hasLeadNil)
      ? `CASE WHEN ${(hasLeadPaid? 'COALESCE(t.lead_commission_paid,0)=0' : '1=1')} AND ${(hasLeadNil? 'COALESCE(t.lead_commission_nil,0)=0' : '1=1')} THEN 1 ELSE 0 END`
      : `0`;
    const exprPickupPending = (hasPickupPaid || hasPickupNil)
      ? `CASE WHEN ${(hasPickupPaid? 'COALESCE(t.pickup_commission_paid,0)=0' : '1=1')} AND ${(hasPickupNil? 'COALESCE(t.pickup_commission_nil,0)=0' : '1=1')} THEN 1 ELSE 0 END`
      : `0`;
    const exprKyvPending = hasKyv
      ? `CASE WHEN NOT (LOWER(COALESCE(t.kyv_status,'')) LIKE '%compliant%' OR LOWER(COALESCE(t.kyv_status,'')) IN ('nil','kyv compliant')) THEN 1 ELSE 0 END`
      : `0`;

    const sql = `
      SELECT
        cu.id,
        COALESCE(cu.name,'') AS name,
        COALESCE(cu.email,NULL) AS email,
        COUNT(*) AS total_open,
        AVG(DATEDIFF(CURDATE(), DATE(COALESCE(t.created_at, t.updated_at)))) AS avg_days_open,
        MAX(DATEDIFF(CURDATE(), DATE(COALESCE(t.created_at, t.updated_at)))) AS max_days_open,
        SUM(${exprUnassigned}) AS unassigned,
        SUM(${exprPaymentPending}) AS payment_pending,
        SUM(${exprPaidViaMissing}) AS paid_via_missing,
        SUM(${exprDeliveryPending}) AS delivery_pending,
        SUM(${exprLeadPending}) AS lead_commission_pending,
        SUM(${exprPickupPending}) AS pickup_commission_pending,
        SUM(${exprKyvPending}) AS kyv_pending
      FROM ${T} t
      LEFT JOIN users cu ON cu.id = t.created_by
      WHERE ${isOpen} AND LOWER(COALESCE(cu.role,'')) = 'admin'
      GROUP BY cu.id, cu.name, cu.email
      ORDER BY cu.name ASC`;

    const [rows]: any = await pool.query(sql);

    const admins: AdminPendingSummary[] = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id),
      name: String(r.name || ''),
      email: r.email ?? null,
      total_open: Number(r.total_open || 0),
      avg_days_open: Number(r.avg_days_open || 0),
      max_days_open: Number(r.max_days_open || 0),
      unassigned: Number(r.unassigned || 0),
      payment_pending: Number(r.payment_pending || 0),
      paid_via_missing: Number(r.paid_via_missing || 0),
      delivery_pending: Number(r.delivery_pending || 0),
      lead_commission_pending: Number(r.lead_commission_pending || 0),
      pickup_commission_pending: Number(r.pickup_commission_pending || 0),
      kyv_pending: Number(r.kyv_pending || 0),
    }));

    return NextResponse.json({ admins });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load pending summary' }, { status: 500 });
  }
}
