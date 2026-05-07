import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { alertAdmins } from "@/lib/wa-send"

// Business hours in IST: 9am–9pm = 3:30–15:30 UTC
function isBusinessHours(): boolean {
  const utcH = new Date().getUTCHours()
  return utcH >= 3 && utcH < 16
}

export async function GET(req: NextRequest) {
  const token    = req.nextUrl.searchParams.get("token")
  const validKey = process.env.CRON_SECRET || process.env.API_KEY
  if (!token || !validKey || token !== validKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check last processed message timestamp
  let minutesSinceLast: number | null = null
  try {
    const [rows]: any = await pool.query(
      `SELECT TIMESTAMPDIFF(MINUTE, MAX(created_at), NOW()) AS mins FROM wa_processed_msgs`
    )
    const mins = rows?.[0]?.mins
    minutesSinceLast = mins === null ? null : Number(mins)
  } catch (e: any) {
    await alertAdmins(`🚨 *Watchdog Error — DB query failed*\n${e?.message}`)
    return NextResponse.json({ error: "db_error" }, { status: 500 })
  }

  // If no messages ever processed, nothing to check
  if (minutesSinceLast === null) {
    return NextResponse.json({ ok: true, note: "no messages in db yet" })
  }

  // Alert if silent for >2 hours during business hours
  if (minutesSinceLast > 120 && isBusinessHours()) {
    const hrs = Math.floor(minutesSinceLast / 60)
    const mins = minutesSinceLast % 60
    await alertAdmins(
      `🚨 *Webhook Silence Alert*\n\nNo WhatsApp messages processed in *${hrs}h ${mins}m*.\n\nPossible causes:\n• Evolution API webhook marked dead (403 error)\n• WhatsApp disconnected\n• Webhook URL changed\n\nCheck: https://evo.talonmind.com`
    )
    return NextResponse.json({ ok: true, alert_sent: true, minutes_silent: minutesSinceLast })
  }

  return NextResponse.json({ ok: true, alert_sent: false, minutes_silent: minutesSinceLast })
}
