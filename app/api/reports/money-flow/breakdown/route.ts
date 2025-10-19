// app/api/reports/money-flow/breakdown/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

type PeriodKey = "today" | "week" | "month";

function toSql(dt: Date) {
  return dt.toISOString().slice(0, 19).replace("T", " ");
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// Monday as start of week
function startOfWeek(): Date {
  const d = startOfToday();
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeek(): Date {
  const s = startOfWeek();
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0); // last day of current month
  d.setHours(23, 59, 59, 999);
  return d;
}

async function queryRange(fromSql: string, toSql: string, filters?: { supplier?: string | null; bank?: string | null; klass?: string | null; }) {
  // Columns guards
  const hasPTC = await hasTableColumn("tickets_nh", "payment_to_collect");
  const hasPR = await hasTableColumn("tickets_nh", "payment_received");
  const hasSubject = await hasTableColumn("tickets_nh", "subject");
  const hasKyv = await hasTableColumn("tickets_nh", "kyv_status");

  if (!(hasPTC && hasPR)) {
    return {
      total_received: 0,
      new_fastag_received: 0,
      hotlisted_received: 0,
      replacement_received: 0,
    };
  }

  // Build category CASE predicates depending on available columns
  const subjExpr = hasSubject ? "LOWER(TRIM(COALESCE(subject,'')))" : "''";
  const kyvExpr = hasKyv ? "LOWER(TRIM(COALESCE(kyv_status,'')))" : "''";

  const newFastagCond = `(${subjExpr} LIKE '%new%fastag%' OR ${subjExpr} LIKE 'add new fastag%' OR ${subjExpr} = 'new fastag' OR ${subjExpr} = 'new fastag registration')`;
  const replacementCond = `(${subjExpr} LIKE '%replac%')`;
  const hotlistCond = `(${kyvExpr} IN ('kyv_hotlisted','hotlisted','hotlist') OR ${subjExpr} LIKE '%hotlist%')`;

  const conditions: string[] = ["COALESCE(t.created_at, t.updated_at) BETWEEN ? AND ?"]; 
  const params: any[] = [fromSql, toSql];
  let join = "";
  if (filters?.supplier || filters?.bank || filters?.klass) {
    join = " LEFT JOIN fastags f ON (f.tag_serial COLLATE utf8mb4_general_ci) = (t.fastag_serial COLLATE utf8mb4_general_ci)";
    if (filters?.supplier) { conditions.push("COALESCE(f.supplier_id,0) = ?"); params.push(Number(filters.supplier)); }
    if (filters?.bank) { conditions.push("(COALESCE(f.bank_name, t.fastag_bank) COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)"); params.push(String(filters.bank)); }
    if (filters?.klass) { conditions.push("(COALESCE(f.fastag_class, t.fastag_class) COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)"); params.push(String(filters.klass)); }
  }

  const sql = `
    SELECT
      SUM(CASE WHEN t.payment_received = 1 THEN COALESCE(t.payment_to_collect,0) ELSE 0 END) AS total_received,
      SUM(CASE WHEN t.payment_received = 1 AND ${newFastagCond} THEN COALESCE(t.payment_to_collect,0) ELSE 0 END) AS new_fastag_received,
      SUM(CASE WHEN t.payment_received = 1 AND ${hotlistCond} THEN COALESCE(t.payment_to_collect,0) ELSE 0 END) AS hotlisted_received,
      SUM(CASE WHEN t.payment_received = 1 AND ${replacementCond} THEN COALESCE(t.payment_to_collect,0) ELSE 0 END) AS replacement_received
    FROM tickets_nh t
    ${join}
    WHERE ${conditions.join(" AND ")}
  `;
  const [rows]: any = await pool.query(sql, params);
  const r = Array.isArray(rows) && rows.length ? rows[0] : {};
  // Also compute tags sold count from fastag_sales within same range and filters
  const soldConds: string[] = ["created_at BETWEEN ? AND ?"]; const soldParams: any[] = [fromSql, toSql];
  if (filters?.supplier) { soldConds.push("COALESCE(supplier_id,0) = ?"); soldParams.push(Number(filters.supplier)); }
  if (filters?.bank) { soldConds.push("COALESCE(bank_name,'') = ?"); soldParams.push(String(filters.bank)); }
  if (filters?.klass) { soldConds.push("COALESCE(fastag_class,'') = ?"); soldParams.push(String(filters.klass)); }
  let soldCount = 0;
  try {
    const [srows]: any = await pool.query(`SELECT COUNT(*) AS cnt FROM fastag_sales WHERE ${soldConds.join(" AND ")}`, soldParams);
    soldCount = Number((srows?.[0]?.cnt) || 0);
  } catch {}

  return {
    total_received: Number(r.total_received || 0),
    new_fastag_received: Number(r.new_fastag_received || 0),
    hotlisted_received: Number(r.hotlisted_received || 0),
    replacement_received: Number(r.replacement_received || 0),
    sold_count: soldCount,
  };
}

export async function GET(req: NextRequest) {
  try {
    // Support optional custom range via ?from=&to=, else return 3 presets
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Filters
    const supplierParam = searchParams.get("supplier");
    const bankParam = searchParams.get("bank");
    const classParam = searchParams.get("class");
    const filters = { supplier: supplierParam, bank: bankParam, klass: classParam };

    if (fromParam || toParam) {
      const from = fromParam ? new Date(fromParam) : startOfToday();
      const to = toParam ? new Date(toParam) : endOfToday();
      const result = await queryRange(toSql(from), toSql(to), filters);
      return NextResponse.json({ range: { from: toSql(from), to: toSql(to) }, result });
    }

    // Today
    const tFrom = startOfToday();
    const tTo = endOfToday();
    const today = await queryRange(toSql(tFrom), toSql(tTo), filters);

    // This week (Mon..Sun)
    const wFrom = startOfWeek();
    const wTo = endOfWeek();
    const week = await queryRange(toSql(wFrom), toSql(wTo), filters);

    // This month
    const mFrom = startOfMonth();
    const mTo = endOfMonth();
    const month = await queryRange(toSql(mFrom), toSql(mTo), filters);

    return NextResponse.json({
      periods: {
        today: { from: toSql(tFrom), to: toSql(tTo), ...today },
        week: { from: toSql(wFrom), to: toSql(wTo), ...week },
        month: { from: toSql(mFrom), to: toSql(mTo), ...month },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to compute breakdown" }, { status: 500 });
  }
}
