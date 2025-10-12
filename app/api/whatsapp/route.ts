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

// POST: receive inbound messages from WhatsApp providers and create a ticket
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let senderPhone: string | null = null;
    let text: string | null = null;
    let source = "whatsapp";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Twilio-style webhook
      const form = await req.formData();
      text = String(form.get("Body") || "");
      const from = String(form.get("From") || ""); // e.g., whatsapp:+9198...
      const num = from.replace(/[^0-9]/g, "");
      const parsed = parseIndianMobile(num);
      senderPhone = parsed.ok ? parsed.value : null;
      source = "whatsapp_twilio";
    } else {
      // JSON providers: Meta (Cloud API) or UltraMsg
      const body: any = await req.json().catch(() => ({}));

      // Detect UltraMsg vs Meta by shape
      const isUltra = !!(body?.instanceId || body?.chatId || (body?.from && typeof body?.body !== 'undefined'));
      if (isUltra) {
        // UltraMsg webhook payload typically includes: from, body, chatId, instanceId
        const rawFrom = String(body?.from || body?.chatId || ""); // e.g., 919876543210@c.us
        const normalizedFrom = rawFrom.replace(/@c\.us|@g\.us/gi, "");
        const digits = normalizedFrom.replace(/[^0-9]/g, "");
        const parsed = parseIndianMobile(digits);
        senderPhone = parsed.ok ? parsed.value : null;
        text = String(body?.body || body?.message?.body || body?.text || "");
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
    }

    if (!text && !senderPhone) {
      return NextResponse.json({ ok: true, note: "no message" });
    }

    const mobile = senderPhone || findMobileInText(text || "");
    const vehicle = findVehicleInText(text || "");

    await insertTicket({ phone: mobile, vehicle, subject: "WhatsApp Lead", source });
    if (source === "whatsapp_ultramsg" && mobile) {
      await sendUltraMsgReply(mobile, "Thanks! Your details are received. We created a ticket and will contact you shortly.");
    }

    return NextResponse.json({ ok: true, created: true });
  } catch (e: any) {
    // Avoid failing provider retries; respond 200 with note
    return NextResponse.json({ ok: true, note: e?.message || "error" });
  }
}
