import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { sendTo, alertAdmins } from "@/lib/wa-send"

const REPORT_NUMBERS = [
  "8754030134",
  "8667460935",
  "8667460635",
  "9585533692",
  "9655420360",
]

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

// Send one message to all report numbers, return any failures
async function broadcast(text: string): Promise<string[]> {
  const results = await Promise.allSettled(
    REPORT_NUMBERS.map(n => sendTo(n, text, true))
  )
  const failed: string[] = []
  results.forEach((r, i) => {
    if (r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)) {
      const reason = r.status === "rejected"
        ? r.reason
        : `HTTP ${r.value.status}: ${r.value.body}`
      failed.push(`${REPORT_NUMBERS[i]} — ${reason}`)
    }
  })
  return failed
}

export async function GET(req: NextRequest) {
  const token    = req.nextUrl.searchParams.get("token")
  const validKey = process.env.CRON_SECRET || process.env.API_KEY
  if (!token || !validKey || token !== validKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = formatDate(new Date())

  let rows: any[]
  try {
    const [result]: any = await pool.query(`
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
    rows = result
  } catch (e: any) {
    await alertAdmins(`🚨 *Daily Report Failed — DB Error*\n${e?.message || String(e)}`)
    return NextResponse.json({ error: "db_error" }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    const msg   = `✅ *Daily Open Tickets — ${today}*\n\nNo open tickets. All clear! 🎉`
    const fails = await broadcast(msg)
    if (fails.length) {
      await alertAdmins(`⚠️ *Daily Report — Delivery Failed*\nDate: ${today}\nFailed numbers:\n${fails.join("\n")}`)
    }
    return NextResponse.json({ ok: true, count: 0, failed: fails })
  }

  const lines: string[] = rows.map((r: any, i: number) => {
    const date  = formatShortDate(new Date(r.created_at))
    const phone = r.phone || "-"
    return `${i + 1}. *${r.ticket_no}* | ${r.vehicle_reg_no} | ${date} | ${r.agent_name} | ${r.subject} | ${phone}`
  })

  // Split into batches — keep under 3500 chars each
  const header     = `📋 *Open Tickets Report — ${today}*\nTotal: ${rows.length} open ticket${rows.length !== 1 ? "s" : ""}\n\n`
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

  const allFailed: string[] = []

  for (let i = 0; i < batches.length; i++) {
    const fails = await broadcast(batches[i])
    allFailed.push(...fails)
    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 1500))
  }

  // Deduplicate failed numbers and alert admins
  const uniqueFailed = [...new Set(allFailed)]
  if (uniqueFailed.length) {
    await alertAdmins(
      `⚠️ *Daily Report — Delivery Failed*\nDate: ${today}\nTickets: ${rows.length}\nFailed numbers:\n${uniqueFailed.join("\n")}`
    )
  }

  return NextResponse.json({
    ok: true,
    count: rows.length,
    batches: batches.length,
    failed: uniqueFailed,
  })
}
