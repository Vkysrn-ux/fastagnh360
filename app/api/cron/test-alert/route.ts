import { NextRequest, NextResponse } from "next/server"
import { alertAdmins } from "@/lib/wa-send"

export async function GET(req: NextRequest) {
  const token    = req.nextUrl.searchParams.get("token")
  const validKey = process.env.CRON_SECRET || process.env.API_KEY
  if (!token || !validKey || token !== validKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await alertAdmins(
    `🧪 *Admin Alert Test*\nIf you received this, failure notifications are working correctly.`
  )

  return NextResponse.json({ ok: true, note: "alert sent to admin numbers" })
}
