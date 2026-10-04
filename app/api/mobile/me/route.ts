// app/api/mobile/me/route.ts
// GET -> { user } for the bearer token. The app calls this on start to check the token is still valid.
import { NextRequest, NextResponse } from "next/server";
import { requireMobile } from "@/lib/mobile-api";

export async function GET(req: NextRequest) {
  const me = await requireMobile(req);
  if (me instanceof NextResponse) return me;
  return NextResponse.json({ user: me });
}
