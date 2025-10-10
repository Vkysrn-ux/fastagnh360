import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = Number(id);
  if (!Number.isFinite(agentId) || agentId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const mappingFilter = (searchParams.get("mapping") || '').trim().toLowerCase();

    // Discover optional mapping columns
    let hasMappingStatus = false;
    let hasMappingDone = false;
    try { hasMappingStatus = await hasTableColumn('fastags', 'bank_mapping_status'); } catch {}
    try { hasMappingDone = await hasTableColumn('fastags', 'mapping_done'); } catch {}

    const mappingWhere: string[] = [];
    if (mappingFilter && (hasMappingStatus || hasMappingDone)) {
      if (mappingFilter === 'done') {
        if (hasMappingStatus) mappingWhere.push("f.bank_mapping_status = 'done'");
        else if (hasMappingDone) mappingWhere.push("COALESCE(f.mapping_done,0)=1");
      } else if (mappingFilter === 'pending') {
        if (hasMappingStatus) mappingWhere.push("COALESCE(f.bank_mapping_status,'pending') = 'pending'");
        else if (hasMappingDone) mappingWhere.push("COALESCE(f.mapping_done,0)=0");
      }
    }

    const whereClause = [
      "f.assigned_to_agent_id = ?",
      "f.status = 'assigned'",
      "NOT EXISTS (SELECT 1 FROM tickets_nh t WHERE (t.fastag_serial COLLATE utf8mb4_general_ci) = (f.tag_serial COLLATE utf8mb4_general_ci))",
      ...mappingWhere,
    ].join(" AND ");

    const [rows] = await pool.query(
      `SELECT 
         COALESCE(f.bank_name, '') AS bank_name,
         COALESCE(f.fastag_class, '') AS fastag_class,
         COALESCE(f.supplier_id, 0) AS supplier_id,
         COALESCE(s.name, '') AS supplier_name,
         COUNT(*) AS available
       FROM fastags f
       LEFT JOIN suppliers s ON s.id = f.supplier_id
       WHERE ${whereClause}
       GROUP BY f.supplier_id, s.name, f.bank_name, f.fastag_class
       ORDER BY s.name, f.bank_name, f.fastag_class`,
      [agentId]
    );
    return NextResponse.json(rows || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
