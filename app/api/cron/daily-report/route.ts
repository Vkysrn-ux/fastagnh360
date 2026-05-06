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

  let count = 0
  try {
    const [result]: any = await pool.query(
      `SELECT COUNT(*) AS cnt FROM tickets_nh WHERE status = 'open'`
    )
    count = Number(result?.[0]?.cnt ?? 0)
  } catch (e: any) {
    await alertAdmins(`🚨 *Daily Report Failed — DB Error*\n${e?.message || String(e)}`)
    return NextResponse.json({ error: "db_error" }, { status: 500 })
  }

  const msg = count === 0
    ? `✅ *NH360 Daily Report — ${today}*\n\nOpen Tickets: *0*\nAll clear! 🎉`
    : `📋 *NH360 Daily Report — ${today}*\n\nOpen Tickets: *${count}*`

  const fails = await broadcast(msg)
  if (fails.length) {
    await alertAdmins(`⚠️ *Daily Report — Delivery Failed*\nDate: ${today}\nFailed numbers:\n${fails.join("\n")}`)
  }

  return NextResponse.json({ ok: true, count, failed: fails })
}
