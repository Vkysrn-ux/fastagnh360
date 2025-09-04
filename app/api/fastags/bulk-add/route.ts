import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db"; // Adjust the import as per your DB connection utility

export async function POST(req: NextRequest) {
  try {
    const {
      supplier_id,
      fastag_class,
      bank_name,
      batch_number,
      purchase_price,
      payment_type,
      purchase_date,
      serials,
    } = await req.json();

    if (
      !supplier_id ||
      !fastag_class ||
      !bank_name ||
      !batch_number ||
      !purchase_price ||
      !payment_type ||
      !purchase_date ||
      !serials ||
      !Array.isArray(serials) ||
      serials.length === 0
    ) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // Optional: Check for duplicate serials in the DB here if you want

    const insertPromises = serials.map((serial: string) =>
      pool.query(
        `INSERT INTO fastags
          (supplier_id, fastag_class, bank_name, batch_number, purchase_price, purchase_type, purchase_date, tag_serial, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_stock')`,
        [supplier_id, fastag_class, bank_name, batch_number, purchase_price, payment_type, purchase_date, serial]
      )
    );

    await Promise.all(insertPromises);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("FASTag bulk-add error:", error);
    return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 });
  }
}
