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
      // Fetch snapshot BEFORE clearing assignment
      const [snapRows]: any = await conn.query(
        `SELECT tag_serial, bank_name, fastag_class, supplier_id, assigned_to_agent_id, assigned_to
         FROM fastags WHERE tag_serial IN (${placeholders})`,
        serials
      );

      // Build UPDATE with optional sold_by_user_id if column exists
      let updateSql = `UPDATE fastags SET status = 'sold', assigned_to = NULL, assigned_to_agent_id = NULL`;
      const canSetSoldBy = await hasTableColumn('fastags', 'sold_by_user_id', conn);
      const updateVals: any[] = [];
      if (canSetSoldBy) {
        updateSql += `, sold_by_user_id = ?`;
        updateVals.push(soldByUserId);
      }
      updateSql += ` WHERE tag_serial IN (${placeholders})`;
      const [result]: any = await conn.query(updateSql, [...updateVals, ...serials]);

      // Best-effort: insert into fastag_sales
      try {
        for (const r of snapRows || []) {
          const sellerId = soldByUserId ?? (r.assigned_to !== undefined && r.assigned_to !== null ? Number(r.assigned_to) : null);
          await conn.query(
            `INSERT INTO fastag_sales (
               tag_serial, ticket_id, vehicle_reg_no, bank_name, fastag_class, supplier_id,
               sold_by_user_id, sold_by_agent_id, payment_to_collect, payment_to_send, net_value,
               commission_amount, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              r.tag_serial,
              null,
              null,
              r.bank_name ?? null,
              r.fastag_class ?? null,
              r.supplier_id ?? null,
              sellerId,
              r.assigned_to_agent_id ?? null,
              null,
              null,
              null,
              null,
            ]
          );
        }
      } catch {}
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
