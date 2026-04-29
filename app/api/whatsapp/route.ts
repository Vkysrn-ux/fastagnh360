// app/api/whatsapp/route.ts — Evolution API v2
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { parseIndianMobile } from "@/lib/validators"
import { debugLog, fetchLog } from "./_log"
import Anthropic from "@anthropic-ai/sdk"

const SERVER_START_SEC = Math.floor(Date.now() / 1000)

// ---------------------------------------------------------------------------
// Agent symbol map  —  loaded once from WA_AGENTS env var
// Format: WA_AGENTS="*:Jennifer,#:Ravi,^:Karthik,+:Priya"
// ---------------------------------------------------------------------------
const agentMap: Record<string, string> = {}
for (const pair of (process.env.WA_AGENTS || "").split(",")) {
  const idx = pair.indexOf(":")
  if (idx > 0) {
    const sym  = pair.slice(0, idx).trim()
    const name = pair.slice(idx + 1).trim()
    if (sym && name) agentMap[sym] = name
  }
}

function extractAgent(text: string): { clean: string; agentName: string | null } {
  for (const [sym, name] of Object.entries(agentMap)) {
    if (text.includes(sym)) {
      return { clean: text.replaceAll(sym, "").replace(/\s{2,}/g, " ").trim(), agentName: name }
    }
  }
  return { clean: text, agentName: null }
}

// ---------------------------------------------------------------------------
// Schema migration
// ---------------------------------------------------------------------------
let schemaMigrated = false
async function ensureWaColumns() {
  if (schemaMigrated) return
  const cols: [string, string][] = [
    ["wa_chat_id",     "VARCHAR(128) NULL"],
    ["wa_sender",      "VARCHAR(32)  NULL"],
    ["bank",           "VARCHAR(32)  NULL"],
    ["is_commercial",  "TINYINT(1)   NOT NULL DEFAULT 0"],
    ["payment_amount", "INT          NULL"],
  ]
  for (const [col, def] of cols) {
    await pool.query(`ALTER TABLE tickets_nh ADD COLUMN ${col} ${def}`)
      .catch((e: any) => { if (e?.errno !== 1060) console.error(`${col}:`, e?.message) })
  }
  await pool.query(`ALTER TABLE tickets_nh ADD INDEX idx_tickets_wa_chat (wa_chat_id)`).catch(() => {})
  // Dedup table for cross-instance / multi-number deduplication
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_processed_msgs (
      msg_id     VARCHAR(128) NOT NULL,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (msg_id)
    )
  `).catch(() => {})
  await pool.query(`ALTER TABLE tickets_nh MODIFY COLUMN created_by  VARCHAR(64) NULL`).catch((e: any) => console.error("created_by:",  e?.message))
  await pool.query(`ALTER TABLE tickets_nh MODIFY COLUMN assigned_to VARCHAR(64) NULL`).catch((e: any) => console.error("assigned_to:", e?.message))
  schemaMigrated = true
}

// ---------------------------------------------------------------------------
// Evolution API — send text message
// ---------------------------------------------------------------------------
async function evoSend(to: string, text: string, force = false) {
  try {
    const autoReply = String(process.env.WA_AUTOREPLY || "").toLowerCase() === "true"
    if (!force && !autoReply) return
    const base   = process.env.EVO_API_URL
    const inst   = process.env.EVO_INSTANCE
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
// Claude Vision — extract PAN number from image
// ---------------------------------------------------------------------------
async function extractPanFromImage(base64: string, mime: string): Promise<string | null> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return null
    const client = new Anthropic({ apiKey })
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime as any, data: base64 } },
          { type: "text", text: "Look at this image. If it contains a PAN card, extract and return ONLY the PAN number (format: 5 uppercase letters + 4 digits + 1 uppercase letter, e.g. ABCDE1234F). If no PAN card or PAN number found, reply with the single word: NONE" },
        ],
      }],
    })
    const raw = (resp.content[0] as any)?.text?.trim() ?? ""
    const match = raw.match(/[A-Z]{5}[0-9]{4}[A-Z]/)
    return match ? match[0] : null
  } catch (e) {
    console.error("[panOCR]", e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------
function normalizePhone(jid: string): string | null {
  const digits = jid.replace(/@[a-z.]+$/i, "").replace(/[^0-9]/g, "")
  const parsed = parseIndianMobile(digits)
  if (parsed.ok) return parsed.value
  const p2 = parseIndianMobile(digits.slice(-10))
  return p2.ok ? p2.value : null
}

const INDIAN_STATE_CODES = new Set([
  "AP","AR","AS","BR","CG","CH","DD","DL","DN","GA","GJ","HP","HR",
  "JH","JK","KA","KL","LA","LD","MH","ML","MN","MP","MZ","NL","OD",
  "PB","PY","RJ","SK","TN","TR","TS","UK","UP","WB","AN",
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

// ---------------------------------------------------------------------------
// Lead source and bank lookup tables
// ---------------------------------------------------------------------------
const LEAD_FROM_MAP: [RegExp, string][] = [
  [/\bhq\b/i,                   "Head Office"],
  [/\bhead\s*office\b/i,        "Head Office"],
  [/\binsta(gram)?\b/i,         "Instagram"],
  [/\bfb\b|\bfacebook\b/i,      "Facebook"],
  [/\bgoogle\b/i,               "Google"],
  [/\bref(erral)?\b/i,          "Reference"],
  [/\bwalk[\s-]*in\b/i,         "Walk-in"],
  [/\bonline\b/i,               "Online"],
  [/\bwebsite\b/i,              "Website"],
]

const KNOWN_BANKS = [
  "indusind","federal","kotak","icici","hdfc","idfc","axis","bob","pnb","sbi","yes","au","fino","paytm","rbl","equitas",
]

// ---------------------------------------------------------------------------
// Structured command parsers  (all commands end with '-')
// ---------------------------------------------------------------------------

interface ParsedCreate {
  vrn: string
  subject: string
  bank: string | null
  leadFromOverride: string | null
  phone: string | null
  isCommercial: boolean
}

function parseCreateCommand(text: string): ParsedCreate | null {
  const clean = text.trimEnd().replace(/-+$/, "").trim()
  const vrn   = extractVehicle(clean.toUpperCase())
  if (!vrn) return null

  // Message must START with the vehicle number — prevents false matches
  if (!clean.toUpperCase().trimStart().startsWith(vrn)) return null

  const lower = clean.toLowerCase()

  // Commercial vehicle flag
  const isCommercial = /\bvc7\b/i.test(clean)

  // Phone (10-digit mobile)
  const phoneMatch = clean.match(/\b([6-9]\d{9})\b/)
  const phone = phoneMatch ? phoneMatch[1] : null

  // Lead source override
  let leadFromOverride: string | null = null
  for (const [re, label] of LEAD_FROM_MAP) {
    if (re.test(clean)) { leadFromOverride = label; break }
  }

  // Bank (longest match first to avoid "sbi" matching inside "indusind")
  let bank: string | null = null
  for (const b of KNOWN_BANKS) {
    if (lower.includes(b)) { bank = b.toUpperCase(); break }
  }

  // Subject — check multi-word patterns first
  let subject = "New Fastag"
  if (/annual[\s-]*pass/i.test(clean))         subject = "Annual Pass"
  else if (/phone[\s-]*update/i.test(clean))   subject = "Phone Update"
  else if (/vrn[\s-]*update/i.test(clean))     subject = "VRN Update"
  else if (/replace|replacement/i.test(clean)) subject = "Replacement Tag"
  else if (/hotlist|blacklist/i.test(clean))   subject = "Hotlisted Case"
  else if (/\bkyc\b/i.test(clean))             subject = "KYC Process"
  else if (/add[\s-]*on|addon/i.test(clean))   subject = "Add-on Tag"
  else if (/closing|surrender/i.test(clean))   subject = "Tag Closing"
  else if (/recharge|top[\s-]*up/i.test(clean))subject = "Only Recharge"
  else if (/\bother\b/i.test(clean))           subject = "Other"

  return { vrn, subject, bank, leadFromOverride, phone, isCommercial }
}

interface ParsedUpdate {
  vrn: string
  command: string
  paymentAmount: number | null
}

function parseUpdateCommand(text: string): ParsedUpdate | null {
  const clean = text.trimEnd().replace(/-+$/, "").trim()
  const lower = clean.toLowerCase()
  const vrn   = extractVehicle(clean.toUpperCase())
  if (!vrn) return null

  // Message must START with the vehicle number
  if (!clean.toUpperCase().trimStart().startsWith(vrn)) return null

  // Payment with amount: "TN08AT1585 550 received"
  const amtMatch = lower.match(/\b(\d+)\s*received\b/)
  if (amtMatch) return { vrn, command: "payment_received", paymentAmount: parseInt(amtMatch[1]) }

  if (/payment[\s-]*nil/.test(lower))                              return { vrn, command: "payment_nil",    paymentAmount: null }
  if (/activated|activation[\s-]*done/.test(lower))                return { vrn, command: "activated",      paymentAmount: null }
  if (/(kyc|kyv)[\s-]*done/.test(lower))                           return { vrn, command: "kyc_done",       paymentAmount: null }
  if (/docs?[\s-]*done|documents?[\s-]*(done|received)/.test(lower)) return { vrn, command: "docs_done",   paymentAmount: null }
  if (/deliver(y|ed)?[\s-]*done|delivered/.test(lower))            return { vrn, command: "delivery_done",  paymentAmount: null }
  if (/deliver(y)?[\s-]*nil/.test(lower))                          return { vrn, command: "delivery_nil",   paymentAmount: null }
  if (/\bdone\b/.test(lower))                                      return { vrn, command: "completed",      paymentAmount: null }

  return null
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------
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
    `SELECT id, ticket_no, wa_chat_id, is_commercial, kyv_status FROM tickets_nh
     WHERE UPPER(REPLACE(vehicle_reg_no,' ','')) = UPPER(REPLACE(?,' ',''))
       AND status NOT IN ('closed','completed','cancelled')
     ORDER BY created_at DESC LIMIT 1`,
    [vrn]
  )
  return (Array.isArray(rows) && rows.length > 0) ? rows[0] : null
}

async function createTicket(params: {
  chatId: string; senderPhone: string | null; vehicle: string
  serviceType: string; bank: string | null; isCommercial: boolean
  details: string | null; leadFrom: string; createdBy: string | null
}) {
  const { chatId, senderPhone, vehicle, serviceType, bank, isCommercial, details, leadFrom, createdBy } = params
  const cols = [
    "vehicle_reg_no","subject","details","phone",
    "lead_received_from","status","kyv_status","npci_status",
    "wa_chat_id","wa_sender","bank","is_commercial","created_by",
  ]
  const vals: (string | number | null)[] = [
    vehicle, serviceType, details,
    senderPhone, leadFrom, "open", "KYV pending", "Activation Pending",
    chatId, senderPhone, bank, isCommercial ? 1 : 0, createdBy,
  ]
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

async function applyTicketUpdate(
  ticket: { id: number; ticket_no: string; is_commercial?: number; kyv_status?: string },
  update: ParsedUpdate,
  chatId: string,
  autoReply: boolean,
  assignedTo: string | null = null
): Promise<{ action: string; ticketId?: number; blocked?: string }> {
  const { command, paymentAmount } = update

  // Commercial vehicle: 'done' requires KYV to be completed
  if (command === "completed" && Number(ticket.is_commercial) === 1) {
    if (ticket.kyv_status !== "KYV done") {
      if (autoReply) await evoSend(chatId,
        `⚠️ Cannot close *${ticket.ticket_no}* — KYV not completed for commercial vehicle.`)
      return { action: "blocked", blocked: "kyv_required" }
    }
  }

  // Always update assigned_to to whoever sent this update
  const assignSql = assignedTo ? `, assigned_to = ${pool.escape(assignedTo)}` : ""

  if (command === "payment_received") {
    const amtSql = paymentAmount !== null ? `, payment_amount = ${paymentAmount}` : ""
    await pool.query(
      `UPDATE tickets_nh SET payment_received = 1${amtSql}${assignSql}, updated_at = NOW() WHERE id = ?`,
      [ticket.id]
    )
  } else {
    const updates: Record<string, string> = {
      payment_nil:   `SET payment_nil = 1, payment_received = 1`,
      delivery_done: `SET delivery_done = 1, status = 'completed'`,
      delivery_nil:  `SET delivery_nil = 1, delivery_done = 1`,
      kyc_done:      `SET kyv_status = 'KYV done'`,
      activated:     `SET npci_status = 'Activated', kyv_status = 'KYV done'`,
      docs_done:     `SET kyv_status = 'Documents Received'`,
      completed:     `SET status = 'completed'`,
    }
    const base = updates[command]
    if (base) await pool.query(
      `UPDATE tickets_nh ${base}${assignSql}, updated_at = NOW() WHERE id = ?`,
      [ticket.id]
    )
  }

  if (autoReply) {
    const label = command === "payment_received" && paymentAmount !== null
      ? `payment ₹${paymentAmount} received`
      : command.replace(/_/g, " ")
    await evoSend(chatId, `✅ Ticket *${ticket.ticket_no}* updated: ${label}.`)
  }
  return { action: "status_updated", ticketId: ticket.id }
}

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
  } catch { return "" }
}

// ---------------------------------------------------------------------------
// Resolve sender display name from users table
// ---------------------------------------------------------------------------
async function getSenderName(phone10: string): Promise<string | null> {
  try {
    const [rows]: any = await pool.query(
      `SELECT name FROM users
       WHERE RIGHT(REPLACE(REPLACE(COALESCE(phone,''),'-',''),' ',''),10) = ?
       LIMIT 1`,
      [phone10]
    )
    if (Array.isArray(rows) && rows.length > 0 && rows[0].name) return rows[0].name
    return null
  } catch { return null }
}

// ---------------------------------------------------------------------------
// Shared message processor
// ---------------------------------------------------------------------------
const seenMsgIds = new Set<string>()

async function processTextMessage(params: {
  chatId: string; senderJid: string; text: string
  isGroup: boolean; msgId?: string; autoReply: boolean
}): Promise<{ action: string; ticket_no?: string; ticketId?: number; blocked?: string }> {
  const { chatId, senderJid, text, isGroup, msgId, autoReply } = params

  if (msgId) {
    // Fast in-memory check
    if (seenMsgIds.has(msgId)) return { action: "already_processed" }
    // DB-level atomic dedup — handles two WhatsApp instances / multiple serverless invocations
    const [ins]: any = await pool.query(
      `INSERT IGNORE INTO wa_processed_msgs (msg_id) VALUES (?)`, [msgId]
    ).catch(() => [{ affectedRows: 1 }])
    if (ins?.affectedRows === 0) return { action: "already_processed" }
    seenMsgIds.add(msgId)
    if (seenMsgIds.size > 2000) {
      const arr = [...seenMsgIds]; arr.slice(0, 1000).forEach(id => seenMsgIds.delete(id))
    }
    // Prune old records weekly to keep the table small
    pool.query(`DELETE FROM wa_processed_msgs WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`)
      .catch(() => {})
  }

  // Extract agent symbol from message (overrides phone-based lookup)
  const { clean: cleanText, agentName } = extractAgent(text)

  // Resolve sender name: symbol takes priority, then users table, then phone
  const senderPhone10 = normalizePhone(senderJid)
  const senderName    = agentName
    ?? (senderPhone10 ? ((await getSenderName(senderPhone10)) ?? senderPhone10) : null)

  // Updates require trailing '-'; creation does not
  if (cleanText.trimEnd().endsWith("-")) {
    const updateParsed = parseUpdateCommand(cleanText)
    if (updateParsed) {
      const ticket = await findOpenTicketByVehicle(updateParsed.vrn)
      if (!ticket) return { action: "no_ticket_found" }
      return applyTicketUpdate(ticket, updateParsed, chatId, autoReply, senderName)
    }
    return { action: "no_command" }
  }

  // Creation path (no '-' required)
  const createParsed = parseCreateCommand(cleanText)
  if (!createParsed) return { action: "parse_failed" }

  const { vrn, subject, bank, leadFromOverride, phone, isCommercial } = createParsed

  // Group messages always use the group name as lead source
  // Keyword overrides (hq, insta, etc.) only apply in DMs
  const groupName = isGroup ? await getGroupName(chatId) : ""
  const leadFrom  = isGroup
    ? `Whatsapp - ${groupName || chatId.replace("@g.us", "")}`
    : (leadFromOverride ?? "Whatsapp")

  // Sender phone as fallback if not in message
  const finalPhone = phone ?? (isGroup ? null : senderPhone10)

  // Duplicate by vehicle
  const dupByVrn = await findOpenTicketByVehicle(vrn)
  if (dupByVrn) {
    if (autoReply) await evoSend(chatId, `Vehicle *${vrn}* already has open ticket *${dupByVrn.ticket_no}*.`)
    return { action: "duplicate_skipped" }
  }

  // For DMs: duplicate by chatId
  if (!isGroup) {
    const existing = await findOpenTicketByChatId(chatId)
    if (existing) {
      if (autoReply) await evoSend(chatId, `Your ticket *${existing.ticket_no}* is already open.`)
      return { action: "duplicate_skipped" }
    }
  }

  const ticket = await createTicket({
    chatId, senderPhone: finalPhone, vehicle: vrn,
    serviceType: subject, bank, isCommercial,
    details: cleanText.slice(0, 500), leadFrom, createdBy: senderName,
  })

  if (autoReply) {
    await evoSend(chatId,
      `✅ *Ticket Created: ${ticket.ticket_no}*\nService: ${subject}\nVehicle: ${vrn}\n` +
      (bank ? `Bank: ${bank}\n` : "") +
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
    fetchLog.unshift({ ts: new Date().toISOString(), body: { _fetchGroup: groupJid, status: res.status, raw: rawText.slice(0, 300) } })
    if (fetchLog.length > 30) fetchLog.pop()
    if (!res.ok) return
    let json: any
    try { json = JSON.parse(rawText) } catch { return }
    const records: any[] = Array.isArray(json) ? json
      : (json?.messages?.records ?? json?.records ?? [])

    for (const msgData of records) {
      const key       = msgData?.key ?? {}
      const msgId     = String(key?.id || "")
      const ts        = Number(msgData?.messageTimestamp || 0)
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
// Main handlers
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  try {
    await ensureWaColumns()
    const body: any = await req.json().catch(() => ({}))

    debugLog.unshift({ ts: new Date().toISOString(), body })
    if (debugLog.length > 20) debugLog.pop()

    const event     = String(body?.event || "").toLowerCase()
    const autoReply = String(process.env.WA_AUTOREPLY || "").toLowerCase() === "true"

    // LID-group workaround
    if (event === "chats.update" || event === "chats_update") {
      const chats = Array.isArray(body?.data) ? body.data : [body?.data].filter(Boolean)
      for (const chat of chats) {
        const jid = String(chat?.remoteJid || chat?.id || "")
        if (jid.endsWith("@g.us")) await fetchAndProcessGroupMessages(jid, autoReply)
      }
      return NextResponse.json({ ok: true, note: "chats.update processed" })
    }

    if (event === "contacts.update" || event === "contacts_update") {
      const contacts = Array.isArray(body?.data) ? body.data : [body?.data].filter(Boolean)
      for (const c of contacts) {
        const jid = String(c?.remoteJid || "")
        if (jid.endsWith("@g.us")) await fetchAndProcessGroupMessages(jid, autoReply)
      }
      return NextResponse.json({ ok: true, note: "contacts.update processed" })
    }

    const evtNorm = event.replace("_", ".")
    if (evtNorm !== "messages.upsert") {
      return NextResponse.json({ ok: true, note: `event ${event} ignored` })
    }

    const rawData   = body?.data ?? body
    const data      = Array.isArray(rawData) ? rawData[0] : rawData
    const key       = data?.key ?? {}
    const fromMe    = !!(key?.fromMe)
    const remoteJid = String(key?.remoteJid || "")
    const isGroup   = remoteJid.includes("@g.us")

    // Process all messages including fromMe — team sends ticket format from the business number

    const senderJid = isGroup
      ? (fromMe
          ? String(body?.sender || remoteJid)
          : String(key?.participantAlt || key?.participant || data?.participant || remoteJid))
      : (fromMe
          ? String(body?.sender || remoteJid)   // fromMe DM: sender = business number
          : remoteJid)                           // incoming DM: sender = customer number
    const chatId = remoteJid
    const msgId  = String(key?.id || "")

    if (chatId.includes("status@") || chatId.includes("broadcast")) {
      return NextResponse.json({ ok: true, note: "status skip" })
    }

    const msg     = data?.message ?? {}
    const msgType = String(data?.messageType || Object.keys(msg)[0] || "conversation")
    const isMedia = ["imageMessage","documentMessage","videoMessage","audioMessage"].includes(msgType)

    // Media: PAN OCR only
    if (isMedia) {
      if (msgType === "imageMessage" && process.env.ANTHROPIC_API_KEY) {
        const imgMsg = msg?.imageMessage ?? {}
        const mime   = String(imgMsg?.mimetype || "image/jpeg")
        const base   = process.env.EVO_API_URL
        const inst   = process.env.EVO_INSTANCE
        const apikey = process.env.EVO_API_KEY
        if (base && inst && apikey) {
          const b64Res = await fetch(`${base}/chat/getBase64FromMediaMessage/${inst}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey },
            body: JSON.stringify({ message: { imageMessage: imgMsg }, convertToMp4: false }),
          }).catch(() => null)
          if (b64Res?.ok) {
            const b64Json = await b64Res.json()
            const b64 = b64Json?.base64 || b64Json?.data?.base64 || ""
            if (b64) {
              const pan = await extractPanFromImage(b64, mime)
              if (pan) {
                await evoSend(chatId, `🪪 PAN Number: *${pan}*`, true)
                return NextResponse.json({ ok: true, action: "pan_extracted", pan })
              }
            }
          }
        }
      }
      return NextResponse.json({ ok: true, note: "media skipped" })
    }

    const text = (
      msg?.conversation || msg?.extendedTextMessage?.text ||
      msg?.imageMessage?.caption || msg?.documentMessage?.caption ||
      msg?.videoMessage?.caption || ""
    ).toString()

    const result = await processTextMessage({ chatId, senderJid, text, isGroup, msgId, autoReply })
    // Log the outcome alongside the message text so you can debug parse failures
    debugLog.unshift({ ts: new Date().toISOString(), body: { _result: result, text, chatId, senderJid } })
    if (debugLog.length > 20) debugLog.pop()
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error("[whatsapp webhook]", e)
    return NextResponse.json({ ok: true, note: e?.message || "error" })
  }
}
