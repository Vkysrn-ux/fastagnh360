// app/api/tickets/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logTicketAction } from "@/lib/ticket-logs";

// GET: fetch a single ticket by id
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [rows] = await pool.query(`SELECT * FROM tickets_nh WHERE id = ?`, [id]);
  // @ts-ignore
  const row = rows?.[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // fire-and-forget log of view
  logTicketAction({ ticketId: id, action: "view", req });
  return NextResponse.json(row);
}

// PATCH: update a single ticket by id (convenience)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const data = await req.json();
  const allowedFields = [
    "vehicle_reg_no",
    "subject",
    "details",
    "phone",
    "alt_phone",
    "assigned_to",
    "lead_received_from",
    "lead_by",
    "status",
    "kyv_status",
    "customer_name",
    "comments",
    "payment_to_collect",
    "payment_to_send",
    "net_value",
    "pickup_point_name",
  ];

  const updates: string[] = [];
  const values: any[] = [];
  for (const field of allowedFields) {
    if (typeof data[field] !== "undefined") {
      updates.push(`${field} = ?`);
      values.push(data[field]);
    }
  }
  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  values.push(id);

  await pool.query(`UPDATE tickets_nh SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
  try {
    const meta: any = {};
    for (const f of allowedFields) if (typeof (data as any)[f] !== "undefined") meta[f] = (data as any)[f];
    const actorId = typeof (data as any).updated_by === "number" ? (data as any).updated_by : undefined;
    await logTicketAction({ ticketId: id, action: "update", req, actorId, meta });
  } catch {}
  return NextResponse.json({ ok: true });
}
