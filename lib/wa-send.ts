// Shared WhatsApp send utility — used by webhook handler and cron jobs

export const ALERT_NUMBERS = ["8667460635", "8667460935"]

export async function evoSend(
  to: string,
  text: string,
  opts: { force?: boolean } = {}
): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const autoReply = String(process.env.WA_AUTOREPLY || "").toLowerCase() === "true"
    if (!opts.force && !autoReply) return { ok: false, status: 0, body: "autoreply_off" }

    const base   = process.env.EVO_API_URL
    const inst   = process.env.EVO_INSTANCE
    const apikey = process.env.EVO_API_KEY
    if (!base || !inst || !apikey) return { ok: false, status: 0, body: "missing_config" }

    const res  = await fetch(`${base}/message/sendText/${inst}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", apikey },
      body:    JSON.stringify({ number: to, text }),
    })
    const body = await res.text().catch(() => "")
    return { ok: res.ok, status: res.status, body: body.slice(0, 300) }
  } catch (e: any) {
    return { ok: false, status: 0, body: e?.message || "exception" }
  }
}

// Always sends regardless of WA_AUTOREPLY — for system alerts
export async function alertAdmins(message: string): Promise<void> {
  await Promise.allSettled(
    ALERT_NUMBERS.map(n => evoSend("91" + n, message, { force: true }))
  )
}

// Send to a 10-digit number (prepends country code 91)
export async function sendTo(to10: string, text: string, force = false) {
  return evoSend("91" + to10, text, { force })
}