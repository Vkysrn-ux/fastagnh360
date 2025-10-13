import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { tag_serials, status, bank_login_user_id } = body || {};
    let serials: string[] = [];
    if (Array.isArray(tag_serials)) serials = tag_serials.map((s: any) => String(s));
    else if (typeof tag_serials === 'string') serials = String(tag_serials).split(/\s*[\n,\s]+\s*/).filter(Boolean);
    if (!serials.length) return NextResponse.json({ error: 'tag_serials required' }, { status: 400 });

    const normalized = String(status || '').toLowerCase();
    if (!['pending','done'].includes(normalized)) return NextResponse.json({ error: 'status must be pending or done' }, { status: 400 });

    let hasMappingStatus = false;
    let hasBankLoginUser = false;
    try { hasMappingStatus = await hasTableColumn('fastags', 'bank_mapping_status'); } catch {}
    if (!hasMappingStatus) {
      try {
        await pool.query(`ALTER TABLE fastags ADD COLUMN bank_mapping_status ENUM('pending','done') NULL`);
        hasMappingStatus = true;
      } catch {}
    }
    try { hasBankLoginUser = await hasTableColumn('fastags', 'bank_login_user_id'); } catch {}
    if (!hasBankLoginUser) {
      try {
        await pool.query(`ALTER TABLE fastags ADD COLUMN bank_login_user_id INT NULL`);
        hasBankLoginUser = true;
      } catch {}
    }

    const inClause = serials.map(() => '?').join(',');
    const setParts: string[] = [];
    const params: any[] = [];
    if (hasMappingStatus) {
      setParts.push('bank_mapping_status = ?');
      params.push(normalized);
    } else {
      setParts.push(`mapping_done = ${normalized === 'done' ? 1 : 0}`);
    }
    if (hasBankLoginUser && (bank_login_user_id === null || bank_login_user_id === undefined || !isNaN(Number(bank_login_user_id)))) {
      if (bank_login_user_id === null || bank_login_user_id === undefined) {
        setParts.push('bank_login_user_id = NULL');
      } else {
        setParts.push('bank_login_user_id = ?');
        params.push(Number(bank_login_user_id));
      }
    }
    const sql = `UPDATE fastags SET ${setParts.join(', ')} WHERE tag_serial IN (${inClause})`;
    const [res] = await pool.query(sql, [...params, ...serials]);
    return NextResponse.json({ success: true, updated: (res as any)?.affectedRows ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

