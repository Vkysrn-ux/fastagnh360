import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tag_serial = String(body?.tag_serial || '').trim();
    const to_status = String(body?.to_status || 'in_stock').trim();
    if (!tag_serial) {
      return NextResponse.json({ error: 'tag_serial is required' }, { status: 400 });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Delete only the latest sale row for this tag
      const [latest]: any = await conn.query(
        `SELECT id FROM fastag_sales 
          WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)
          ORDER BY id DESC LIMIT 1`,
        [tag_serial]
      );
      if (Array.isArray(latest) && latest.length) {
        await conn.query(`DELETE FROM fastag_sales WHERE id = ?`, [latest[0].id]);
      }

      // If no sales row remains, revert fastag to inventory and clear seller
      const [rem]: any = await conn.query(
        `SELECT 1 FROM fastag_sales WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci) LIMIT 1`,
        [tag_serial]
      );
      if (!Array.isArray(rem) || rem.length === 0) {
        await conn.query(
          `UPDATE fastags
             SET status = ?, sold_by_user_id = NULL, assigned_to_agent_id = NULL, assigned_to = NULL
           WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)`,
          [to_status || 'in_stock', tag_serial]
        );
      }

      await conn.commit();
      return NextResponse.json({ success: true });
    } catch (e: any) {
      try { await conn.rollback(); } catch {}
      return NextResponse.json({ error: e.message }, { status: 500 });
    } finally {
      try { (conn as any).release ? conn.release() : (pool as any).releaseConnection?.(conn); } catch {}
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

