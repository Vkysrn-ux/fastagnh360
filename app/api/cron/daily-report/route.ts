import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"

const REPORT_NUMBERS = [
  "8754030134",
  "8667460935",
  "8667460635",
  "9585533692",
  "9655420360",
]

async function sendWA(to10: string, text: string) {
  try {
    const base   = process.env.EVO_API_URL
    const inst   = process.env.EVO_INSTANCE
    const apikey = process.env.EVO_API_KEY
    if (!base || !inst || !apikey) return
    await fetch(`${base}/message/sendText/${inst}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ number: "91" + to10, text }),
    })
  } catch {}
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  })
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", timeZone: "Asia/Kolkata",
  })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [rows]: any = await pool.query(`
    SELECT
      t.ticket_no,
      t.vehicle_reg_no,
      t.created_at,
      t.subject,
      t.phone,
      COALESCE(ua.name, uc.name, 'Unknown') AS agent_name
    FROM tickets_nh t
    LEFT JOIN users ua ON ua.id = t.assigned_to
    LEFT JOIN users uc ON uc.id = t.created_by
    WHERE t.status = 'open'
    ORDER BY t.created_at ASC
  `)

  const today = formatDate(new Date())

  if (!rows || rows.length === 0) {
    const msg = `✅ *Daily Open Tickets — ${today}*\n\nNo open tickets. All clear! 🎉`
    await Promise.allSettled(REPORT_NUMBERS.map(n => sendWA(n, msg)))
    return NextResponse.json({ ok: true, count: 0 })
  }

  const lines: string[] = rows.map((r: any, i: number) => {
    const date  = formatShortDate(new Date(r.created_at))
    const phone = r.phone || "-"
    return `${i + 1}. *${r.ticket_no}* | ${r.vehicle_reg_no} | ${date} | ${r.agent_name} | ${r.subject} | ${phone}`
  })

  // Split into messages — keep under 3500 chars each
  const header    = `📋 *Open Tickets Report — ${today}*\nTotal: ${rows.length} open ticket${rows.length !== 1 ? "s" : ""}\n\n`
  const contHeader = `📋 *Open Tickets (continued) — ${today}*\n\n`

  const batches: string[] = []
  let current = header

  for (const line of lines) {
    const next = current + line + "\n"
    if (next.length > 3500) {
      batches.push(current.trimEnd())
      current = contHeader + line + "\n"
    } else {
      current = next
    }
  }
  if (current.trim()) batches.push(current.trimEnd())

  for (let i = 0; i < batches.length; i++) {
    await Promise.allSettled(REPORT_NUMBERS.map(n => sendWA(n, batches[i])))
    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 1500))
  }

  return NextResponse.json({ ok: true, count: rows.length, batches: batches.length })
}
