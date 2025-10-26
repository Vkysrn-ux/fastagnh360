import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT NOW() AS time');
    return NextResponse.json({ success: true, time: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message });
  }
}
