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

      // Helper to format date as YYYYMMDD
      function yyyymmdd(d: Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${day}`;
      }

      // Generate next request number in format ORDYYYYMMDD-XX
      async function generateNextRequestNumber(): Promise<string> {
        const today = new Date();
        const base = `ORD${yyyymmdd(today)}-`;
        // Find the current max numeric suffix for today
        const [rows]: any = await conn.query(
          `SELECT MAX(CAST(SUBSTRING_INDEX(request_number, '-', -1) AS UNSIGNED)) AS max_seq
             FROM dispatch_orders
            WHERE request_number LIKE ?`,
          [`${base}%`]
        );
        const maxSeq = Array.isArray(rows) && rows[0] && rows[0].max_seq != null ? Number(rows[0].max_seq) : 0;
        const next = isNaN(maxSeq) ? 1 : maxSeq + 1;
        return `${base}${String(next).padStart(2, '0')}`;
      }

      // Decide request number: prefer server-generated format
      let requestNumber: string | null = null;
      const provided = typeof o.requestNumber === 'string' ? o.requestNumber.trim() : '';
      if (provided && /^ORD\d{8}-\d{2,}$/.test(provided)) {
        requestNumber = provided;
      } else {
        requestNumber = await generateNextRequestNumber();
      }

      // Insert with retry on duplicate request_number to avoid race conditions
      let orderId: number | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const [res]: any = await conn.query(
            `INSERT INTO dispatch_orders (request_number, requester_type, requester_name, packed_state, dispatch_via, tracking_id, status, packed_by, created_by, requested_at, eta)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [
              requestNumber,
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
          break;
        } catch (e: any) {
          if (e?.code === 'ER_DUP_ENTRY') {
            // Recompute next number and retry
            requestNumber = await generateNextRequestNumber();
            continue;
          }
          throw e;
        }
      }

      if (!orderId) {
        throw new Error('Failed to create order after retries');
      }

      // Insert items for the created order
      const inputItems: any[] = Array.isArray(o.items) ? o.items : [];
      for (const it of inputItems) {
        await conn.query(
          `INSERT INTO dispatch_order_items (order_id, bank, class_type, qty) VALUES (?,?,?,?)`,
          [orderId, it.bank, it.classType, Number(it.qty || 0)],
        );
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
      // Always 201 for a newly created row
      return NextResponse.json(created, { status: 201 });
    } finally {
      try { await conn.release(); } catch {}
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Error' }, { status: 500 });
  }
}
