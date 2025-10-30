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
    const withItems = (orders as any[]).map((o) => ({
      ...o,
      items: items.filter((it) => it.order_id === o.id).map((it) => ({ bank: it.bank, classType: it.class_type, qty: it.qty }))
    }));
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
    const [res]: any = await pool.query(
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
    const orderId = res.insertId;
    const items: any[] = Array.isArray(o.items) ? o.items : [];
    for (const it of items) {
      await pool.query(
        `INSERT INTO dispatch_order_items (order_id, bank, class_type, qty) VALUES (?,?,?,?)`,
        [orderId, it.bank, it.classType, Number(it.qty || 0)],
      );
    }
    const [createdRows]: any = await pool.query(`SELECT * FROM dispatch_orders WHERE id = ?`, [orderId]);
    const created = Array.isArray(createdRows) && createdRows[0] ? createdRows[0] : null;
    return NextResponse.json({ ...created, items }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

