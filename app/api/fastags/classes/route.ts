import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(_req: NextRequest) {
  try {
    const [rows]: any = await pool.query(
      "SELECT DISTINCT fastag_class AS class FROM fastags WHERE fastag_class IS NOT NULL AND fastag_class <> '' ORDER BY fastag_class ASC"
    );
    const out = Array.isArray(rows) ? rows.map((r: any) => r.class) : [];
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load classes' }, { status: 500 });
  }
}

