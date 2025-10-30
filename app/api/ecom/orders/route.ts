import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecom_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      external_order_id VARCHAR(128) NULL,
      customer_name VARCHAR(255) NULL,
      phone VARCHAR(64) NULL,
      email VARCHAR(255) NULL,
      items_summary TEXT NULL,
      amount DECIMAL(12,2) NULL,
      currency VARCHAR(8) NULL,
      payment_status VARCHAR(32) NULL,
      payment_provider VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function isAuthorized(req: NextRequest) {
  const configured = process.env.ECOM_WEBHOOK_SECRET;
  if (!configured) return true;
  const header = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
  return !!header && header === configured;
}

export async function GET() {
  try {
    await ensureTables();
    const [rows] = await pool.query<any[]>(
      `SELECT * FROM ecom_orders ORDER BY created_at DESC LIMIT 500`
    );
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureTables();
    const body = await req.json();
    const {
      external_order_id = null,
      customer_name = null,
      phone = null,
      email = null,
      items_summary = null,
      amount = null,
      currency = null,
      payment_status = null,
      payment_provider = null,
      created_at = null,
    } = body || {};

    const [res]: any = await pool.query(
      `INSERT INTO ecom_orders (external_order_id, customer_name, phone, email, items_summary, amount, currency, payment_status, payment_provider, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        external_order_id,
        customer_name,
        phone,
        email,
        items_summary,
        amount != null ? Number(amount) : null,
        currency,
        payment_status,
        payment_provider,
        created_at ? new Date(created_at) : new Date(),
      ]
    );
    const id = res.insertId;
    const [rows]: any = await pool.query(`SELECT * FROM ecom_orders WHERE id = ?`, [id]);
    return NextResponse.json(rows?.[0] || null, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

