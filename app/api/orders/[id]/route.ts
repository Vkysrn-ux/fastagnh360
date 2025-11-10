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
  // Ensure unique request_number index
  async function addUniqueIndexWithDedup() {
    try {
      const [rows]: any = await pool.query(
        `SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'dispatch_orders' AND index_name = 'uniq_request_number' LIMIT 1`
      );
      const exists = Array.isArray(rows) && rows.length > 0;
      if (!exists) {
        await pool.query(`ALTER TABLE dispatch_orders ADD UNIQUE KEY uniq_request_number (request_number)`);
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (e?.code === 'ER_DUP_ENTRY' || msg.includes('Duplicate entry')) {
        const [dups]: any = await pool.query(`
          SELECT request_number, MIN(id) keep_id
          FROM dispatch_orders
          GROUP BY request_number
          HAVING COUNT(*) > 1
        `);
        const list = Array.isArray(dups) ? dups : [];
        for (const d of list) {
          await pool.query(
            `DELETE o FROM dispatch_orders o WHERE o.request_number = ? AND o.id <> ?`,
            [d.request_number, d.keep_id]
          );
        }
        try { await pool.query(`ALTER TABLE dispatch_orders ADD UNIQUE KEY uniq_request_number (request_number)`); } catch {}
      }
    }
  }
  await addUniqueIndexWithDedup();
}

// In Next.js, dynamic route params may be a Promise in route handlers.
// Await params before accessing its properties to avoid runtime error.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureTables();
    const { id: idParam } = await ctx.params;
    const id = Number(idParam);
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
    const u = Array.isArray(updatedRows) && updatedRows[0] ? updatedRows[0] : null;
    const updated = u
      ? {
          id: u.id,
          requestNumber: u.request_number,
          requesterType: u.requester_type,
          requesterName: u.requester_name,
          packedState: u.packed_state,
          dispatchVia: u.dispatch_via,
          trackingId: u.tracking_id,
          status: u.status,
          packedBy: u.packed_by,
          createdBy: u.created_by,
          requestedAt: u.requested_at ? new Date(u.requested_at).toISOString() : null,
          eta: u.eta ? new Date(u.eta).toISOString() : null,
          items,
        }
      : null;
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
