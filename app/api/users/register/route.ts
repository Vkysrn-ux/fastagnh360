import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, pincode, role = 'agent', email = '' } = body;

    // Check for required fields
    if (!name || !phone || !pincode) {
      return NextResponse.json({ error: "Name, Phone, and Pincode are required." }, { status: 400 });
    }

    // Insert new user with role
    const [result]: any = await pool.query(
      `INSERT INTO users (name, phone, pincode, role) VALUES (?, ?, ?, ?)`,
      [name, phone, pincode, role]
    );

    const userId = result.insertId as number;

    // If email provided, verify it's unique and set credentials
    if (email) {
      // Check if email already exists
      const [existingUsers]: any = await pool.query(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [email, userId]
      );

      if (existingUsers && existingUsers.length > 0) {
        return NextResponse.json({ error: "Email already exists." }, { status: 400 });
      }

      const defaultPass = "Agent@123#"; // default for all role-based registrations
      const hash = await bcrypt.hash(defaultPass, 10);
      try {
        // Your users table uses `password` column and unique email
        await pool.query(
          "UPDATE users SET email = ?, password = ? WHERE id = ?",
          [String(email).toLowerCase(), hash, userId]
        );
      } catch (e) {
        // If columns not present, ignore
      }
    }

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Phone or Pincode already exists" }, { status: 409 });
    }
    console.error("Registration failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
