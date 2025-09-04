import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ success: true });
  res.cookies.set("user-session", "", { expires: new Date(0), path: "/" });
  return res;
}

