import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// One-off helper: backfill fastag_sales from existing tickets and sold fastags
// POST only. Returns counts of inserted rows.
export async function POST(_req: NextRequest) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
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

    // Backfill from tickets
    const [fromTickets]: any = await conn.query(
      `INSERT INTO fastag_sales (
         tag_serial, ticket_id, vehicle_reg_no, bank_name, fastag_class, supplier_id,
         sold_by_user_id, sold_by_agent_id, payment_to_collect, payment_to_send, net_value,
         commission_amount, created_at
       )
       SELECT DISTINCT t.fastag_serial, t.id AS ticket_id, t.vehicle_reg_no,
              f.bank_name, f.fastag_class, f.supplier_id,
              t.assigned_to AS sold_by_user_id, f.assigned_to_agent_id AS sold_by_agent_id,
              t.payment_to_collect, t.payment_to_send, t.net_value,
              t.commission_amount, COALESCE(t.updated_at, t.created_at, NOW())
       FROM tickets_nh t
       LEFT JOIN fastags f ON f.tag_serial = t.fastag_serial
       WHERE t.fastag_serial IS NOT NULL AND t.fastag_serial <> ''
         AND NOT EXISTS (
           SELECT 1 FROM fastag_sales s WHERE s.tag_serial = t.fastag_serial AND s.ticket_id = t.id
         )`);

    // Backfill remaining sold fastags without tickets (no attribution)
    const [fromFastags]: any = await conn.query(
      `INSERT INTO fastag_sales (
         tag_serial, ticket_id, vehicle_reg_no, bank_name, fastag_class, supplier_id,
         sold_by_user_id, sold_by_agent_id, payment_to_collect, payment_to_send, net_value,
         commission_amount, created_at
       )
       SELECT f.tag_serial, NULL, NULL, f.bank_name, f.fastag_class, f.supplier_id,
              f.sold_by_user_id, f.assigned_to_agent_id, NULL, NULL, NULL, NULL, NOW()
       FROM fastags f
       WHERE f.status = 'sold'
         AND NOT EXISTS (
           SELECT 1 FROM fastag_sales s WHERE s.tag_serial = f.tag_serial
         )`);

    await conn.commit();
    return NextResponse.json({ inserted_from_tickets: fromTickets?.affectedRows || 0, inserted_from_fastags: fromFastags?.affectedRows || 0 });
  } catch (e: any) {
    try { await conn.rollback(); } catch {}
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    pool.releaseConnection(conn);
  }
}
