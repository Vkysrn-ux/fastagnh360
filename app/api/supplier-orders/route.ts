import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_name VARCHAR(255) NOT NULL,
      class_type VARCHAR(32) NOT NULL,
      qty_ordered INT NOT NULL,
      date_ordered DATETIME NOT NULL,
      date_received DATETIME NULL,
      qty_delivered INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const [rows] = await pool.query(`SELECT * FROM supplier_orders ORDER BY date_ordered DESC`);
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const o = body || {};
    const [res]: any = await pool.query(
      `INSERT INTO supplier_orders (supplier_name, class_type, qty_ordered, date_ordered, date_received, qty_delivered)
       VALUES (?,?,?,?,?,?)`,
      [
        o.supplierName,
        o.classType,
        Number(o.qtyOrdered || 0),
        o.dateOrdered ? new Date(o.dateOrdered) : new Date(),
        o.dateReceived ? new Date(o.dateReceived) : null,
        o.qtyDelivered ?? null,
      ],
    );
    const id = res.insertId;
    const [rows]: any = await pool.query(`SELECT * FROM supplier_orders WHERE id = ?`, [id]);
    return NextResponse.json(rows[0] || null, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

