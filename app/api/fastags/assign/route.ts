// /app/api/fastag/assign/route.ts

import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const { agentId, count, tag_serial } = await req.json()

    if (!agentId) {
      return NextResponse.json({ error: "Missing agentId" }, { status: 400 })
    }

    if (tag_serial) {
      // Assign a specific FASTag (Edit option)
      const [result] = await pool.query(
        `UPDATE fastags
         SET status = 'assigned',
             assigned_to = ?,
             assigned_at = NOW()
         WHERE tag_serial = ?`,
        [agentId, tag_serial]
      )

      return NextResponse.json({
        success: true,
        mode: "single",
        updated: (result as any).affectedRows
      })
    } else if (count) {
      // Bulk assign FASTags
      const [result] = await pool.query(
        `UPDATE fastags
         SET status = 'assigned',
             assigned_to = ?,
             assigned_at = NOW()
         WHERE status = 'in_stock'
         LIMIT ?`,
        [agentId, count]
      )

      return NextResponse.json({
        success: true,
        mode: "bulk",
        assigned: (result as any).affectedRows
      })
    } else {
      return NextResponse.json({ error: "Provide either count or tag_serial" }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
