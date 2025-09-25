import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasTableColumn } from "@/lib/db-helpers";

export async function GET() {
  try {
    const hasLastLogin = await hasTableColumn("users", "last_login");
    const hasUpdatedAt = await hasTableColumn("users", "updated_at");
    const hasLastActivity = await hasTableColumn("users", "last_activity");
    const cols = ["id", "name", "email", "role", "status"] as string[];
    if (hasLastLogin) cols.push("last_login");

    let lastActivityExpr = "NULL as last_activity";
    if (hasLastActivity) lastActivityExpr = "last_activity as last_activity";
    else if (hasUpdatedAt && hasLastLogin)
      lastActivityExpr = "GREATEST(updated_at, last_login) as last_activity";
    else if (hasUpdatedAt)
      lastActivityExpr = "updated_at as last_activity";
    else if (hasLastLogin)
      lastActivityExpr = "last_login as last_activity";

    const sql = `SELECT ${cols.join(", ")}, ${lastActivityExpr} FROM users ORDER BY ${hasLastLogin ? "last_login DESC, " : ""}id DESC`;
    const [rows] = await pool.query(sql);
    return NextResponse.json(rows);
  } catch (e) {
    console.error("users-activity error", e);
    return NextResponse.json([]);
  }
}


