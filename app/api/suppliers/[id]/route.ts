// app/api/suppliers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  const supplierId = context.params.id; // ✅ No await here!

  const { name, email, phone, status, payment_status } = await req.json();

  if (!name || !email || !phone || !status || !payment_status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const [result] = await pool.query(
      `UPDATE suppliers SET name = ?, email = ?, phone = ?, status = ?, payment_status = ? WHERE id = ?`,
      [name, email, phone, status, payment_status, supplierId]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DB Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
