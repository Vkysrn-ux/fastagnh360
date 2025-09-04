import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let {
      name,
      phone = "",
      pincode = "",
      role = "",
      parent_user_id,
      area = "",
      bank_ids = [],
    } = body;

    const original = { name, phone, pincode, role, area, parent_user_id, bank_ids };

    // Safe trimming
    name = (name ?? "").trim();
    phone = (phone ?? "").trim();
    pincode = (pincode ?? "").trim();
    role = (role ?? "").trim();
    area = (area ?? "").trim();

    const cleanedBankIds = Array.isArray(bank_ids)
      ? bank_ids
          .map(entry => ({
            bank_name: typeof entry?.bank_name === "string" ? entry.bank_name.trim() : "",
            bank_reference_id: typeof entry?.bank_reference_id === "string" ? entry.bank_reference_id.trim() : "",
            supplier_name: typeof entry?.supplier_name === "string" ? entry.supplier_name.trim() : "",
          }))
          .filter(entry => entry.bank_name && entry.bank_reference_id)
      : [];

    return NextResponse.json({
      success: true,
      message: "DEBUG ONLY — No DB write",
      original,
      parsed: {
        name,
        phone,
        pincode,
        role,
        area,
        parent_user_id,
        bank_ids: cleanedBankIds,
      },
    });
  } catch (error: any) {
    console.error("DEBUG ERROR:", error);
    return NextResponse.json({ error: "Failed to parse debug payload" }, { status: 500 });
  }
}
