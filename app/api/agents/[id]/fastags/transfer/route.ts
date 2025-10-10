// app/api/agents/[id]/fastags/transfer/route.ts

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function POST(req: NextRequest) {
  try {
    const { from_agent_id, to_agent_id, class_type, batch_number, mapping } = await req.json();

    if (!from_agent_id || !to_agent_id || !class_type || !batch_number) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get eligible FASTags from from_agent_id
    const [rows] = await pool.query(
      `SELECT id FROM fastags 
         WHERE assigned_to_agent_id = ? AND fastag_class = ? AND batch_number = ? AND status = 'assigned'
           AND NOT EXISTS (
             SELECT 1 FROM tickets_nh t
              WHERE (t.fastag_serial COLLATE utf8mb4_general_ci) = (fastags.tag_serial COLLATE utf8mb4_general_ci)
           )`,
      [from_agent_id, class_type, batch_number]
    );

    const fastags = rows as { id: number }[];

    if (fastags.length === 0) {
      return NextResponse.json({ error: "No matching FASTags found for transfer." }, { status: 404 });
    }

    // Update the agent assignment + status + dates
    const ids = fastags.map(tag => tag.id);
    const statusValue = to_agent_id === null ? 'in_stock' : 'assigned';

    // Optional mapping status when provided
    const mappingRaw = typeof mapping === 'string' ? String(mapping).toLowerCase() : '';
    const mappingValue = mappingRaw === 'done' ? 'done' : (mappingRaw === 'pending' ? 'pending' : null);
    let hasMappingStatus = false;
    try { hasMappingStatus = await hasTableColumn('fastags', 'bank_mapping_status'); } catch {}

    const setParts: string[] = [
      `assigned_to_agent_id = ?`,
      `status = ?`,
      `assigned_date = CURDATE()`,
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
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
