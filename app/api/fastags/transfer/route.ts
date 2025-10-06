import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

// Transfer FASTags by class + batch from one agent to another (or admin)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const from_agent_id = Number(body?.from_agent_id);
    const to_agent_id_raw = body?.to_agent_id;
    const class_type = String(body?.class_type || "").trim();
    const batch_number = String(body?.batch_number || "").trim();

    if (!class_type || !batch_number || (!from_agent_id || isNaN(from_agent_id))) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const to_agent_id = to_agent_id_raw === 'admin' ? null : Number(to_agent_id_raw);
    if (to_agent_id_raw !== 'admin' && (!to_agent_id || isNaN(to_agent_id))) {
      return NextResponse.json({ error: "Invalid destination" }, { status: 400 });
    }

    // Select eligible tags: owned by from_agent and currently assigned
    const [rows]: any = await pool.query(
      `SELECT id FROM fastags
       WHERE assigned_to_agent_id = ? AND fastag_class = ? AND batch_number = ? AND status = 'assigned'`,
      [from_agent_id, class_type, batch_number]
    );
    const ids: number[] = (rows || []).map((r: any) => Number(r.id));
    if (!ids.length) {
      return NextResponse.json({ error: "No matching FASTags found for transfer." }, { status: 404 });
    }

    // Update ownership; to admin -> in_stock, to agent -> assigned
    const statusValue = to_agent_id === null ? 'in_stock' : 'assigned';

    // Optional mapping update when provided
    const mappingRaw = typeof body?.mapping === 'string' ? String(body.mapping).toLowerCase() : '';
    const mappingValue = mappingRaw === 'done' ? 'done' : (mappingRaw === 'pending' ? 'pending' : null);
    let hasMappingStatus = false;
    try { hasMappingStatus = await hasTableColumn('fastags', 'bank_mapping_status'); } catch {}

    const setParts: string[] = [
      `assigned_to_agent_id = ?`,
      `status = ?`,
      `assigned_date = CURDATE()` ,
      `assigned_at = NOW()`
    ];
    const params: any[] = [to_agent_id, statusValue];
    if (hasMappingStatus && (mappingValue === 'pending' || mappingValue === 'done')) {
      setParts.push(`bank_mapping_status = ?`);
      params.push(mappingValue);
    }
    await pool.query(
      `UPDATE fastags SET ${setParts.join(', ')} WHERE id IN (${ids.map(() => '?').join(',')})`,
      [...params, ...ids]
    );

    return NextResponse.json({ success: true, transferred: ids.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

