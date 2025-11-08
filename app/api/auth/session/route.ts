import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("user-session")?.value;
    if (!raw) return NextResponse.json({ session: null });
    try {
      const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })();
      const parsed = JSON.parse(decoded);
      return NextResponse.json({ session: parsed });
    } catch {
      return NextResponse.json({ session: null });
    }
  } catch (e: any) {
    return NextResponse.json({ session: null, error: e?.message }, { status: 200 });
  }
}

