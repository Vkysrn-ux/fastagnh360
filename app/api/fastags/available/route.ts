// app/api/fastags/available/route.ts
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bank = searchParams.get("bank");
  const fastagClass = searchParams.get("class");
  const assignedTo = searchParams.get("assigned_to");
  const mapping = (searchParams.get("mapping") || '').toLowerCase();
  const supplier = (searchParams.get("supplier") || '').trim();

  if (!bank || !fastagClass) {
    return NextResponse.json([], { status: 200 });
  }

  let sql = "SELECT tag_serial FROM fastags WHERE bank_name = ? AND fastag_class = ? ";
  let params: any[] = [bank, fastagClass];

  if (supplier) {
    sql += "AND COALESCE(supplier_id,0) = ? ";
    params.push(Number(supplier));
  }

  // Optional mapping filters if columns exist
  try {
    const hasMappingStatus = await hasTableColumn('fastags', 'bank_mapping_status');
    const hasMappingDone = await hasTableColumn('fastags', 'mapping_done');
    if (mapping && (hasMappingStatus || hasMappingDone)) {
      if (mapping === 'done') {
        if (hasMappingStatus) sql += "AND bank_mapping_status = 'done' ";
        else if (hasMappingDone) sql += "AND COALESCE(mapping_done,0)=1 ";
      } else if (mapping === 'pending') {
        if (hasMappingStatus) sql += "AND COALESCE(bank_mapping_status,'pending') = 'pending' ";
        else if (hasMappingDone) sql += "AND COALESCE(mapping_done,0)=0 ";
      }
    }
  } catch {}

  if (assignedTo && assignedTo !== "admin") {
    sql += "AND assigned_to_agent_id = ? AND status = 'assigned' ORDER BY tag_serial ASC";
    params.push(Number(assignedTo));
  } else {
    // Admin warehouse
    sql += "AND assigned_to_agent_id IS NULL AND status = 'in_stock' ORDER BY tag_serial ASC";
  }

  try {
    const [rows] = await pool.query(sql, params);
    return NextResponse.json(rows, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
