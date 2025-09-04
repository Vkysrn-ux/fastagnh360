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

    // Grouped by bank and class
    const [grouped] = await pool.query(`
      SELECT
        bank_name,
        fastag_class,
        COUNT(*) AS total_count
      FROM fastags
      WHERE supplier_id = ?
      GROUP BY bank_name, fastag_class
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
