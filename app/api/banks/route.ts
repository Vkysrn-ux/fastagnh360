import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Simple in-process cache to avoid hammering DB for static list
let banksCache: { data: string[]; expires: number } | null = null;
const BANKS_TTL_MS = 60_000; // 1 minute

export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    if (banksCache && banksCache.expires > now) {
      return NextResponse.json(banksCache.data);
    }
    const [rows] = await pool.query("SELECT name FROM banks ORDER BY name");
    const bankNames = (rows as any[]).map((row) => row.name);
    banksCache = { data: bankNames, expires: now + BANKS_TTL_MS };
    return NextResponse.json(bankNames);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
