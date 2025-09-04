import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const {
    bank_name,
    fastag_class,
    purchase_price,
    batch_number,
    assigned_to,
    status
  } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Missing FASTag ID" }, { status: 400 });
  }

  try {
    const [result] = await pool.query(
      `UPDATE fastags SET
        bank_name = ?,
        fastag_class = ?,
        purchase_price = ?,
        batch_number = ?,
        assigned_to = ?,
        status = ?,
        assigned_at = IFNULL(assigned_at, NOW())
       WHERE id = ?`,
      [
        bank_name || null,
        fastag_class || null,
        purchase_price || 0,
        batch_number || null,
        assigned_to || null,
        status || "in_stock",
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
