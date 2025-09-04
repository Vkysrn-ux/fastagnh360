// app/api/fastags/add-item/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const {
    tag_serial,
    supplier_id,
    purchase_date,
    purchase_price,
    remarks,
    bank_name,
    fastag_type,
    fastag_class,
    batch_number
  } = await req.json();

  if (!tag_serial || !bank_name || !fastag_class || !batch_number || !purchase_price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    await pool.query(
  `INSERT INTO fastags
   (tag_serial, supplier_id, purchase_date, purchase_price, remarks, bank_name, fastag_class, batch_number, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_stock')`,
  [
    tag_serial,
    supplier_id || null,
    purchase_date,
    purchase_price,
    remarks || null,
    bank_name,
    fastag_class,
    batch_number
  ]
);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Insert failed:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
