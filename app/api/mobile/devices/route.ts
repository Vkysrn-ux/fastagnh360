// app/api/mobile/devices/route.ts
// POST   { token, platform? } -> register this phone for push notifications
// DELETE { token }            -> forget it (called on sign-out)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireMobile } from "@/lib/mobile-api";
import { ensurePushTables } from "@/lib/push";

export async function POST(req: NextRequest) {
  const me = await requireMobile(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").trim();
  if (token.length < 20 || token.length > 512) return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  try {
    await ensurePushTables();
    // A phone belongs to whoever signed in on it last
    await pool.query(
      `INSERT INTO push_devices (user_id, token, platform) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform), last_seen = NOW()`,
      [me.id, token, String(b.platform || "android").slice(0, 16)]
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to register device" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const me = await requireMobile(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  try {
    await ensurePushTables();
    await pool.query(`DELETE FROM push_devices WHERE token = ? AND user_id = ?`, [String(b.token || ""), me.id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
