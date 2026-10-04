// lib/mobile-auth.ts
// Signed bearer tokens for the staff mobile app. Independent of the website's cookie login.
// Token = base64url(payload) + "." + base64url(HMAC-SHA256(payload, MOBILE_TOKEN_SECRET))
import crypto from "crypto";
import { pool } from "@/lib/db";

const TOKEN_DAYS = 30;

export type MobileUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  userType: "admin" | "employee";
  isSuperAdmin: boolean;
};

function secret(): string {
  const s = process.env.MOBILE_TOKEN_SECRET?.trim();
  if (!s || s.length < 32) throw new Error("MOBILE_TOKEN_SECRET is not configured (min 32 chars)");
  return s;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function signMobileToken(userId: number): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400;
  const payload = b64url(Buffer.from(JSON.stringify({ uid: userId, exp })));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(payload).digest());
  return { token: `${payload}.${sig}`, expiresAt: new Date(exp * 1000).toISOString() };
}

function verifyMobileToken(token: string): number | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isFinite(uid) || !Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
    return Number(uid);
  } catch {
    return null;
  }
}

const ADMIN_ROLES = ["admin", "administrator", "super", "super-admin", "super_admin", "super admin", "superadmin"];
const SUPER_ROLES = ["super", "super-admin", "super_admin", "super admin", "superadmin"];
const EMPLOYEE_ROLES = ["employee", "accountant", "hr", "accounts"];

/** Maps a users row to a mobile user, or null if the role may not use the staff app. */
export function toMobileUser(u: any): MobileUser | null {
  const role = String(u?.role || "").trim().toLowerCase();
  const status = String(u?.status || "active").trim().toLowerCase();
  if (status !== "active") return null;
  let userType: MobileUser["userType"] | null = null;
  if (ADMIN_ROLES.includes(role)) userType = "admin";
  else if (EMPLOYEE_ROLES.includes(role)) userType = "employee";
  if (!userType) return null;
  return {
    id: Number(u.id),
    name: String(u.name || ""),
    email: String(u.email || ""),
    role: String(u.role || ""),
    userType,
    isSuperAdmin: SUPER_ROLES.includes(role),
  };
}

/**
 * Reads "Authorization: Bearer <token>" and returns the current user.
 * The user row is re-checked on every request, so deactivating a user cuts off the app immediately.
 */
export async function getMobileUser(authHeader: string | null | undefined): Promise<MobileUser | null> {
  const m = String(authHeader || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const uid = verifyMobileToken(m[1].trim());
  if (!uid) return null;
  const [rows]: any = await pool.query(
    `SELECT id, name, email, role, status FROM users WHERE id = ? LIMIT 1`,
    [uid]
  );
  return rows?.[0] ? toMobileUser(rows[0]) : null;
}
