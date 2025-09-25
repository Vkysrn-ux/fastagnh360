import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"
import bcrypt from "bcryptjs"

const ALLOWED_ROLES = new Set([
  "admin",
  "employee",
  "manager",
  "team-leader",
  "agent",
])

function normalize(value: unknown) {
  return String(value ?? "").trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = normalize(body.name)
    const email = normalize(body.email).toLowerCase()
    const phone = normalize(body.phone) || null
    const role = normalize(body.role).toLowerCase()
    const status = (normalize(body.status) || "active").toLowerCase()
    const password = String(body.password ?? "")

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })
    if (!ALLOWED_ROLES.has(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 })

    let usePassword = password
    if (!usePassword) {
      const seed = Math.random().toString(36).slice(2, 10)
      usePassword = `Nh${seed}#1`
    }

    if (usePassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const hash = await bcrypt.hash(usePassword, 10)

    const [result]: any = await pool.query(
      "INSERT INTO users (name, email, phone, role, status, password) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, phone || null, role, status === "inactive" ? "Inactive" : "Active", hash]
    )

    return NextResponse.json({ success: true, userId: result.insertId })
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Email or phone already exists" }, { status: 409 })
    }
    console.error("portal-users/register error", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

