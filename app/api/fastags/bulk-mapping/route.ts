import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { tag_serials, status } = body || {};
    let serials: string[] = [];
    if (Array.isArray(tag_serials)) serials = tag_serials.map((s: any) => String(s));
    else if (typeof tag_serials === 'string') serials = String(tag_serials).split(/\s*[\n,\s]+\s*/).filter(Boolean);
    if (!serials.length) return NextResponse.json({ error: 'tag_serials required' }, { status: 400 });

    const normalized = String(status || '').toLowerCase();
    if (!['pending','done'].includes(normalized)) return NextResponse.json({ error: 'status must be pending or done' }, { status: 400 });

    let hasMappingStatus = false;
    try { hasMappingStatus = await hasTableColumn('fastags', 'bank_mapping_status'); } catch {}
    if (!hasMappingStatus) {
      try {
        await pool.query(`ALTER TABLE fastags ADD COLUMN bank_mapping_status ENUM('pending','done') NULL`);
        hasMappingStatus = true;
      } catch {}
    }

    const inClause = serials.map(() => '?').join(',');
    const params: any[] = [normalized, ...serials];
    const sql = hasMappingStatus
      ? `UPDATE fastags SET bank_mapping_status = ? WHERE tag_serial IN (${inClause})`
      : `UPDATE fastags SET mapping_done = ${normalized === 'done' ? 1 : 0} WHERE tag_serial IN (${inClause})`;
    const [res] = await pool.query(sql, hasMappingStatus ? params : serials);
    return NextResponse.json({ success: true, updated: (res as any)?.affectedRows ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

