// app/api/reports/money-flow/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

// Returns aggregate totals derived from tickets_nh for money flow
// - amount_received: SUM(payment_to_collect) where payment_received = 1
// - commission_paid: SUM(commission_amount) where commission_done = 1
// - lead_commission_paid: SUM(lead_commission) where lead_commission_paid = 1
// Optional query params: from, to (date/datetime); filter by created_at between [from, to]
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const supplierParam = searchParams.get("supplier"); // id
    const bankParam = searchParams.get("bank");
    const classParam = searchParams.get("class");

    // Build optional date range filter on created_at
    let where = "WHERE 1=1";
    const params: any[] = [];
    if (fromParam) {
      where += " AND COALESCE(created_at, updated_at) >= ?";
      params.push(fromParam);
    }
    if (toParam) {
      where += " AND COALESCE(created_at, updated_at) <= ?";
      params.push(toParam);
    }

    // Detect column availability to avoid query failures on fresh DBs
    const hasPTC = await hasTableColumn("tickets_nh", "payment_to_collect");
    const hasPR = await hasTableColumn("tickets_nh", "payment_received");
    const hasCA = await hasTableColumn("tickets_nh", "commission_amount");
    const hasCD = await hasTableColumn("tickets_nh", "commission_done");
    const hasLC = await hasTableColumn("tickets_nh", "lead_commission");
    const hasLCP = await hasTableColumn("tickets_nh", "lead_commission_paid");
    const hasFastagSerial = await hasTableColumn("tickets_nh", "fastag_serial");

    const selectParts: string[] = [];
    // Amount received (from customer)
    if (hasPTC && hasPR) {
      selectParts.push(
        "SUM(CASE WHEN payment_received = 1 THEN COALESCE(payment_to_collect, 0) ELSE 0 END) AS amount_received"
      );
    } else {
      selectParts.push("0 AS amount_received");
    }
    // Commission paid (generic commission to seller/pickup)
    if (hasCA && hasCD) {
      selectParts.push(
        "SUM(CASE WHEN commission_done = 1 THEN COALESCE(commission_amount, 0) ELSE 0 END) AS commission_paid"
      );
    } else {
      selectParts.push("0 AS commission_paid");
    }
    // Lead commission paid
    if (hasLC && hasLCP) {
      selectParts.push(
        "SUM(CASE WHEN lead_commission_paid = 1 THEN COALESCE(lead_commission, 0) ELSE 0 END) AS lead_commission_paid"
      );
    } else {
      selectParts.push("0 AS lead_commission_paid");
    }

    // Optional join to fastags for supplier/bank/class filters
    let sql = `SELECT ${selectParts.join(", ")} FROM tickets_nh t`;
    let whereExtra = "";
    if (supplierParam || bankParam || classParam) {
      sql += ` LEFT JOIN fastags f ON (f.tag_serial COLLATE utf8mb4_general_ci) = (t.fastag_serial COLLATE utf8mb4_general_ci)`;
      if (supplierParam) { whereExtra += ` AND COALESCE(f.supplier_id, 0) = ?`; params.push(Number(supplierParam)); }
      if (bankParam) { whereExtra += ` AND (COALESCE(f.bank_name, t.fastag_bank) COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)`; params.push(String(bankParam)); }
      if (classParam) { whereExtra += ` AND (COALESCE(f.fastag_class, t.fastag_class) COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)`; params.push(String(classParam)); }
    }
    sql += ` ${where}${whereExtra}`;
    const [rows]: any = await pool.query(sql, params);
    const row = Array.isArray(rows) && rows.length ? rows[0] : {};

    const result = {
      amount_received: Number(row.amount_received || 0),
      commission_paid: Number(row.commission_paid || 0),
      lead_commission_paid: Number(row.lead_commission_paid || 0),
      from: fromParam || null,
      to: toParam || null,
    };

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to compute money flow" },
      { status: 500 }
    );
  }
}
