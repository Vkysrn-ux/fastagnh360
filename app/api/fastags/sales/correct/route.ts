import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const wrong_serial = String(body?.wrong_serial || '').trim();
    const correct_serial = String(body?.correct_serial || '').trim();
    let sold_by_user_id = body?.sold_by_user_id !== undefined && body?.sold_by_user_id !== null ? Number(body.sold_by_user_id) : null;
    if (!wrong_serial || !correct_serial) {
      return NextResponse.json({ error: 'wrong_serial and correct_serial are required' }, { status: 400 });
    }
    if (wrong_serial === correct_serial) {
      return NextResponse.json({ error: 'Serials are identical' }, { status: 400 });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Determine seller from latest sale of wrong_serial if not provided
      if (sold_by_user_id === null) {
        const [sellerRow]: any = await conn.query(
          `SELECT COALESCE(sold_by_user_id, sold_by_agent_id) AS seller
             FROM fastag_sales 
            WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)
            ORDER BY id DESC LIMIT 1`,
          [wrong_serial]
        );
        if (Array.isArray(sellerRow) && sellerRow.length) sold_by_user_id = Number(sellerRow[0].seller) || null;
      }

      // Validate correct_serial exists, mapping done, and is not sold already (no existing sale row + status not 'sold')
      const [tg]: any = await conn.query(`SELECT id, bank_name, fastag_class, supplier_id, status FROM fastags WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci) LIMIT 1`, [correct_serial]);
      if (!Array.isArray(tg) || tg.length === 0) {
        throw new Error('Correct barcode not found in inventory');
      }
      const currentStatus = String(tg[0].status || '').toLowerCase();
      if (currentStatus === 'sold') {
        throw new Error('Correct barcode is already sold');
      }
      try {
        const hasMapStatus = await (await import('@/lib/db-helpers')).hasTableColumn('fastags','bank_mapping_status', conn).catch(()=>false);
        const hasMapDone = await (await import('@/lib/db-helpers')).hasTableColumn('fastags','mapping_done', conn).catch(()=>false);
        if (hasMapStatus || hasMapDone) {
          const [fr]: any = await conn.query(
            `SELECT 
                ${hasMapStatus? 'bank_mapping_status' : "'' AS bank_mapping_status"},
                ${hasMapDone? 'mapping_done' : 'NULL AS mapping_done'}
             FROM fastags WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci) LIMIT 1`,
            [correct_serial]
          );
          const f = fr?.[0];
          const s = String(f?.bank_mapping_status || '').toLowerCase();
          const d = f?.mapping_done === 1 || f?.mapping_done === true;
          if (!(s === 'done' || d)) {
            throw new Error('Correct barcode mapping not done');
          }
        }
      } catch {}
      const [existsSale]: any = await conn.query(`SELECT 1 FROM fastag_sales WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci) LIMIT 1`, [correct_serial]);
      if (Array.isArray(existsSale) && existsSale.length) {
        throw new Error('Correct barcode already has a sale record');
      }

      // Revoke wrong_serial (delete latest sale row; if no sale row remains, revert to in_stock)
      const [latest]: any = await conn.query(`SELECT id FROM fastag_sales WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci) ORDER BY id DESC LIMIT 1`, [wrong_serial]);
      if (Array.isArray(latest) && latest.length) {
        await conn.query(`DELETE FROM fastag_sales WHERE id = ?`, [latest[0].id]);
      }
      const [rem]: any = await conn.query(`SELECT 1 FROM fastag_sales WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci) LIMIT 1`, [wrong_serial]);
      if (!Array.isArray(rem) || rem.length === 0) {
        await conn.query(`UPDATE fastags SET status='in_stock', sold_by_user_id=NULL, assigned_to_agent_id=NULL, assigned_to=NULL WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)`, [wrong_serial]);
      }

      // Mark correct_serial as sold and insert a sales snapshot row
      await conn.query(`UPDATE fastags SET status='sold', sold_by_user_id=? , assigned_to_agent_id=NULL, assigned_to=NULL WHERE (tag_serial COLLATE utf8mb4_general_ci) = (? COLLATE utf8mb4_general_ci)`, [sold_by_user_id, correct_serial]);
      const { bank_name, fastag_class, supplier_id } = tg[0];
      await conn.query(
        `INSERT INTO fastag_sales (
           tag_serial, ticket_id, vehicle_reg_no, bank_name, fastag_class, supplier_id,
           sold_by_user_id, sold_by_agent_id, payment_to_collect, payment_to_send, net_value,
           commission_amount, created_at
         ) VALUES (?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NOW())`,
        [correct_serial, bank_name ?? null, fastag_class ?? null, supplier_id ?? null, sold_by_user_id]
      );

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
