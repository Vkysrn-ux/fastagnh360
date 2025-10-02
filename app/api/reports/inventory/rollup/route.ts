import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = (searchParams.get('from') || '').trim(); // YYYY-MM-DD
    const to = (searchParams.get('to') || '').trim();
    const bank = (searchParams.get('bank') || '').trim();
    const fclass = (searchParams.get('class') || '').trim();
    const supplier = (searchParams.get('supplier') || '').trim(); // id
    const agent = (searchParams.get('agent') || '').trim(); // id

    const hasAssignedAt = await hasTableColumn('fastags', 'assigned_at').catch(()=>false);
    const hasAssignedDate = await hasTableColumn('fastags', 'assigned_date').catch(()=>false);

    const whereFastags: string[] = [];
    const valsFastags: any[] = [];
    if (bank) { whereFastags.push('f.bank_name = ?'); valsFastags.push(bank); }
    if (fclass) { whereFastags.push('f.fastag_class = ?'); valsFastags.push(fclass); }
    if (supplier) { whereFastags.push('f.supplier_id = ?'); valsFastags.push(Number(supplier)); }
    const baseWhereFastags = whereFastags.length ? `AND ${whereFastags.join(' AND ')}` : '';

    const whereSalesJoinFastags: string[] = [];
    const valsSales: any[] = [];
    if (bank) { whereSalesJoinFastags.push('f.bank_name = ?'); valsSales.push(bank); }
    if (fclass) { whereSalesJoinFastags.push('f.fastag_class = ?'); valsSales.push(fclass); }
    if (supplier) { whereSalesJoinFastags.push('f.supplier_id = ?'); valsSales.push(Number(supplier)); }
    const salesJoinWhere = whereSalesJoinFastags.length ? `AND ${whereSalesJoinFastags.join(' AND ')}` : '';

    const dateFrom = from ? `${from} 00:00:00` : '';
    const dateTo = to ? `${to} 23:59:59` : '';

    // Added per day (grouped by bank/class/supplier)
    const whereAdded: string[] = [];
    const valsAdded: any[] = [];
    if (from) { whereAdded.push('f.created_at >= ?'); valsAdded.push(dateFrom); }
    if (to) { whereAdded.push('f.created_at <= ?'); valsAdded.push(dateTo); }
    const addedWhereSql = whereAdded.length ? `AND ${whereAdded.join(' AND ')}` : '';
    const sqlAdded = `
      SELECT DATE(f.created_at) AS d, f.bank_name, f.fastag_class, f.supplier_id, COALESCE(s.name,'') AS supplier_name, COUNT(*) AS c
      FROM fastags f
      LEFT JOIN suppliers s ON s.id = f.supplier_id
      WHERE 1 ${baseWhereFastags} ${addedWhereSql}
      GROUP BY DATE(f.created_at), f.bank_name, f.fastag_class, f.supplier_id, supplier_name
    `;

    // Assigned per day (by assigned_at or assigned_date)
    const assignedTs = hasAssignedAt
      ? 'f.assigned_at'
      : (hasAssignedDate ? 'STR_TO_DATE(CONCAT(f.assigned_date, " 00:00:00"), "%Y-%m-%d %H:%i:%s")' : null);
    const whereAssigned: string[] = [];
    const valsAssigned: any[] = [];
    if (agent) { whereAssigned.push('f.assigned_to_agent_id = ?'); valsAssigned.push(Number(agent)); }
    if (from && assignedTs) { whereAssigned.push(`${assignedTs} >= ?`); valsAssigned.push(dateFrom); }
    if (to && assignedTs) { whereAssigned.push(`${assignedTs} <= ?`); valsAssigned.push(dateTo); }
    const assignedWhereSql = whereAssigned.length ? `AND ${whereAssigned.join(' AND ')}` : '';
    const sqlAssigned = assignedTs ? `
      SELECT DATE(${assignedTs}) AS d, f.bank_name, f.fastag_class, f.supplier_id, COALESCE(s.name,'') AS supplier_name, COUNT(*) AS c
      FROM fastags f
      LEFT JOIN suppliers s ON s.id = f.supplier_id
      WHERE f.status = 'assigned' ${baseWhereFastags} ${assignedWhereSql}
      GROUP BY DATE(${assignedTs}), f.bank_name, f.fastag_class, f.supplier_id, supplier_name
    ` : `SELECT NULL AS d, NULL AS bank_name, NULL AS fastag_class, NULL AS supplier_id, NULL AS supplier_name, 0 AS c LIMIT 0`;

    // Sold per day (by fastag_sales.created_at), join filters from fastags
    const whereSold: string[] = [];
    const valsSold: any[] = [];
    if (agent) { whereSold.push('(s.sold_by_user_id = ? OR s.sold_by_agent_id = ?)'); valsSold.push(Number(agent), Number(agent)); }
    if (from) { whereSold.push('s.created_at >= ?'); valsSold.push(dateFrom); }
    if (to) { whereSold.push('s.created_at <= ?'); valsSold.push(dateTo); }
    const soldWhereSql = whereSold.length ? `AND ${whereSold.join(' AND ')}` : '';
    const sqlSold = `
      SELECT DATE(s.created_at) AS d, f.bank_name, f.fastag_class, f.supplier_id, COALESCE(sp.name,'') AS supplier_name, COUNT(*) AS c
      FROM fastag_sales s
      LEFT JOIN fastags f ON (f.tag_serial COLLATE utf8mb4_general_ci) = (s.tag_serial COLLATE utf8mb4_general_ci)
      LEFT JOIN suppliers sp ON sp.id = f.supplier_id
      WHERE 1 ${salesJoinWhere} ${soldWhereSql}
      GROUP BY DATE(s.created_at), f.bank_name, f.fastag_class, f.supplier_id, supplier_name
    `;

    const [addedRows]: any = await pool.query(sqlAdded, [...valsFastags, ...valsAdded]);
    const [assignedRows]: any = await pool.query(sqlAssigned, assignedTs ? [...valsFastags, ...valsAssigned] : []);
    const [soldRows]: any = await pool.query(sqlSold, [...valsSales, ...valsSold]);

    // Merge by date+bank+class+supplier
    type Key = string;
    const keyOf = (d: any, b: any, c: any, sid: any) => `${String(d).slice(0,10)}|${b||''}|${c||''}|${sid??''}`;
    const map: Record<Key, { sortKey: string, date: string, bank_name: string, fastag_class: string, supplier_id: number|null, supplier_name: string, added: number, assigned: number, sold: number }> = {};
    const normalizeDate = (val: any) => {
      if (val instanceof Date) return val.toISOString().slice(0,10);
      const s = String(val);
      // if already YYYY-MM-DD keep, else try parse
      if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0,10))) return s.slice(0,10);
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toISOString().slice(0,10);
    };
    const toDMY = (ymd: string) => {
      const m = String(ymd).slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      return ymd;
    };
    const upsert = (arr: any[], field: 'added'|'assigned'|'sold') => {
      for (const r of (arr||[])) {
        const ymd = normalizeDate(r.d);
        const dsp = toDMY(ymd);
        const k = keyOf(ymd, r.bank_name || '', r.fastag_class || '', r.supplier_id ?? null);
        if (!map[k]) map[k] = { sortKey: ymd, date: dsp, bank_name: r.bank_name || '', fastag_class: r.fastag_class || '', supplier_id: r.supplier_id ?? null, supplier_name: r.supplier_name || '', added: 0, assigned: 0, sold: 0 };
        map[k][field] += Number(r.c || 0);
      }
    };
    upsert(addedRows, 'added');
    upsert(assignedRows, 'assigned');
    upsert(soldRows, 'sold');

    const rowsSorted = Object.values(map).sort((a,b)=> a.sortKey.localeCompare(b.sortKey) || a.bank_name.localeCompare(b.bank_name) || a.fastag_class.localeCompare(b.fastag_class) || String(a.supplier_name).localeCompare(String(b.supplier_name)) );
    const rowsOut = rowsSorted.map(({ sortKey, ...rest }) => rest);

    const totals = rowsOut.reduce((acc, r) => { acc.added += r.added; acc.assigned += r.assigned; acc.sold += r.sold; return acc; }, { added: 0, assigned: 0, sold: 0 });

    return NextResponse.json({ rows: rowsOut, totals });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to build inventory rollup' }, { status: 500 });
  }
}
