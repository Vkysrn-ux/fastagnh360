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

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureTable();
    const { id: idParam } = await ctx.params;
    const id = Number(idParam);
    const body = await req.json();
    const o = body || {};
    await pool.query(
      `UPDATE supplier_orders SET supplier_name=?, class_type=?, qty_ordered=?, date_ordered=?, date_received=?, qty_delivered=? WHERE id=?`,
      [
        o.supplierName,
        o.classType,
        Number(o.qtyOrdered || 0),
        o.dateOrdered ? new Date(o.dateOrdered) : new Date(),
        o.dateReceived ? new Date(o.dateReceived) : null,
        o.qtyDelivered ?? null,
        id,
      ],
    );
    const [rows]: any = await pool.query(`SELECT * FROM supplier_orders WHERE id = ?`, [id]);
    const r = rows && rows[0];
    const updated = r
      ? {
          id: r.id,
          supplierName: r.supplier_name,
          classType: r.class_type,
          qtyOrdered: r.qty_ordered,
          dateOrdered: r.date_ordered ? new Date(r.date_ordered).toISOString() : null,
          dateReceived: r.date_received ? new Date(r.date_received).toISOString() : null,
          qtyDelivered: r.qty_delivered,
        }
      : null;
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
