// app/api/whatsapp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { parseIndianMobile } from "@/lib/validators";

// GET: Meta (WhatsApp Cloud API) webhook verification
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const mode = params.get("hub.mode");
    const token = params.get("hub.verify_token");
    const challenge = params.get("hub.challenge");
    if (mode === "subscribe" && token && challenge) {
      if (token === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return NextResponse.json({ error: "Verify token mismatch" }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "verify failed" }, { status: 500 });
  }
}

function findMobileInText(text: string): string | null {
  const cleaned = String(text || "").replace(/[^0-9+\s-]/g, " ");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const c = t.replace(/[\s-]/g, "");
    const parsed = parseIndianMobile(c.startsWith("+") ? c : c);
    if (parsed.ok) return parsed.value; // normalized 10-digit
  }
  // fallback: find 10 contiguous digits starting with 6-9
  const m = cleaned.match(/([6-9]\d{9})/);
  return m ? m[1] : null;
}

function findVehicleInText(text: string): string | null {
  const s = String(text || "").toUpperCase();
  // common Indian VRN patterns, permissive
  const patterns: RegExp[] = [
    /\b[A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{3,4}\b/i, // TN01AB1234, KA 5 MH 1234, etc.
    /\b[A-Z]{2}\s*\d{3,4}\s*[A-Z]{1,2}\b/i,           // older formats
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  // fallback: pick first token with letters+digits length >= 6 (not purely digits)
  const tokens = s.split(/[^A-Z0-9]+/).filter(Boolean);
  for (const t of tokens) {
    if (t.length >= 6 && /[A-Z]/.test(t) && /\d/.test(t)) return t;
  }
  return null;
}

// Strict VRN matcher for format like: TN38BV5191 (optionally spaced)
function findVehicleInTextStrict(text: string): string | null {
  const s = String(text || "").toUpperCase().replace(/[^A-Z0-9\s]/g, " ");
  // Accept contiguous or spaced variants
  const re = /\b([A-Z]{2})\s*(\d{1,2})\s*([A-Z]{1,3})\s*(\d{3,4})\b/;
  const m = s.match(re);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}${m[4]}`;
}

async function sendUltraMsgReply(to10: string, body: string) {
  try {
    if (String(process.env.ULTRAMSG_AUTOREPLY || "").toLowerCase() !== "true") return;
    const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
    const token = process.env.ULTRAMSG_TOKEN;
    if (!instanceId || !token) return;
    const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;
    const to = `+91${to10}`; // normalized Indian mobile
    const form = new URLSearchParams();
    form.set("token", token);
    form.set("to", to);
    form.set("body", body);
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      // best-effort only
      next: { revalidate: 0 },
    }).catch(() => {});
  } catch {}
}

async function insertTicket({ phone, vehicle, subject, source }: { phone: string | null; vehicle: string | null; subject?: string; source?: string; }) {
  const p = phone ? String(phone).trim() : null;
  const v = vehicle ? String(vehicle).trim() : null;
  // Best-effort duplicate guard: same phone + vehicle
  if (p && v) {
    const [rows]: any = await pool.query(
      `SELECT id FROM tickets_nh WHERE phone = ? AND UPPER(COALESCE(vehicle_reg_no,'')) = UPPER(?) LIMIT 1`,
      [p, v]
    );
    if (Array.isArray(rows) && rows.length > 0) return; // already exists
  }

  // Minimal parent ticket insert
  const cols = [
    "vehicle_reg_no",
    "subject",
    "details",
    "phone",
    "lead_received_from",
    "status",
  ];
  const vals: (string | null)[] = [
    v ?? "",
    subject ?? "WhatsApp Lead",
    source ? `Source: ${source}` : null,
    p,
    source ?? "whatsapp",
    "open",
  ];
  const placeholders = cols.map(() => "?").join(", ");
  await pool.query(`INSERT INTO tickets_nh (${cols.join(", ")}, created_at, updated_at) VALUES (${placeholders}, NOW(), NOW())`, vals);
}

// --- lightweight buffer to pair separate VRN and mobile messages from same sender ---
async function ensureBufferTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_buffer (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender VARCHAR(32) NOT NULL,
        vehicle VARCHAR(64) NULL,
        phone VARCHAR(32) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_sender (sender)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // cleanup old partial entries (older than 6 hours)
    await pool.query(`DELETE FROM whatsapp_buffer WHERE updated_at < (NOW() - INTERVAL 6 HOUR)`);
  } catch {}
}

async function readBuffer(sender: string) {
  const [rows]: any = await pool.query(`SELECT vehicle, phone, updated_at FROM whatsapp_buffer WHERE sender = ? LIMIT 1`, [sender]);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function writeBuffer(sender: string, vehicle: string | null, phone: string | null) {
  const cols: string[] = ["sender"]; const vals: any[] = [sender]; const sets: string[] = [];
  if (vehicle !== null) { cols.push("vehicle"); vals.push(vehicle); sets.push("vehicle = VALUES(vehicle)"); }
  if (phone !== null) { cols.push("phone"); vals.push(phone); sets.push("phone = VALUES(phone)"); }
  const placeholders = cols.map(() => "?").join(", ");
  await pool.query(`INSERT INTO whatsapp_buffer (${cols.join(", ")}) VALUES (${placeholders})
                    ON DUPLICATE KEY UPDATE ${sets.length ? sets.join(", ") + "," : ""} updated_at = CURRENT_TIMESTAMP`, vals);
}

async function clearBuffer(sender: string) {
  await pool.query(`DELETE FROM whatsapp_buffer WHERE sender = ?`, [sender]);
}

// POST: receive inbound messages from WhatsApp providers and create a ticket
export async function POST(req: NextRequest) {
  try {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let senderPhone: string | null = null;
    let text: string | null = null;
    let source = "whatsapp";

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      // Twilio-style webhook
      const form = await req.formData();
      text = String(form.get("Body") || form.get("body") || form.get("caption") || "");
      const from = String(form.get("From") || form.get("from") || ""); // e.g., whatsapp:+9198...
      const num = from.replace(/[^0-9]/g, "");
      const parsed = parseIndianMobile(num);
      senderPhone = parsed.ok ? parsed.value : null;
      source = "whatsapp_twilio";
    } else if (contentType.includes("application/json")) {
      // JSON providers: Meta (Cloud API) or UltraMsg
      const body: any = await req.json().catch(() => ({}));

      // Detect UltraMsg vs Meta by shape
      const isUltra = !!(body?.instanceId || body?.chatId || (body?.from && typeof body?.body !== 'undefined'));
      if (isUltra) {
        // UltraMsg webhook payload typically includes: from, body, chatId, instanceId
        const rawFrom = String(body?.from || body?.phone || body?.chatId || ""); // e.g., 919876543210@c.us
        const normalizedFrom = rawFrom.replace(/@c\.us|@g\.us/gi, "");
        const digits = normalizedFrom.replace(/[^0-9]/g, "");
        const parsed = parseIndianMobile(digits);
        senderPhone = parsed.ok ? parsed.value : null;
        const candidates = [body?.body, body?.caption, body?.message?.body, body?.text, body?.title, body?.message, body?.listResponseMessage?.title];
        text = String((candidates.find((v: any) => typeof v === 'string' && v.length > 0)) || "");
        source = "whatsapp_ultramsg";
      } else {
        // Meta (WhatsApp Cloud API)
        const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        const contact = body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
        text = (msg?.text?.body ?? msg?.button?.text ?? msg?.interactive?.nfm_reply?.response_json ?? "").toString();
        const num = String(msg?.from || contact?.wa_id || "");
        const parsed = parseIndianMobile(num);
        senderPhone = parsed.ok ? parsed.value : findMobileInText(text);
        source = "whatsapp_meta";
      }
    } else {
      // Fallback: try to decode as text (some providers may not send content-type)
      const raw = await req.text().catch(() => "");
      try {
        const body = JSON.parse(raw);
        const rawFrom = String(body?.from || body?.phone || body?.chatId || "");
        const digits = rawFrom.replace(/[^0-9]/g, "");
        const parsed = parseIndianMobile(digits);
        senderPhone = parsed.ok ? parsed.value : null;
        const candidates = [body?.body, body?.caption, body?.message?.body, body?.text, body?.title];
        text = String((candidates.find((v: any) => typeof v === 'string' && v.length > 0)) || "");
        source = body?.instanceId ? "whatsapp_ultramsg" : "whatsapp";
      } catch {
        // try form-style
        const p = new URLSearchParams(raw);
        const from = p.get("From") || p.get("from") || "";
        const num = (from || "").replace(/[^0-9]/g, "");
        const parsed = parseIndianMobile(num);
        senderPhone = parsed.ok ? parsed.value : null;
        text = p.get("Body") || p.get("body") || p.get("caption") || "";
        source = "whatsapp";
      }
    }

    if (!text && !senderPhone) {
      return NextResponse.json({ ok: true, note: "no message" });
    }

    await ensureBufferTable();
    // STRICT: require VRN + 10-digit mobile. Allow them to arrive across two separate messages per sender.
    const vehicle = findVehicleInTextStrict(text || "");
    const mobileFromText = findMobileInText(text || "");

    const senderKey = senderPhone || "unknown"; // still store to pair if phone missing

    if (vehicle && mobileFromText) {
      await insertTicket({ phone: mobileFromText, vehicle, subject: "WhatsApp Lead", source });
      if (source === "whatsapp_ultramsg") {
        await sendUltraMsgReply(mobileFromText, "Thanks! Your details are received. We created a ticket and will contact you shortly.");
      }
      await clearBuffer(senderKey);
      return NextResponse.json({ ok: true, created: true });
    }

    // If only one is present, write to buffer and try to pair
    const existing = await readBuffer(senderKey);
    const bufVehicle = vehicle ?? existing?.vehicle ?? null;
    const bufPhone = mobileFromText ?? existing?.phone ?? null;

    if (bufVehicle && bufPhone) {
      await insertTicket({ phone: bufPhone, vehicle: bufVehicle, subject: "WhatsApp Lead", source });
      if (source === "whatsapp_ultramsg") {
        await sendUltraMsgReply(bufPhone, "Thanks! Your details are received. We created a ticket and will contact you shortly.");
      }
      await clearBuffer(senderKey);
      return NextResponse.json({ ok: true, created: true });
    }

    // update buffer with whatever we have
    await writeBuffer(senderKey, vehicle ?? null, mobileFromText ?? null);
    return NextResponse.json({ ok: true, pending: true });

    
  } catch (e: any) {
    // Avoid failing provider retries; respond 200 with note
    try {
      if (String(process.env.WHATSAPP_DEBUG || "").toLowerCase() === "true") {
        // eslint-disable-next-line no-console
        console.error("/api/whatsapp error:", e);
      }
    } catch {}
    return NextResponse.json({ ok: true, note: e?.message || "error" });
  }
}
