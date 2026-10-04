// app/api/mobile/login/route.ts
// POST { email, password } -> { token, expires_at, user }
// Only admins and employees can sign in to the staff app.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { signMobileToken, toMobileUser } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });

    const [rows]: any = await pool.query(
      `SELECT id, name, email, role, status, password FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    const u = rows?.[0];
    const ok = !!u?.password && (await bcrypt.compare(password, String(u.password)).catch(() => false));
    if (!ok) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    const user = toMobileUser(u);
    if (!user) return NextResponse.json({ error: "This account cannot use the staff app" }, { status: 403 });

    const { token, expiresAt } = signMobileToken(user.id);
    try { await pool.query(`UPDATE users SET last_login = NOW() WHERE id = ?`, [user.id]); } catch {}
    return NextResponse.json({ token, expires_at: expiresAt, user });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Login failed" }, { status: 500 });
  }
}
