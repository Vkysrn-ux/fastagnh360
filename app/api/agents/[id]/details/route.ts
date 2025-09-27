import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    // 1. Total FASTags assigned to this agent
    const [totalRows] = await pool.query(
      "SELECT COUNT(*) as cnt FROM fastags WHERE assigned_to_agent_id = ? AND status IN ('assigned','in_stock')", [agentId]
    );
    // 2. FASTags with status = 'assigned'
    const [availRows] = await pool.query(
      "SELECT COUNT(*) as cnt FROM fastags WHERE assigned_to_agent_id = ? AND status = 'assigned'", [agentId]
    );
    // 3. Sold FASTags handled by this agent (from sales snapshot)
    let soldCount = 0;
    try {
      // Ensure table exists before counting
      await pool.query(`
        CREATE TABLE IF NOT EXISTS fastag_sales (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tag_serial VARCHAR(255) NOT NULL,
          ticket_id INT NULL,
          vehicle_reg_no VARCHAR(64) NULL,
          bank_name VARCHAR(255) NULL,
          fastag_class VARCHAR(32) NULL,
          supplier_id INT NULL,
          sold_by_user_id INT NULL,
          sold_by_agent_id INT NULL,
          payment_to_collect DECIMAL(10,2) NULL,
          payment_to_send DECIMAL(10,2) NULL,
          net_value DECIMAL(10,2) NULL,
          commission_amount DECIMAL(10,2) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      const [sold] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM fastag_sales WHERE sold_by_user_id = ? OR sold_by_agent_id = ?",
        [agentId, agentId]
      );
      // @ts-ignore
      soldCount = (sold as any)?.[0]?.cnt || 0;
      if (!soldCount) {
        const [alt] = await pool.query(
          "SELECT COUNT(*) AS cnt FROM fastags WHERE status='sold' AND sold_by_user_id = ?",
          [agentId]
        );
        // @ts-ignore
        soldCount = (alt as any)?.[0]?.cnt || 0;
      }
    } catch {}
    // 4. Reassigned FASTags (future logic)
    const reassignedCount = 0;
    // 5. List all FASTags assigned to this agent
    const [serialRows] = await pool.query(
      `SELECT 
          f.tag_serial,
          f.assigned_date,
          f.status,
          f.bank_name,
          f.fastag_class,
          SUBSTRING_INDEX(f.tag_serial, '-', 2) AS serial_prefix,
          (SELECT name FROM users WHERE id = f.assigned_to_agent_id) AS current_holder
       FROM fastags f
       WHERE f.assigned_to_agent_id = ?
       ORDER BY f.assigned_date DESC`, [agentId]
    );

    // 6. Sales summary by bank, serial prefix, and class for this agent
    let salesGroups: any[] = [];
    try {
      const [groups] = await pool.query(
        `SELECT 
            COALESCE(s.bank_name, '') AS bank_name,
            CASE 
              WHEN s.tag_serial LIKE '%-%-%' THEN SUBSTRING_INDEX(s.tag_serial, '-', 2)
              ELSE ''
            END AS serial_prefix,
            COALESCE(s.fastag_class, '') AS fastag_class,
            COUNT(*) AS sold_count
         FROM fastag_sales s
         WHERE s.sold_by_user_id = ? OR s.sold_by_agent_id = ?
         GROUP BY bank_name, serial_prefix, fastag_class`,
        [agentId, agentId]
      );
      salesGroups = Array.isArray(groups) ? (groups as any[]) : [];
    } catch {}

    return NextResponse.json({
      total_fastags: Number(availRows[0].cnt || 0) + Number(soldCount || 0),
      available_fastags: availRows[0].cnt,
      sold_fastags: soldCount,
      reassigned_fastags: reassignedCount,
      fastag_serials: serialRows || [],
      sales_groups: salesGroups
    });
  } catch (err) {
    console.error("Agent details API failed", err);
    return NextResponse.json({ error: "Failed to fetch details" }, { status: 500 });
  }
}
