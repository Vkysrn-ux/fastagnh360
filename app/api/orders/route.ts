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

  // Ensure unique request_number to prevent duplicates
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
      // If index creation fails due to duplicate entries, auto-dedupe and retry once
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
        // Retry adding index
        try { await pool.query(`ALTER TABLE dispatch_orders ADD UNIQUE KEY uniq_request_number (request_number)`); } catch {}
      }
    }
  }
  await addUniqueIndexWithDedup();
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const status = (searchParams.get("status") || "").trim();
    const from = (searchParams.get("from") || "").trim(); // YYYY-MM-DD
    const to = (searchParams.get("to") || "").trim();

    const where: string[] = [];
    const vals: any[] = [];
    if (q) { where.push("(LOWER(requester_type) LIKE ? OR LOWER(requester_name) LIKE ?)"); vals.push(`%${q}%`, `%${q}%`); }
    if (status) { where.push("status = ?"); vals.push(status); }
    if (from) { where.push("requested_at >= ?"); vals.push(`${from} 00:00:00`); }
    if (to) { where.push("requested_at <= ?"); vals.push(`${to} 23:59:59`); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [orders] = await pool.query<any[]>(`SELECT * FROM dispatch_orders ${whereSql} ORDER BY requested_at DESC`, vals);
    const ids = (orders as any[]).map((o) => o.id);
    let items: any[] = [];
    if (ids.length) {
      const [rows] = await pool.query<any[]>(`SELECT * FROM dispatch_order_items WHERE order_id IN (${ids.map(()=>"?").join(",")}) ORDER BY id ASC`, ids);
      items = Array.isArray(rows) ? rows : [];
    }
    // Map DB snake_case columns to API camelCase expected by UI
    const withItems = (orders as any[]).map((o) => {
      const mapped = {
        id: o.id,
        requestNumber: o.request_number,
        requesterType: o.requester_type,
        requesterName: o.requester_name,
        packedState: o.packed_state,
        dispatchVia: o.dispatch_via,
        trackingId: o.tracking_id,
        status: o.status,
        packedBy: o.packed_by,
        createdBy: o.created_by,
        requestedAt: o.requested_at ? new Date(o.requested_at).toISOString() : null,
        eta: o.eta ? new Date(o.eta).toISOString() : null,
      } as any;
      mapped.items = items
        .filter((it) => it.order_id === o.id)
        .map((it) => ({ bank: it.bank, classType: it.class_type, qty: it.qty }));
      return mapped;
    });
    return NextResponse.json(withItems);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const o = body || {};
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Try fast path: insert; rely on unique index to avoid duplicates
      let orderId: number | null = null;
      let isDuplicate = false;
      try {
        const [res]: any = await conn.query(
          `INSERT INTO dispatch_orders (request_number, requester_type, requester_name, packed_state, dispatch_via, tracking_id, status, packed_by, created_by, requested_at, eta)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
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
          ],
        );
        orderId = Number((res as any).insertId);
      } catch (e: any) {
        // If duplicate request_number, fetch existing order and treat as idempotent
        if (e?.code === 'ER_DUP_ENTRY') {
          isDuplicate = true;
          const [rows]: any = await conn.query(`SELECT id FROM dispatch_orders WHERE request_number = ? LIMIT 1`, [o.requestNumber]);
          const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
          if (row) {
            orderId = Number(row.id);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }

      // Only insert items if we actually just created a fresh order (not duplicate path)
      if (orderId && !isDuplicate) {
        const items: any[] = Array.isArray(o.items) ? o.items : [];
        for (const it of items) {
          await conn.query(
            `INSERT INTO dispatch_order_items (order_id, bank, class_type, qty) VALUES (?,?,?,?)`,
            [orderId, it.bank, it.classType, Number(it.qty || 0)],
          );
        }
      }

      await conn.commit();

      const [createdRows]: any = await pool.query(`SELECT * FROM dispatch_orders WHERE id = ?`, [orderId]);
      const c = Array.isArray(createdRows) && createdRows[0] ? createdRows[0] : null;
      const [rowsItems]: any = await pool.query(`SELECT bank, class_type, qty FROM dispatch_order_items WHERE order_id = ? ORDER BY id ASC`, [orderId]);
      const items = Array.isArray(rowsItems) ? rowsItems.map((r: any) => ({ bank: r.bank, classType: r.class_type, qty: r.qty })) : [];
      const created = c
        ? {
            id: c.id,
            requestNumber: c.request_number,
            requesterType: c.requester_type,
            requesterName: c.requester_name,
            packedState: c.packed_state,
            dispatchVia: c.dispatch_via,
            trackingId: c.tracking_id,
            status: c.status,
            packedBy: c.packed_by,
            createdBy: c.created_by,
            requestedAt: c.requested_at ? new Date(c.requested_at).toISOString() : null,
            eta: c.eta ? new Date(c.eta).toISOString() : null,
            items,
          }
        : null;
      // 201 if a new row; 200 if duplicate (idempotent)
      const status = isDuplicate ? 200 : 201;
      return NextResponse.json(created, { status });
    } finally {
      try { await conn.release(); } catch {}
    }
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Duplicate request number' }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message || 'Internal Error' }, { status: 500 });
  }
}
