import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id, s.name, s.email, s.phone, s.status,
        COUNT(f.id) AS fastag_count,
        SUM(CASE WHEN (f.purchase_type = 'paid' OR f.payment_type = 'paid') THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN (f.purchase_type = 'credit' OR f.payment_type = 'credit') THEN 1 ELSE 0 END) AS credit_count
      FROM suppliers s
      LEFT JOIN fastags f ON f.supplier_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    // Compute payment_status for display: "paid", "credit", "mixed", "N/A"
    const suppliers = rows.map((s: any) => {
      let payment_status = "N/A";
      if (s.fastag_count > 0) {
        if (s.paid_count > 0 && s.credit_count > 0) payment_status = "mixed";
        else if (s.paid_count > 0) payment_status = "paid";
        else if (s.credit_count > 0) payment_status = "credit";
      }
      return {
        ...s,
        payment_status,
      };
    });

    return NextResponse.json(suppliers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
