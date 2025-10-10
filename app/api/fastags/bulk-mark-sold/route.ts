import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const serials: string[] = Array.isArray(body?.tag_serials)
      ? body.tag_serials.map((s: any) => String(s).trim()).filter(Boolean)
      : String(body?.tag_serials || "")
          .split(/\r?\n|,|\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
    const soldByUserId = body?.sold_by_user_id !== undefined && body?.sold_by_user_id !== null
      ? Number(body.sold_by_user_id)
      : null;

    if (!serials.length) {
      return NextResponse.json({ error: "Provide tag_serials (array or newline/comma separated)" }, { status: 400 });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Ensure snapshot table exists (idempotent)
      try {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS fastag_sales (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tag_serial VARCHAR(255) NOT NULL,
            ticket_id INT NULL,
            vehicle_reg_no VARCHAR(64) NULL,
            bank_name VARCHAR(255) NULL,
            fastag_class VARCHAR(32) NULL,
            supplier_id INT NULL,
            sold_by_user_id INT NULL,
            sold_by_agent_id INT NULL,
            payment_to_collect DECIMAL(10,2) NULL,
            payment_to_send DECIMAL(10,2) NULL,
            net_value DECIMAL(10,2) NULL,
            commission_amount DECIMAL(10,2) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
      } catch {}
      const placeholders = serials.map(() => '?').join(',');
      // Determine which assignment columns exist to build a safe SELECT
      const hasAssignedTo = await hasTableColumn('fastags', 'assigned_to', conn).catch(() => false);
      const hasAssignedToAgent = await hasTableColumn('fastags', 'assigned_to_agent_id', conn).catch(() => false);
      const selectAssignedTo = hasAssignedTo ? 'assigned_to' : 'NULL AS assigned_to';
      const selectAssignedToAgent = hasAssignedToAgent ? 'assigned_to_agent_id' : 'NULL AS assigned_to_agent_id';
      // Fetch snapshot BEFORE clearing assignment
      const [snapRows]: any = await conn.query(
        `SELECT tag_serial, bank_name, fastag_class, supplier_id, ${selectAssignedToAgent}, ${selectAssignedTo},
                ${await hasTableColumn('fastags','bank_mapping_status', conn).then(v=>v?"bank_mapping_status":"" ) || "NULL AS bank_mapping_status"},
                ${await hasTableColumn('fastags','mapping_done', conn).then(v=>v?"mapping_done":"" ) || "NULL AS mapping_done"}
           FROM fastags 
          WHERE tag_serial IN (${placeholders})
            AND NOT EXISTS (
              SELECT 1 FROM tickets_nh t 
               WHERE (t.fastag_serial COLLATE utf8mb4_general_ci) = (fastags.tag_serial COLLATE utf8mb4_general_ci)
            )`,
        serials
      );

      // Enforce mapping done when column(s) exist
      try {
        const hasMapStatus = await hasTableColumn('fastags','bank_mapping_status', conn).catch(()=>false);
        const hasMapDone = await hasTableColumn('fastags','mapping_done', conn).catch(()=>false);
        if (hasMapStatus || hasMapDone) {
          const notMapped = (snapRows || []).filter((r: any) => {
            const s = String(r?.bank_mapping_status || '').toLowerCase();
            const d = r?.mapping_done === 1 || r?.mapping_done === true;
            return !(s === 'done' || d);
          }).map((r: any) => r.tag_serial);
          if (notMapped.length) {
            await conn.rollback();
            return NextResponse.json({ error: 'Mapping not done for some barcodes', not_mapped_serials: notMapped }, { status: 400 });
          }
        }
      } catch {}

      // Build UPDATE dynamically based on existing columns
      const canAssignedTo = await hasTableColumn('fastags', 'assigned_to', conn);
      const canAssignedToAgent = await hasTableColumn('fastags', 'assigned_to_agent_id', conn);
      const canSetSoldBy = await hasTableColumn('fastags', 'sold_by_user_id', conn);
      const canSetSoldAt = await hasTableColumn('fastags', 'sold_at', conn);
      const canSetSoldDate = await hasTableColumn('fastags', 'sold_date', conn);
      const sets: string[] = ["status = 'sold'"];
      const updateVals: any[] = [];
      if (canAssignedTo) sets.push('assigned_to = NULL');
      if (canAssignedToAgent) sets.push('assigned_to_agent_id = NULL');
      if (canSetSoldBy) { sets.push('sold_by_user_id = ?'); updateVals.push(soldByUserId); }
      if (canSetSoldAt) sets.push('sold_at = NOW()');
      if (canSetSoldDate) sets.push('sold_date = CURDATE()');
      const updateSql = `UPDATE fastags SET ${sets.join(', ')} WHERE tag_serial IN (${placeholders})
        AND NOT EXISTS (
          SELECT 1 FROM tickets_nh t 
           WHERE (t.fastag_serial COLLATE utf8mb4_general_ci) = (fastags.tag_serial COLLATE utf8mb4_general_ci)
        )`;
      const [result]: any = await conn.query(updateSql, [...updateVals, ...serials]);

      // Best-effort: insert into fastag_sales (retry with ticket_id=0 if NULL not allowed)
      for (const r of snapRows || []) {
        const sellerId = soldByUserId ?? (r.assigned_to !== undefined && r.assigned_to !== null ? Number(r.assigned_to) : null);
        const baseParams = [
          r.tag_serial,
          null, // ticket_id (may fail if NOT NULL)
          null, // vehicle_reg_no
          r.bank_name ?? null,
          r.fastag_class ?? null,
          r.supplier_id ?? null,
          sellerId,
          r.assigned_to_agent_id ?? null,
          null,
          null,
          null,
          null,
        ] as any[];
        try {
          await conn.query(
            `INSERT INTO fastag_sales (
               tag_serial, ticket_id, vehicle_reg_no, bank_name, fastag_class, supplier_id,
               sold_by_user_id, sold_by_agent_id, payment_to_collect, payment_to_send, net_value,
               commission_amount, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            baseParams
          );
        } catch (e: any) {
          if (String(e?.code) === 'ER_NO_DEFAULT_FOR_FIELD') {
            const retryParams = [...baseParams];
            retryParams[1] = 0; // ticket_id = 0
            try {
              await conn.query(
                `INSERT INTO fastag_sales (
                   tag_serial, ticket_id, vehicle_reg_no, bank_name, fastag_class, supplier_id,
                   sold_by_user_id, sold_by_agent_id, payment_to_collect, payment_to_send, net_value,
                   commission_amount, created_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                retryParams
              );
            } catch {}
          }
        }
      }
      await conn.commit();
      return NextResponse.json({ success: true, updated: result?.affectedRows || 0 });
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
