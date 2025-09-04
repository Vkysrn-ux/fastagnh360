// app/api/suppliers/all/route.ts
import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
      const [rows] = await pool.query(`
  SELECT 
    s.id, s.name, s.email, s.phone, s.status,
    (SELECT COUNT(*) FROM fastags f WHERE f.supplier_id = s.id) AS total_fastag_count,
    (SELECT COUNT(*) FROM fastags f WHERE f.supplier_id = s.id AND f.purchase_type = 'paid') AS paid_fastag_count,
    (SELECT COUNT(*) FROM fastags f WHERE f.supplier_id = s.id AND (f.purchase_type IS NULL OR f.purchase_type != 'paid')) AS unpaid_fastag_count
  FROM suppliers s
  ORDER BY s.created_at DESC
`);
return NextResponse.json(rows);

    return NextResponse.json(rows);
  } catch (error: any) {
    console.log("Loaded supplier data error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
