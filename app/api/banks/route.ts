import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const [rows] = await pool.query("SELECT name FROM banks ORDER BY name");
    const bankNames = (rows as any[]).map((row) => row.name);
    return NextResponse.json(bankNames);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
