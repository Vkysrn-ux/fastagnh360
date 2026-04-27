// app/api/whatsapp/route.ts — Evolution API v2
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { parseIndianMobile } from "@/lib/validators"
import { v2 as cloudinary } from "cloudinary"
import { debugLog } from "./_log"

// Ignore messages received before this server started
const SERVER_START_SEC = Math.floor(Date.now() / 1000)

// ---------------------------------------------------------------------------
// Schema migration
// ---------------------------------------------------------------------------
let schemaMigrated = false
async function ensureWaColumns() {
  if (schemaMigrated) return
  await pool.query(`ALTER TABLE tickets_nh ADD COLUMN wa_chat_id VARCHAR(128) NULL`).catch((e: any) => { if (e?.errno !== 1060) console.error("wa_chat_id:", e?.message) })
  await pool.query(`ALTER TABLE tickets_nh ADD COLUMN wa_sender  VARCHAR(32)  NULL`).catch((e: any) => { if (e?.errno !== 1060) console.error("wa_sender:",  e?.message) })
  await pool.query(`ALTER TABLE tickets_nh ADD INDEX idx_tickets_wa_chat (wa_chat_id)`).catch(() => {})
  schemaMigrated = true
}

// ---------------------------------------------------------------------------
// Evolution API — send text message
// ---------------------------------------------------------------------------
async function evoSend(to: string, text: string) {
  try {
    if (String(process.env.WA_AUTOREPLY || "").toLowerCase() !== "true") return
    const base   = process.env.EVO_API_URL   // e.g. https://evo.talonmind.com
    const inst   = process.env.EVO_INSTANCE  // e.g. NH360
    const apikey = process.env.EVO_API_KEY
    if (!base || !inst || !apikey) return
    await fetch(`${base}/message/sendText/${inst}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ number: to, text }),
    }).catch(() => {})
  } catch {}
}

// ---------------------------------------------------------------------------
// Evolution API — download media → upload to Cloudinary
// ---------------------------------------------------------------------------
function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

async function downloadAndUploadMedia(messageObj: any): Promise<string | null> {
  try {
    configureCloudinary()
    const base   = process.env.EVO_API_URL
    const inst   = process.env.EVO_INSTANCE
    const apikey = process.env.EVO_API_KEY
    if (!base || !inst || !apikey) return null

    // Ask Evolution API to return base64 of the media
    const res = await fetch(`${base}/chat/getBase64FromMediaMessage/${inst}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ message: messageObj, convertToMp4: false }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const b64: string = json?.base64 || json?.data?.base64 || ""
    if (!b64) return null

    const mime = json?.mimetype || "image/jpeg"
    const isPdf = mime.includes("pdf")
    const dataUri = `data:${mime};base64,${b64}`

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "nh360-fastag/whatsapp",
      resource_type: isPdf ? "raw" : "image",
    })
    return result?.secure_url ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------
function normalizePhone(jid: string): string | null {
  // Evolution API JID: "919876543210@s.whatsapp.net" or "919876543210@g.us"
  const digits = jid.replace(/@[a-z.]+$/i, "").replace(/[^0-9]/g, "")
  const parsed = parseIndianMobile(digits)
  if (parsed.ok) return parsed.value
  const p2 = parseIndianMobile(digits.slice(-10))
  return p2.ok ? p2.value : null
}

function extractPhoneFromText(text: string): string | null {
  const m = text.replace(/[^0-9]/g, " ").match(/([6-9]\d{9})/)
  return m ? m[1] : null
}

const INDIAN_STATE_CODES = new Set([
  "AP","AR","AS","BR","CG","CH","DD","DL","DN","GA","GJ","HP","HR",
  "JH","JK","KA","KL","LA","LD","MH","ML","MN","MP","MZ","NL","OD",
  "PB","PY","RJ","SK","TN","TR","TS","UK","UP","WB","AN","HR","HP",
])

function extractVehicle(text: string): string | null {
  const s = (text || "").toUpperCase()
  const patterns = [
    /\b([A-Z]{2})\s*(\d{1,2})\s*([A-Z]{1,3})\s*(\d{3,4})\b/,
    /\b([A-Z]{2})\s*(\d{3,4})\s*([A-Z]{1,2})\b/,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m && INDIAN_STATE_CODES.has(m[1])) {
      return m[0].replace(/\s+/g, "").trim()
    }
  }
  return null
}

const SERVICE_KEYWORDS = /fastag|fasttag|fast\s*tag|hotlist|blacklist|blacklisted|hotlisted|replace|replacement|damaged|recharge|balance|top.?up|activation|activate|new\s*tag|add.?on|tag\s*clos|surrender|kyc|annual\s*pass|vrn\s*update|chassis/i

function hasServiceIntent(text: string): boolean {
  return SERVICE_KEYWORDS.test(text)
}

function detectServiceType(text: string): string {
  const t = text.toLowerCase()
  if (/hotlist|blacklist|hotlisted|blacklisted/.test(t)) return "Hotlisted Case"
  if (/replace|replacement|damaged|lost/.test(t))        return "Replacement Tag"
  if (/add.?on|addon|second\s*tag/.test(t))              return "Add-on Tag"
  if (/clos|surrender/.test(t))                          return "Tag Closing"
  if (/recharge|balance|top.?up/.test(t))                return "Only Recharge"
  if (/min.?kyc/.test(t))                                return "MinKYC Process"
  if (/full.?kyc/.test(t))                               return "Full KYC Process"
  if (/vrn\s*update|chassis/.test(t))                    return "VRN Update"
  if (/annual\s*pass/.test(t))                           return "Annual Pass"
  return "New Fastag"
}

function detectDocumentField(caption: string): string {
  const c = caption.toLowerCase()
  if (/rc\s*back|registration\s*back/.test(c))              return "rc_back_url"
  if (/rc|registration/.test(c))                            return "rc_front_url"
  if (/pan/.test(c))                                        return "pan_url"
  if (/aadhaar\s*back|aadhar\s*back/.test(c))               return "aadhaar_back_url"
  if (/aadhaar|aadhar|adhar|uid/.test(c))                   return "aadhaar_front_url"
  if (/sticker|paste/.test(c))                              return "sticker_pasted_url"
  if (/side|back\s*view/.test(c))                           return "vehicle_side_url"
  if (/vehicle|car|truck|bus|bike|photo|pic|front/.test(c)) return "vehicle_front_url"
  return ""
}

const DOC_SLOTS = [
  "vehicle_front_url", "rc_front_url", "rc_back_url",
  "aadhaar_front_url", "aadhaar_back_url", "pan_url",
  "vehicle_side_url",  "sticker_pasted_url",
]

// ---------------------------------------------------------------------------
// Evolution API — fetch group name
// ---------------------------------------------------------------------------
const groupNameCache: Record<string, string> = {}

async function getGroupName(groupJid: string): Promise<string> {
  if (groupNameCache[groupJid]) return groupNameCache[groupJid]
  try {
    const base   = process.env.EVO_API_URL
    const inst   = process.env.EVO_INSTANCE
    const apikey = process.env.EVO_API_KEY
    if (!base || !inst || !apikey) return ""
    const res = await fetch(
      `${base}/group/findGroupInfos/${inst}?groupJid=${encodeURIComponent(groupJid)}`,
      { headers: { apikey } }
    )
    if (!res.ok) return ""
    const json = await res.json()
    const name = json?.subject || json?.data?.subject || ""
    if (name) groupNameCache[groupJid] = name
    return name
  } catch {
    return ""
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------
async function isTeamMember(phone10: string): Promise<boolean> {
  const envList = (process.env.TEAM_WHATSAPP_NUMBERS || "")
    .split(",").map(s => s.trim().replace(/[^0-9]/g, "").slice(-10)).filter(Boolean)
  if (envList.includes(phone10)) return true
  const [rows]: any = await pool.query(
    `SELECT id FROM users WHERE RIGHT(REPLACE(REPLACE(COALESCE(phone,''),'-',''),' ',''),10) = ? LIMIT 1`,
    [phone10]
  )
  return Array.isArray(rows) && rows.length > 0
}

async function findOpenTicketByChatId(chatId: string) {
  const [rows]: any = await pool.query(
    `SELECT id, ticket_no, phone, wa_chat_id FROM tickets_nh
     WHERE wa_chat_id = ? AND status NOT IN ('closed','completed','cancelled')
     ORDER BY created_at DESC LIMIT 1`,
    [chatId]
  )
  return (Array.isArray(rows) && rows.length > 0) ? rows[0] : null
}

async function findOpenTicketByVehicle(vrn: string) {
  const [rows]: any = await pool.query(
    `SELECT id, ticket_no, wa_chat_id FROM tickets_nh
     WHERE UPPER(REPLACE(vehicle_reg_no,' ','')) = UPPER(REPLACE(?,' ',''))
       AND status NOT IN ('closed','completed','cancelled')
     ORDER BY created_at DESC LIMIT 1`,
    [vrn]
  )
  return (Array.isArray(rows) && rows.length > 0) ? rows[0] : null
}

async function createTicket(params: {
  chatId: string; senderPhone: string | null; vehicle: string | null
  serviceType: string; details: string | null
  mediaField: string | null; mediaUrl: string | null
  leadFrom: string
}) {
  const { chatId, senderPhone, vehicle, serviceType, details, mediaField, mediaUrl, leadFrom } = params
  const cols = [
    "vehicle_reg_no", "subject", "details", "phone",
    "lead_received_from", "status", "kyv_status", "npci_status",
    "wa_chat_id", "wa_sender",
  ]
  const vals: (string | null)[] = [
    vehicle ?? "", serviceType, details,
    senderPhone, leadFrom, "open", "KYV pending", "Activation Pending",
    chatId, senderPhone,
  ]
  if (mediaField && mediaUrl) { cols.push(mediaField); vals.push(mediaUrl) }

  const [result]: any = await pool.query(
    `INSERT INTO tickets_nh (${cols.join(",")}, created_at, updated_at)
     VALUES (${cols.map(() => "?").join(",")}, NOW(), NOW())`,
    vals
  )
  const id = result.insertId as number
  const ticket_no = `WA${String(id).padStart(5, "0")}`
  await pool.query(`UPDATE tickets_nh SET ticket_no = ? WHERE id = ?`, [ticket_no, id])
  return { id, ticket_no }
}

async function attachMedia(ticketId: number, field: string, url: string) {
  await pool.query(
    `UPDATE tickets_nh SET ${field} = ?, updated_at = NOW()
     WHERE id = ? AND (${field} IS NULL OR ${field} = '')`,
    [url, ticketId]
  )
}

async function closeTicket(ticketId: number) {
  await pool.query(
    `UPDATE tickets_nh SET status = 'completed', updated_at = NOW() WHERE id = ?`,
    [ticketId]
  )
}

// ---------------------------------------------------------------------------
// Status update commands
// ---------------------------------------------------------------------------
function detectUpdateCommand(text: string): string | null {
  const t = text.toLowerCase()
  if (/payment\s*(done|received|paid|ok|complete)/.test(t))     return "payment_done"
  if (/payment\s*(nil|free|no\s*pay|waive|zero)/.test(t))       return "payment_nil"
  if (/deliver(y|ed)\s*(done|complete|ok)|delivered/.test(t))   return "delivery_done"
  if (/deliver(y)?\s*(nil|no\s*del|waive)/.test(t))             return "delivery_nil"
  if (/(kyc|kyv)\s*(done|complete|verified|ok)/.test(t))        return "kyc_done"
  if (/activated|activation\s*done|tag\s*(ok|done|activated)/.test(t)) return "activated"
  if (/docs?\s*(done|ok|received)|documents?\s*(done|ok|received|uploaded)/.test(t)) return "docs_done"
  if (/^(done|completed?|finish(ed)?|closed?|ok\s*done)\b/.test(t.trim())) return "completed"
  return null
}

async function applyTicketUpdate(ticketId: number, command: string, vehicle: string) {
  const updates: Record<string, string> = {
    payment_done:   `SET payment_received = 1, updated_at = NOW()`,
    payment_nil:    `SET payment_nil = 1, payment_received = 1, updated_at = NOW()`,
    delivery_done:  `SET delivery_done = 1, status = 'completed', updated_at = NOW()`,
    delivery_nil:   `SET delivery_nil = 1, delivery_done = 1, updated_at = NOW()`,
    kyc_done:       `SET kyv_status = 'KYV done', updated_at = NOW()`,
    activated:      `SET npci_status = 'Activated', kyv_status = 'KYV done', updated_at = NOW()`,
    docs_done:      `SET kyv_status = 'Documents Received', updated_at = NOW()`,
    completed:      `SET status = 'completed', updated_at = NOW()`,
  }
  const sql = updates[command]
  if (sql) await pool.query(`UPDATE tickets_nh ${sql} WHERE id = ?`, [ticketId])
}

// ---------------------------------------------------------------------------
// Shared message processor (used by both messages.upsert and chats.update paths)
// ---------------------------------------------------------------------------
const seenMsgIds = new Set<string>()

async function processTextMessage(params: {
  chatId: string; senderJid: string; text: string
  isGroup: boolean; msgId?: string; autoReply: boolean
  msgObj?: any
}): Promise<{ action: string; ticket_no?: string; ticketId?: number }> {
  const { chatId, senderJid, text, isGroup, msgId, autoReply, msgObj } = params

  if (msgId) {
    if (seenMsgIds.has(msgId)) return { action: "already_processed" }
    seenMsgIds.add(msgId)
    if (seenMsgIds.size > 2000) {
      const arr = [...seenMsgIds]; arr.slice(0, 1000).forEach(id => seenMsgIds.delete(id))
    }
  }

  const senderPhone10 = normalizePhone(senderJid)
  const isMember      = senderPhone10 ? await isTeamMember(senderPhone10) : false
  const vehicle       = extractVehicle(text)

  // Team bare "done" with no vehicle — close the active chat ticket
  if (isMember && !vehicle) {
    const lower = text.toLowerCase().trim()
    if (/^(done|completed?|finish(ed)?|closed?|ok\s*done|activated)/.test(lower)) {
      const ticket = await findOpenTicketByChatId(chatId)
      if (ticket) {
        await closeTicket(ticket.id)
        if (autoReply) await evoSend(chatId, `✅ Ticket *${ticket.ticket_no}* marked Completed.`)
        return { action: "closed", ticketId: ticket.id }
      }
    }
    return { action: "team_no_action" }
  }

  // STATUS UPDATE: vehicle number + update command (anyone in group)
  if (vehicle) {
    const updateCmd = detectUpdateCommand(text)
    if (updateCmd) {
      const ticket = await findOpenTicketByVehicle(vehicle)
      if (ticket) {
        await applyTicketUpdate(ticket.id, updateCmd, vehicle)
        if (autoReply) await evoSend(chatId, `✅ Ticket *${ticket.ticket_no}* updated: ${updateCmd.replace("_", " ")}.`)
        return { action: "status_updated", ticketId: ticket.id, command: updateCmd }
      }
    }
  }
  const phone       = senderPhone10 ?? extractPhoneFromText(text)
  const serviceType = detectServiceType(text)
  const groupName   = isGroup ? await getGroupName(chatId) : ""
  const leadFrom    = isGroup ? `Whatsapp - ${groupName || chatId.replace("@g.us", "")}` : "Whatsapp"

  if (!vehicle || !hasServiceIntent(text)) return { action: "no_intent" }

  // For DMs only: deduplicate by chatId (same person chatting again)
  if (!isGroup) {
    const existing = await findOpenTicketByChatId(chatId)
    if (existing) {
      if (vehicle) {
        await pool.query(
          `UPDATE tickets_nh SET vehicle_reg_no = ?, updated_at = NOW()
           WHERE id = ? AND (vehicle_reg_no IS NULL OR vehicle_reg_no = '')`,
          [vehicle, existing.id]
        )
      }
      if (autoReply) await evoSend(chatId, `Your ticket *${existing.ticket_no}* is already open.`)
      return { action: "updated", ticketId: existing.id }
    }
  }

  if (vehicle) {
    const dup = await findOpenTicketByVehicle(vehicle)
    if (dup) {
      if (autoReply) await evoSend(chatId, `Vehicle *${vehicle}* already has open ticket *${dup.ticket_no}*.`)
      return { action: "duplicate_skipped" }
    }
  }

  if (phone && !vehicle) {
    const [dupRows]: any = await pool.query(
      `SELECT id, ticket_no FROM tickets_nh WHERE phone = ? AND status NOT IN ('closed','completed','cancelled') ORDER BY created_at DESC LIMIT 1`,
      [phone]
    )
    if (Array.isArray(dupRows) && dupRows.length > 0) {
      if (autoReply) await evoSend(chatId, `Your ticket *${dupRows[0].ticket_no}* is already open.`)
      return { action: "duplicate_skipped" }
    }
  }

  const ticket = await createTicket({
    chatId, senderPhone: phone, vehicle, serviceType,
    details: text.slice(0, 500) || null,
    mediaField: null, mediaUrl: null, leadFrom,
  })
  if (autoReply) {
    const label = serviceType === "New Fastag" ? "FASTag Activation" : serviceType
    await evoSend(chatId,
      `✅ *Ticket Created: ${ticket.ticket_no}*\nService: ${label}\n` +
      (vehicle ? `Vehicle: ${vehicle}\n` : "") +
      `\nPlease send RC, Aadhaar and vehicle photo.`
    )
  }
  return { action: "created", ticket_no: ticket.ticket_no }
}

// Fallback for Evolution API LID group bug: fetch latest messages via REST
async function fetchAndProcessGroupMessages(groupJid: string, autoReply: boolean) {
  try {
    const base = process.env.EVO_API_URL; const inst = process.env.EVO_INSTANCE; const apikey = process.env.EVO_API_KEY
    if (!base || !inst || !apikey) return
    const res = await fetch(`${base}/chat/findMessages/${inst}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ where: { key: { remoteJid: groupJid, fromMe: false } }, limit: 10 }),
    })
    const rawText = await res.text()
    debugLog.unshift({ ts: new Date().toISOString(), body: { _fetchGroup: groupJid, status: res.status, raw: rawText.slice(0, 500) } })
    if (debugLog.length > 20) debugLog.pop()
    if (!res.ok) return
    let json: any
    try { json = JSON.parse(rawText) } catch { return }
    const records: any[] = Array.isArray(json) ? json
      : (json?.messages?.records ?? json?.records ?? [])

    for (const msgData of records) {
      const key       = msgData?.key ?? {}
      const msgId     = String(key?.id || "")
      const ts        = Number(msgData?.messageTimestamp || 0)
      // Only process messages received after this server started
      if (ts && ts < SERVER_START_SEC) continue
      const senderJid = String(key?.participantAlt || key?.participant || msgData?.participant || groupJid)
      const msg       = msgData?.message ?? {}
      const text      = (
        msg?.conversation || msg?.extendedTextMessage?.text ||
        msg?.imageMessage?.caption || msg?.documentMessage?.caption || ""
      ).toString().trim()
      if (!text || !msgId) continue
      await processTextMessage({ chatId: groupJid, senderJid, text, isGroup: true, msgId, autoReply })
    }
  } catch (e) {
    console.error("[fetchGroupMessages]", e)
  }
}

// ---------------------------------------------------------------------------
// Main POST handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  try {
    await ensureWaColumns()
    const body: any = await req.json().catch(() => ({}))

    // Log every incoming payload for debugging
    debugLog.unshift({ ts: new Date().toISOString(), body })
    if (debugLog.length > 20) debugLog.pop()

    const event      = String(body?.event || "").toLowerCase()
    const autoReply  = String(process.env.WA_AUTOREPLY || "").toLowerCase() === "true"

    // ── LID-group workaround: chats.update OR contacts.update for a group JID ─
    if (event === "chats.update" || event === "chats_update") {
      const chats = Array.isArray(body?.data) ? body.data : [body?.data].filter(Boolean)
      for (const chat of chats) {
        const jid = String(chat?.remoteJid || chat?.id || "")
        if (jid.endsWith("@g.us")) {
          await fetchAndProcessGroupMessages(jid, autoReply)
        }
      }
      return NextResponse.json({ ok: true, note: "chats.update processed" })
    }

    if (event === "contacts.update" || event === "contacts_update") {
      const contacts = Array.isArray(body?.data) ? body.data : [body?.data].filter(Boolean)
      for (const c of contacts) {
        const jid = String(c?.remoteJid || "")
        if (jid.endsWith("@g.us")) {
          await fetchAndProcessGroupMessages(jid, autoReply)
        }
      }
      return NextResponse.json({ ok: true, note: "contacts.update processed" })
    }

    // ── messages.upsert: normal path ──────────────────────────────────────
    const evtNorm = event.replace("_", ".")
    if (evtNorm !== "messages.upsert") {
      return NextResponse.json({ ok: true, note: `event ${event} ignored` })
    }

    const rawData = body?.data ?? body
    const data    = Array.isArray(rawData) ? rawData[0] : rawData
    const key     = data?.key ?? {}
    const fromMe  = !!(key?.fromMe)

    const remoteJid = String(key?.remoteJid || "")
    const isGroup   = remoteJid.includes("@g.us")

    // Skip own messages only in DMs (in groups, allow so connected number can test)
    if (fromMe && !isGroup) return NextResponse.json({ ok: true, note: "own DM" })

    // In groups, prefer participantAlt (real phone JID) over LID participant
    const senderJid = isGroup
      ? (fromMe
          ? String(body?.sender || remoteJid)
          : String(key?.participantAlt || key?.participant || data?.participant || remoteJid))
      : remoteJid
    const chatId    = remoteJid
    const msgId     = String(key?.id || "")

    if (chatId.includes("status@") || chatId.includes("broadcast")) {
      return NextResponse.json({ ok: true, note: "status skip" })
    }

    const msg     = data?.message ?? {}
    const msgType = String(data?.messageType || Object.keys(msg)[0] || "conversation")
    const isMedia = ["imageMessage", "documentMessage", "videoMessage", "audioMessage"].includes(msgType)

    const text = (
      msg?.conversation || msg?.extendedTextMessage?.text ||
      msg?.imageMessage?.caption || msg?.documentMessage?.caption ||
      msg?.videoMessage?.caption || ""
    ).toString()

    // Media: attach to existing ticket only
    if (isMedia) {
      const existing = await findOpenTicketByChatId(chatId)
      if (existing) {
        const savedUrl = await downloadAndUploadMedia(msg)
        if (savedUrl) {
          let docField = detectDocumentField(text)
          if (!docField) {
            const [rows]: any = await pool.query(
              `SELECT ${DOC_SLOTS.join(",")} FROM tickets_nh WHERE id = ? LIMIT 1`, [existing.id])
            if (rows?.[0]) { for (const s of DOC_SLOTS) { if (!rows[0][s]) { docField = s; break } } }
            if (!docField) docField = DOC_SLOTS[0]
          }
          await attachMedia(existing.id, docField, savedUrl)
          if (autoReply) await evoSend(chatId, `📎 Document added to *${existing.ticket_no}*.`)
        }
        return NextResponse.json({ ok: true, action: "media_attached" })
      }
      return NextResponse.json({ ok: true, note: "media without open ticket, skipped" })
    }

    const result = await processTextMessage({ chatId, senderJid, text, isGroup, msgId, autoReply })
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error("[whatsapp webhook]", e)
    return NextResponse.json({ ok: true, note: e?.message || "error" })
  }
}
