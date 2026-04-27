import { NextRequest, NextResponse } from "next/server"
import { debugLog } from "../_log"

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || ""
  let body: any
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData()
    body = Object.fromEntries(form.entries())
  } else {
    body = await req.json().catch(() => ({}))
  }
  debugLog.unshift({ ts: new Date().toISOString(), body })
  if (debugLog.length > 20) debugLog.pop()
  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json(debugLog)
}
