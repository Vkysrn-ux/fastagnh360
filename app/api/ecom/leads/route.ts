import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecom_leads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NULL,
      phone VARCHAR(64) NULL,
      email VARCHAR(255) NULL,
      message TEXT NULL,
      source VARCHAR(128) NULL,
      utm_source VARCHAR(128) NULL,
      utm_medium VARCHAR(128) NULL,
      utm_campaign VARCHAR(128) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function isAuthorized(req: NextRequest) {
  const configured = process.env.ECOM_WEBHOOK_SECRET;
  if (!configured) return true; // no secret set, allow
  const header = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
  return !!header && header === configured;
}

export async function GET() {
  try {
    await ensureTable();
    const [rows] = await pool.query<any[]>(
      `SELECT * FROM ecom_leads ORDER BY created_at DESC LIMIT 500`
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
    await ensureTable();
    const body = await req.json();
    const {
      name = null,
      phone = null,
      email = null,
      message = null,
      source = null,
      utm_source = null,
      utm_medium = null,
      utm_campaign = null,
      created_at = null,
    } = body || {};

    const [res]: any = await pool.query(
      `INSERT INTO ecom_leads (name, phone, email, message, source, utm_source, utm_medium, utm_campaign, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        name,
        phone,
        email,
        message,
        source,
        utm_source,
        utm_medium,
        utm_campaign,
        created_at ? new Date(created_at) : new Date(),
      ]
    );
    const id = res.insertId;
    const [rows]: any = await pool.query(`SELECT * FROM ecom_leads WHERE id = ?`, [id]);
    return NextResponse.json(rows?.[0] || null, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

