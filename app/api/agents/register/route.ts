import { NextRequest, NextResponse } from "next/server";
import { createPortalUser } from "@/lib/actions/admin-actions";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, phone, role,
      parent_id, area, bank_ids,
      email, pincode,
      notes,
    } = body;

    // Create portal user first
    const result = await createPortalUser({
      name,
      email,
      phone,
      role,
      status: "active",
      parent_id: parent_id ?? null,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    const userId = result.user.id;

    // Update agent specific fields
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Ensure users.notes column exists (TEXT)
      try {
        await conn.query("ALTER TABLE users ADD COLUMN notes TEXT NULL");
      } catch {}

      // Update pincode and area
      await conn.query(
        "UPDATE users SET pincode = ?, area = ?, notes = COALESCE(?, notes) WHERE id = ?",
        [pincode || null, area || null, notes || null, userId]
      );

      // Insert bank_ids if provided (only for toll agents)
      if (role === "toll-agent" && Array.isArray(bank_ids) && bank_ids.length > 0) {
        for (const entry of bank_ids) {
          const bankName = (entry.bank_name ?? "").trim();
          const refId = (entry.bank_reference_id ?? "").trim();

          if (!bankName || !refId) continue;

          await conn.query(
            "INSERT INTO agent_bank_ids (agent_id, bank_name, bank_reference_id) VALUES (?, ?, ?)",
            [userId, bankName, refId]
          );
        }
      }

      // If email is provided, set password
      if (email) {
        const defaultPass = "Agent@123#";
        const hash = await bcrypt.hash(defaultPass, 10);
        await conn.query(
          "UPDATE users SET password = ? WHERE id = ?",
          [hash, userId]
        );
      }

      await conn.commit();

      return NextResponse.json({
        success: true,
        userId,
        generatedPassword: result.generatedPassword
      });

    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Duplicate entry (Phone or other unique field already exists)." },
        { status: 409 }
      );
    }
    console.error("Registration failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
