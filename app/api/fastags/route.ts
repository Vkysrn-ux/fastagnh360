import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

function normalizeFastagRow(row: any) {
  return {
    id: Number(row.id ?? 0),
    tag_serial: row.tag_serial ? String(row.tag_serial) : "",
    fastag_class: row.fastag_class ? String(row.fastag_class) : "",
    bank_name: row.bank_name ? String(row.bank_name) : "",
    batch_number: row.batch_number ? String(row.batch_number) : "",
    status: row.status ? String(row.status) : "",
    assigned_to_agent_id:
      row.assigned_to_agent_id !== undefined && row.assigned_to_agent_id !== null
        ? Number(row.assigned_to_agent_id)
        : null,
    assigned_to:
      row.assigned_to !== undefined && row.assigned_to !== null ? Number(row.assigned_to) : null,
    assigned_to_name: row.assigned_to_name ? String(row.assigned_to_name) : "",
    holder: row.holder ? String(row.holder) : "",
    supplier_id: row.supplier_id !== undefined && row.supplier_id !== null ? Number(row.supplier_id) : null,
    supplier_name: row.supplier_name ? String(row.supplier_name) : "",
    created_at: row.created_at ?? null,
    assigned_at: row.assigned_at ?? null,
    assigned_date: row.assigned_date ?? null,
    sold_at: row.sold_at ?? null,
    sold_by_user_id: row.sold_by_user_id !== undefined && row.sold_by_user_id !== null ? Number(row.sold_by_user_id) : null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const queryTerm = (searchParams.get("query") || "").trim();
  const bankFilter = (searchParams.get("bank") || "").trim();
  const classFilter = (searchParams.get("class") || "").trim();
  const ownerFilter = (searchParams.get("owner") || searchParams.get("assigned_to") || "").trim();
  const statusFilter = (searchParams.get("status") || "").trim();
  const supplierFilter = (searchParams.get("supplier") || searchParams.get("supplier_id") || "").trim();
  const bankLike = (searchParams.get("bank_like") || "").trim();
  const classLike = (searchParams.get("class_like") || "").trim();
  // Optional pagination (no limit by default)
  const limitParamRaw = searchParams.get("limit");
  const offsetParamRaw = searchParams.get("offset");
  const hasLimit = !!limitParamRaw;
  const limit = hasLimit ? Math.max(1, Math.floor(Number(limitParamRaw))) : 0;
  const offset = offsetParamRaw ? Math.max(0, Math.floor(Number(offsetParamRaw))) : 0;
  // Date range filters
  const createdFrom = (searchParams.get("created_from") || "").trim(); // YYYY-MM-DD
  const createdTo = (searchParams.get("created_to") || "").trim();
  const assignedFrom = (searchParams.get("assigned_from") || "").trim();
  const assignedTo = (searchParams.get("assigned_to") || "").trim();
  const soldFrom = (searchParams.get("sold_from") || "").trim();
  const soldTo = (searchParams.get("sold_to") || "").trim();

  const conditions: string[] = [];
  const values: any[] = [];

  if (queryTerm) {
    conditions.push("f.tag_serial LIKE ?");
    values.push(`%${queryTerm}%`);
  }
  if (bankFilter) {
    conditions.push("f.bank_name = ?");
    values.push(bankFilter);
  }
  if (classFilter) {
    conditions.push("f.fastag_class = ?");
    values.push(classFilter);
  }
  if (ownerFilter) {
    conditions.push("(f.assigned_to_agent_id = ? OR f.assigned_to = ?)");
    values.push(ownerFilter, ownerFilter);
  }
  if (statusFilter) {
    conditions.push("f.status = ?");
    values.push(statusFilter);
  }
  // Created/added date range
  if (createdFrom) { conditions.push("f.created_at >= ?"); values.push(`${createdFrom} 00:00:00`); }
  if (createdTo) { conditions.push("f.created_at <= ?"); values.push(`${createdTo} 23:59:59`); }
  // Assigned date range
  if (assignedFrom) {
    // prefer assigned_at if present, else assigned_date
    conditions.push("( (f.assigned_at IS NOT NULL AND f.assigned_at >= ?) OR (f.assigned_at IS NULL AND f.assigned_date IS NOT NULL AND f.assigned_date >= ?) )");
    values.push(`${assignedFrom} 00:00:00`, assignedFrom);
  }
  if (assignedTo) {
    conditions.push("( (f.assigned_at IS NOT NULL AND f.assigned_at <= ?) OR (f.assigned_at IS NULL AND f.assigned_date IS NOT NULL AND f.assigned_date <= ?) )");
    values.push(`${assignedTo} 23:59:59`, assignedTo);
  }
  // Sold date range via fastag_sales snapshot; use EXISTS to avoid joins duplication
  if (soldFrom) {
    conditions.push(
      "EXISTS (SELECT 1 FROM fastag_sales s WHERE (s.tag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci) AND s.created_at >= ?)"
    );
    values.push(`${soldFrom} 00:00:00`);
  }
  if (soldTo) {
    conditions.push(
      "EXISTS (SELECT 1 FROM fastag_sales s2 WHERE (s2.tag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci) AND s2.created_at <= ?)"
    );
    values.push(`${soldTo} 23:59:59`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = hasLimit ? 'LIMIT ? OFFSET ?' : '';

  const baseQuery = `
      SELECT
        f.id,
        f.tag_serial,
        f.fastag_class,
        f.bank_name,
        f.batch_number,
        f.status,
        f.supplier_id,
        f.assigned_to_agent_id,
        f.assigned_to,
        f.created_at,
        f.assigned_at,
        f.assigned_date,
        (SELECT MIN(fs.created_at)
           FROM fastag_sales fs
          WHERE (fs.tag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci)
        ) AS sold_at,
        (SELECT COALESCE(s.sold_by_user_id, s.sold_by_agent_id)
           FROM fastag_sales s
          WHERE (s.tag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci)
          ORDER BY s.created_at ASC
          LIMIT 1
        ) AS sold_by_user_id,
        COALESCE(u.name, '') AS assigned_to_name,
        COALESCE(s.name, '') AS supplier_name,
        CASE
          WHEN f.status = 'sold' THEN 'User'
          WHEN f.assigned_to_agent_id IS NOT NULL THEN 'Agent'
          ELSE 'Admin'
        END AS holder
      FROM fastags f
      LEFT JOIN users u ON f.assigned_to_agent_id = u.id
      LEFT JOIN suppliers s ON f.supplier_id = s.id
      ${whereClause}
      ORDER BY f.created_at DESC
      ${limitClause}
  `;

  // Prepare query params once for use in both primary and fallback queries
  const queryParams = hasLimit ? [...values, limit, offset] : values;

  try {
    const [rows] = await pool.query<RowDataPacket[]>(baseQuery, queryParams);
    return NextResponse.json(rows.map((row) => normalizeFastagRow(row)));
  } catch (primaryError) {
    console.error('Primary FASTag query failed:', primaryError);

    try {
      const fallbackQuery = `
        SELECT
          f.id,
          f.tag_serial,
          f.fastag_class,
          f.bank_name,
          f.batch_number,
          f.status,
          f.supplier_id,
          f.assigned_to_agent_id,
          f.assigned_to,
          f.created_at,
          f.assigned_at,
          f.assigned_date,
          (SELECT MIN(fs.created_at)
             FROM fastag_sales fs
            WHERE (fs.tag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci)
          ) AS sold_at,
          (SELECT COALESCE(s.sold_by_user_id, s.sold_by_agent_id)
             FROM fastag_sales s
            WHERE (s.tag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci)
            ORDER BY s.created_at ASC
            LIMIT 1
          ) AS sold_by_user_id
        FROM fastags f
        ${whereClause}
        ORDER BY f.created_at DESC
        ${limitClause}
      `;
      const [fallback] = await pool.query<RowDataPacket[]>(fallbackQuery, queryParams);
      const normalized = fallback.map((row) =>
        normalizeFastagRow({
          ...row,
          assigned_to_name: '',
          holder:
            row.status && String(row.status).toLowerCase() === 'sold'
              ? 'User'
              : row.assigned_to_agent_id !== null
                ? 'Agent'
                : 'Admin',
        }),
      );
      return NextResponse.json(normalized);
    } catch (fallbackError) {
      console.error('Fallback FASTag query failed:', fallbackError);
      return NextResponse.json([], { status: 200 });
    }
  }
}

