import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id: supplierId } = params; // (you don't need "await" here)

  try {
    // Overall Summary
    const [summary] = await pool.query(`
      SELECT
        COUNT(*) AS total_fastags,
        SUM(status = 'in_stock') AS available_with_admin,
        SUM(status = 'assigned') AS assigned_to_agent,
        SUM(status = 'sold') AS sold_total
      FROM fastags
      WHERE supplier_id = ?
    `, [supplierId]);

    // Grouped by bank and class including status splits
    const [grouped] = await pool.query(`
      SELECT
        COALESCE(bank_name,'') AS bank_name,
        COALESCE(fastag_class,'') AS fastag_class,
        COUNT(*) AS total_count,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) AS assigned_count,
        SUM(CASE WHEN status = 'in_stock' THEN 1 ELSE 0 END) AS in_stock_count,
        SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold_count
      FROM fastags
      WHERE supplier_id = ?
      GROUP BY COALESCE(bank_name,''), COALESCE(fastag_class,'')
      ORDER BY bank_name, fastag_class
    `, [supplierId]);

    return new Response(
      JSON.stringify({
        summary: summary[0],
        grouped, // this is your per-bank/class count!
      }),
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
