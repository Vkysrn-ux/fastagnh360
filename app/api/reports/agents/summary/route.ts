import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const from = (searchParams.get('from') || '').trim(); // YYYY-MM-DD
    const to = (searchParams.get('to') || '').trim();

    const hasAssignedAt = await hasTableColumn('fastags', 'assigned_at').catch(()=>false);
    const hasAssignedDate = await hasTableColumn('fastags', 'assigned_date').catch(()=>false);

    const assignedTsExpr = hasAssignedAt
      ? 'f.assigned_at'
      : (hasAssignedDate ? 'STR_TO_DATE(CONCAT(f.assigned_date, " 00:00:00"), "%Y-%m-%d %H:%i:%s")' : 'NULL');

    // WHERE clause for agent selection
    const where: string[] = [
      "u.role IN ('agent','asm','manager','team-leader','tl','shop','showroom','toll-agent','executive','channel-partner','fse','office')"
    ];
    const vals: any[] = [];
    if (q) { where.push("u.name LIKE ?"); vals.push(`%${q}%`); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // time filters apply to assigned period from fastags
    const timeConds: string[] = [];
    const timeVals: any[] = [];
    if (from && assignedTsExpr !== 'NULL') { timeConds.push(`${assignedTsExpr} >= ?`); timeVals.push(`${from} 00:00:00`); }
    if (to && assignedTsExpr !== 'NULL') { timeConds.push(`${assignedTsExpr} <= ?`); timeVals.push(`${to} 23:59:59`); }
    const timeSql = timeConds.length ? timeConds.join(' AND ') : '';
    const timeSqlPrefixed = timeSql ? `AND ${timeSql}` : '';

    // If date filter provided, restrict agents to those having assignments in that window
    const existsSql = timeSql
      ? `AND EXISTS (SELECT 1 FROM fastags f WHERE f.assigned_to_agent_id = u.id AND f.status = 'assigned' AND ${timeSql})`
      : '';

    const sql = `
      SELECT 
        u.id AS agent_id,
        u.name AS agent_name,
        u.role AS agent_role,
        p.id AS parent_id,
        COALESCE(p.name, '') AS parent_name,
        COALESCE(p.role, '') AS parent_role,
        -- assigned
        (SELECT COUNT(*) FROM fastags f WHERE f.assigned_to_agent_id = u.id AND f.status = 'assigned' ${timeSqlPrefixed}) AS assigned_count,
        -- sold (from sales table)
        (SELECT COUNT(*) FROM fastag_sales s WHERE s.sold_by_user_id = u.id OR s.sold_by_agent_id = u.id) AS sold_count,
        -- assigned first/last
        (SELECT MIN(${assignedTsExpr}) FROM fastags f WHERE f.assigned_to_agent_id = u.id AND f.status = 'assigned') AS first_assigned_at,
        (SELECT MAX(${assignedTsExpr}) FROM fastags f WHERE f.assigned_to_agent_id = u.id AND f.status = 'assigned') AS last_assigned_at,
        -- suppliers JSON for available (assigned) inventory
        (
          SELECT JSON_OBJECTAGG(sname, scnt) FROM (
            SELECT COALESCE(s.name,'Unknown') AS sname, COUNT(*) AS scnt
            FROM fastags f
            LEFT JOIN suppliers s ON s.id = f.supplier_id
            WHERE f.assigned_to_agent_id = u.id AND f.status = 'assigned'
            GROUP BY sname
          ) t
        ) AS suppliers
      FROM users u
      LEFT JOIN users p ON p.id = u.parent_user_id
      ${whereSql}
      ${existsSql}
      ORDER BY u.name ASC
    `;

    // Build params: where (name), exists time filter (if any), assigned_count time filter (if any)
    const params: any[] = [...vals];
    if (timeSql) params.push(...timeVals); // for EXISTS
    if (timeSql) params.push(...timeVals); // for assigned_count

    const [rows]: any = await pool.query(sql, params);
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load agent summary' }, { status: 500 });
  }
}
