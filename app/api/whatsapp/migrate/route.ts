import { NextResponse } from "next/server"
import { pool } from "@/lib/db"

export async function GET() {
  const results: any[] = []
  const run = async (sql: string) => {
    try {
      await pool.query(sql)
      results.push({ sql, ok: true })
    } catch (e: any) {
      results.push({ sql, ok: false, error: e?.message, errno: e?.errno })
    }
  }
  await run(`ALTER TABLE tickets_nh ADD COLUMN wa_chat_id VARCHAR(128) NULL`)
  await run(`ALTER TABLE tickets_nh ADD COLUMN wa_sender VARCHAR(32) NULL`)
  await run(`ALTER TABLE tickets_nh ADD INDEX idx_tickets_wa_chat (wa_chat_id)`)
  return NextResponse.json(results)
}
