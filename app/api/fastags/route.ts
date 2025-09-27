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

  const conditions: string[] = [];
  const values: string[] = [];

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
    conditions.push("f.assigned_to = ?");
    values.push(ownerFilter);
  }
  if (statusFilter) {
    conditions.push("f.status = ?");
    values.push(statusFilter);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = 'LIMIT 100';

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
        COALESCE(u.name, '') AS assigned_to_name,
        COALESCE(s.name, '') AS supplier_name,
        CASE
          WHEN f.status = 'sold' THEN 'User'
          WHEN f.assigned_to_agent_id IS NOT NULL THEN 'Agent'
          ELSE 'Admin'
        END AS holder
      FROM fastags f
      LEFT JOIN users u ON f.assigned_to = u.id
      LEFT JOIN suppliers s ON f.supplier_id = s.id
      ${whereClause}
      ORDER BY f.created_at DESC
      ${limitClause}
  `;

  try {
    const [rows] = await pool.query<RowDataPacket[]>(baseQuery, values);
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
          f.assigned_to
        FROM fastags f
        ${whereClause}
        ORDER BY f.created_at DESC
        ${limitClause}
      `;
      const [fallback] = await pool.query<RowDataPacket[]>(fallbackQuery, values);
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

