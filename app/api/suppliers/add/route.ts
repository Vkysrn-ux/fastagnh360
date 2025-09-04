import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserSession } from '@/lib/getSession'; // use your actual session import

export async function POST(req: NextRequest) {
  try {
    // Check authentication/session
    const session = await getUserSession(); // If async, use await
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (session.userType !== 'admin' && session.userType !== 'manager') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get payload
    const { name, contact_person, email, phone, address } = await req.json();

    // Only "name" is required!
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }

    await pool.query(
      "INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)",
      [name, contact_person || "", email || "", phone || "", address || ""]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supplierId = params.id;
    let withData = false;

    try {
      const body = await req.json();
      withData = !!body.withData;
    } catch {
      // If no body, default to withData = false
    }

    // Check for related FASTags
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM fastags WHERE supplier_id = ?", 
      [supplierId]
    );
    const fastagCount = rows[0]?.cnt || 0;

    if (fastagCount === 0) {
      // No data: safe to delete supplier directly
      await pool.query("DELETE FROM suppliers WHERE id = ?", [supplierId]);
      return NextResponse.json({ success: true });
    } else if (withData) {
      // Data exists, and user confirmed to delete all
      await pool.query("DELETE FROM fastags WHERE supplier_id = ?", [supplierId]);
      await pool.query("DELETE FROM suppliers WHERE id = ?", [supplierId]);
      return NextResponse.json({ success: true });
    } else {
      // Data exists, but no confirmation to delete all
      return NextResponse.json(
        { error: "Supplier has related FASTag data. Select the checkbox to delete all data." }, 
        { status: 400 }
      );
    }
  } catch (err: any) {
  return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}