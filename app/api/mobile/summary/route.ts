// app/api/mobile/summary/route.ts
// GET ?user_id= (admins only for other users) -> task + ticket counts for one person.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireMobile, targetUserId, userSummary } from "@/lib/mobile-api";

export async function GET(req: NextRequest) {
  const me = await requireMobile(req);
  if (me instanceof NextResponse) return me;
  const uid = targetUserId(me, req);
  if (uid instanceof NextResponse) return uid;
  try {
    const [u]: any = await pool.query(`SELECT id, name FROM users WHERE id = ?`, [uid]);
    if (!u?.[0]) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user: { id: Number(u[0].id), name: u[0].name }, ...(await userSummary(uid)) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load summary" }, { status: 500 });
  }
}
