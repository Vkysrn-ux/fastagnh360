import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Minimal, robust supplier list for selectors
    const [rows] = await pool.query(`SELECT id, name FROM suppliers ORDER BY id DESC`);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
