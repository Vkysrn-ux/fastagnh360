import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dispatch_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_number VARCHAR(64) NOT NULL,
      requester_type VARCHAR(32) NOT NULL,
      requester_name VARCHAR(255) NOT NULL,
      packed_state VARCHAR(64) NOT NULL,
      dispatch_via VARCHAR(64) NOT NULL,
      tracking_id VARCHAR(128) NULL,
      status VARCHAR(32) NOT NULL,
      packed_by VARCHAR(255) NULL,
      created_by VARCHAR(255) NULL,
      requested_at DATETIME NOT NULL,
      eta DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function yyyymmdd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function generateNextRequestNumber(): Promise<string> {
  const today = new Date();
  const base = `ORD${yyyymmdd(today)}-`;
  const [rows]: any = await pool.query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(request_number, '-', -1) AS UNSIGNED)) AS max_seq
       FROM dispatch_orders
      WHERE request_number LIKE ?`,
    [`${base}%`]
  );
  const maxSeq = Array.isArray(rows) && rows[0] && rows[0].max_seq != null ? Number(rows[0].max_seq) : 0;
  const next = isNaN(maxSeq) ? 1 : maxSeq + 1;
  return `${base}${String(next).padStart(2, '0')}`;
}

export async function GET(_req: NextRequest) {
  try {
    await ensureTables();
    const requestNumber = await generateNextRequestNumber();
    return NextResponse.json({ requestNumber });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Error' }, { status: 500 });
  }
}

