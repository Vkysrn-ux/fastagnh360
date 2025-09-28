import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const transfers = await req.json();

  try {
    // Ensure audit table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS fastag_transfers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tag_serial VARCHAR(255) NOT NULL,
          from_role VARCHAR(64) NULL,
          from_user_id INT NULL,
          to_role VARCHAR(64) NULL,
          to_user_id INT NULL,
          bank_name VARCHAR(255) NULL,
          fastag_class VARCHAR(64) NULL,
          prefix VARCHAR(64) NULL,
          note TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch {}

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
      let assignedToAgentId = row.agentId === 'admin' ? null : Number(row.agentId);
      let statusValue = row.agentId === 'admin' ? 'in_stock' : 'assigned';

      // Update assigned_to_agent_id, status, assigned_date, assigned_at
      await pool.query(
        `UPDATE fastags SET assigned_to_agent_id = ?, status = ?, assigned_date = CURDATE(), assigned_at = NOW()
         WHERE tag_serial IN (${row.serials.map(() => '?').join(",")})`,
        [assignedToAgentId, statusValue, ...row.serials]
      );

      // Audit log per serial
      const fromUserId = row.from === 'admin' ? null : (row.from ? Number(row.from) : null);
      const toUserId = row.agentId === 'admin' ? null : (row.agentId ? Number(row.agentId) : null);
      const note = typeof row.note === 'string' ? row.note : '';
      for (const s of row.serials) {
        try {
          await pool.query(
            `INSERT INTO fastag_transfers (tag_serial, from_role, from_user_id, to_role, to_user_id, bank_name, fastag_class, prefix, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [s, row.fromRole || null, fromUserId, row.toRole || null, toUserId, row.bank || null, row.fastagClass || null, row.prefix || null, note || null]
          );
        } catch {}
      }

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
