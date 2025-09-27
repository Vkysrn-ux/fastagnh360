import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const serials: string[] = Array.isArray(body?.tag_serials)
      ? body.tag_serials.map((s: any) => String(s).trim()).filter(Boolean)
      : String(body?.tag_serials || "")
          .split(/\r?\n|,|\s+/)
          .map((s) => s.trim())
          .filter(Boolean);

    if (!serials.length) {
      return NextResponse.json({ error: "Provide tag_serials (array or newline/comma separated)" }, { status: 400 });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const placeholders = serials.map(() => '?').join(',');
      const [result]: any = await conn.query(
        `UPDATE fastags
         SET status = 'sold', assigned_to = NULL, assigned_to_agent_id = NULL
         WHERE tag_serial IN (${placeholders})`,
        serials
      );
      await conn.commit();
      return NextResponse.json({ ok: true, updated: result?.affectedRows || 0 });
    } catch (e: any) {
      try { await pool.query('ROLLBACK'); } catch {}
      return NextResponse.json({ error: e.message }, { status: 500 });
    } finally {
      pool.releaseConnection(conn);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

