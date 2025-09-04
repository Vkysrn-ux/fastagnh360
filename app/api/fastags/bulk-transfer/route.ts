import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const transfers = await req.json();

  try {
    let allAssigned = [];
    for (const row of transfers) {
      // Validate agent
      if (
        (!row.agentId && row.agentId !== 0 && row.agentId !== 'admin') ||
        (row.agentId !== 'admin' && isNaN(Number(row.agentId)))
      ) {
        return NextResponse.json(
          { error: "Agent is required and must be a valid number or 'admin'." },
          { status: 400 }
        );
      }
      // Validate serials
      if (!row.serials || !Array.isArray(row.serials) || row.serials.length === 0) {
        return NextResponse.json(
          { error: "Serial numbers are required for transfer." },
          { status: 400 }
        );
      }

      // Set values
      let assignedToValue = row.agentId === 'admin' ? null : Number(row.agentId);
      let statusValue = row.agentId === 'admin' ? 'in_stock' : 'assigned';

      // Update assigned_to, status, assigned_date, assigned_at
      await pool.query(
        `UPDATE fastags SET assigned_to=?, status=?, assigned_date=CURDATE(), assigned_at=NOW()
         WHERE tag_serial IN (${row.serials.map(() => '?').join(",")})`,
        [assignedToValue, statusValue, ...row.serials]
      );

      // Fetch updated assigned_date for audit/return
      const [updatedTags] = await pool.query(
        `SELECT tag_serial, assigned_date FROM fastags WHERE tag_serial IN (${row.serials.map(() => '?').join(",")})`,
        [...row.serials]
      );
      allAssigned = allAssigned.concat(updatedTags as any[]);
    }
    return NextResponse.json({ success: true, assigned: allAssigned });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
