// app/api/fastags/available/route.ts
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bankRaw = (searchParams.get("bank") || '').trim();
  const fastagClass = searchParams.get("class");
  const assignedTo = searchParams.get("assigned_to");
  // Do not filter by mapping status unless explicitly requested
  const mapping = (searchParams.get("mapping") || '').toLowerCase();
  const supplier = (searchParams.get("supplier") || '').trim();
  const query = (searchParams.get("query") || '').trim();
  // Allow larger batch retrieval for admin bulk transfer use-cases
  const limit = Math.max(1, Math.min(5000, Number(searchParams.get('limit') || 20)));

  if (!bankRaw || !fastagClass) {
    return NextResponse.json([], { status: 200 });
  }

  // Build dynamic owner subselect based on available columns in tickets_nh
  const hasPickup = await hasTableColumn('tickets_nh', 'pickup_point_name').catch(() => false);
  const hasFirst = await hasTableColumn('tickets_nh', 'first_name').catch(() => false);
  const hasLast = await hasTableColumn('tickets_nh', 'last_name').catch(() => false);
  const ownerParts: string[] = ["NULLIF(TRIM(t.customer_name), '')", "NULLIF(TRIM(t.phone), '')"];
  if (hasPickup) ownerParts.splice(1, 0, "NULLIF(TRIM(t.pickup_point_name), '')");
  if (hasFirst || hasLast) ownerParts.splice(ownerParts.length - 1, 0, "NULLIF(TRIM(CONCAT_WS(' ', t.first_name, t.last_name)), '')");
  const ownerSubselect = `SELECT COALESCE(${ownerParts.join(', ')})\n            FROM tickets_nh t\n            WHERE (t.fastag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci)\n            ORDER BY t.created_at DESC LIMIT 1`;

  // Include bank login user details if the optional column exists
  let hasBankLoginUser = false;
  try {
    hasBankLoginUser = await hasTableColumn('fastags', 'bank_login_user_id');
  } catch {}

  let sql = `SELECT 
      f.tag_serial,
      f.bank_name,
      f.fastag_class,
      f.assigned_to_agent_id,
      f.assigned_to,
      COALESCE(ua.name, uu.name, '') AS assigned_to_name,
      ${hasBankLoginUser ? 'f.bank_login_user_id' : 'NULL AS bank_login_user_id'},
      ${hasBankLoginUser ? "COALESCE(blu.name,'')" : "''"} AS bank_login_user_name,
      COALESCE(
        CASE 
          WHEN f.status = 'sold' THEN ( ${ownerSubselect} )
          WHEN f.assigned_to IS NOT NULL THEN uu.name
          WHEN f.assigned_to_agent_id IS NOT NULL THEN ua.name
          ELSE ''
        END,
        ua.name,
        uu.name,
        ''
      ) AS owner_name,
      CASE
        WHEN f.status = 'sold' THEN 'User'
        WHEN f.assigned_to_agent_id IS NOT NULL THEN 'Agent'
        ELSE 'Admin'
      END AS holder
    FROM fastags f
    LEFT JOIN users ua ON f.assigned_to_agent_id = ua.id
    LEFT JOIN users uu ON f.assigned_to = uu.id
    ${hasBankLoginUser ? 'LEFT JOIN users blu ON f.bank_login_user_id = blu.id' : ''}
    WHERE f.fastag_class = ? `;
  let params: any[] = [fastagClass];

  // Handle common bank aliases (case-insensitive)
  const aliasMap: Record<string, string[]> = {
    'QUIKWALLET': ['QUIKWALLET', 'QuikWallet', 'LIVQUIK', 'LivQuik', 'Livquik'],
    'LIVQUIK': ['QUIKWALLET', 'QuikWallet', 'LIVQUIK', 'LivQuik', 'Livquik'],
  };
  const bankKey = bankRaw.toUpperCase();
  const bankList = aliasMap[bankKey] || [bankRaw];
  if (bankList.length) {
    sql += `AND f.bank_name IN (${bankList.map(() => '?').join(',')}) `;
    params.push(...bankList);
  }

  if (supplier) {
    sql += "AND COALESCE(f.supplier_id,0) = ? ";
    params.push(Number(supplier));
  }

  // Optional mapping filters if columns exist
  try {
    const hasMappingStatus = await hasTableColumn('fastags', 'bank_mapping_status');
    const hasMappingDone = await hasTableColumn('fastags', 'mapping_done');
    if (mapping && (hasMappingStatus || hasMappingDone)) {
      if (mapping === 'done') {
        if (hasMappingStatus) sql += "AND f.bank_mapping_status = 'done' ";
        else if (hasMappingDone) sql += "AND COALESCE(f.mapping_done,0)=1 ";
      } else if (mapping === 'pending') {
        if (hasMappingStatus) sql += "AND COALESCE(f.bank_mapping_status,'pending') = 'pending' ";
        else if (hasMappingDone) sql += "AND COALESCE(f.mapping_done,0)=0 ";
      }
    }
  } catch {}

  // Exclude any tag already used in tickets
  sql += "AND NOT EXISTS (SELECT 1 FROM tickets_nh t WHERE (t.fastag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci)) ";

  // Optional typed prefix filter
  if (query) {
    // Use contains match to make typing anywhere in the barcode useful
    sql += "AND f.tag_serial LIKE ? ";
    params.push(`%${query}%`);
  }

  if (assignedTo && assignedTo !== "admin") {
    sql += "AND f.assigned_to_agent_id = ? AND f.status = 'assigned' ORDER BY f.tag_serial ASC";
    params.push(Number(assignedTo));
  } else if (assignedTo === 'admin') {
    // Admin warehouse only; treat NULL status as in_stock
    sql += "AND f.assigned_to_agent_id IS NULL AND (f.status = 'in_stock' OR f.status IS NULL) ORDER BY f.tag_serial ASC";
  } else {
    // No owner specified: include admin stock (status NULL or in_stock) and assigned agent stock
    sql += "AND ((f.assigned_to_agent_id IS NULL AND (f.status = 'in_stock' OR f.status IS NULL)) OR (f.assigned_to_agent_id IS NOT NULL AND f.status = 'assigned')) ORDER BY f.tag_serial ASC";
  }
  sql += " LIMIT ?";
  params.push(limit);

  try {
    const [rows] = await pool.query(sql, params);
    return NextResponse.json(rows, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

