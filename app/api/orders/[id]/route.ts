import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dispatch_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_number VARCHAR(64) NOT NULL,
      requester_type VARCHAR(32) NOT NULL,
      requester_name VARCHAR(255) NOT NULL,
      packed_state VARCHAR(64) NOT NULL,
      dispatch_via VARCHAR(64) NOT NULL,
      tracking_id VARCHAR(128) NULL,
      status VARCHAR(32) NOT NULL,
      packed_by VARCHAR(255) NULL,
      created_by VARCHAR(255) NULL,
      requested_at DATETIME NOT NULL,
      eta DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dispatch_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      bank VARCHAR(128) NOT NULL,
      class_type VARCHAR(32) NOT NULL,
      qty INT NOT NULL,
      CONSTRAINT fk_dispatch_order_items_order
        FOREIGN KEY (order_id) REFERENCES dispatch_orders(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTables();
    const id = Number(params.id);
    const body = await req.json();
    const o = body || {};
    await pool.query(
      `UPDATE dispatch_orders SET request_number=?, requester_type=?, requester_name=?, packed_state=?, dispatch_via=?, tracking_id=?, status=?, packed_by=?, created_by=?, requested_at=?, eta=? WHERE id=?`,
      [
        o.requestNumber,
        o.requesterType,
        o.requesterName,
        o.packedState,
        o.dispatchVia,
        o.trackingId || null,
        o.status,
        o.packedBy || null,
        o.createdBy || null,
        o.requestedAt ? new Date(o.requestedAt) : new Date(),
        o.eta ? new Date(o.eta) : null,
        id,
      ],
    );
    await pool.query(`DELETE FROM dispatch_order_items WHERE order_id = ?`, [id]);
    const items: any[] = Array.isArray(o.items) ? o.items : [];
    for (const it of items) {
      await pool.query(`INSERT INTO dispatch_order_items (order_id, bank, class_type, qty) VALUES (?,?,?,?)`, [id, it.bank, it.classType, Number(it.qty || 0)]);
    }
    const [updatedRows]: any = await pool.query(`SELECT * FROM dispatch_orders WHERE id = ?`, [id]);
    const updated = Array.isArray(updatedRows) && updatedRows[0] ? updatedRows[0] : null;
    return NextResponse.json({ ...updated, items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

