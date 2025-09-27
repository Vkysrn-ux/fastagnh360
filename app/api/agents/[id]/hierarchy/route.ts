import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Recursive helper to build hierarchy and sums
function buildAgentTreeAndSums(agents: any[], parentId: number | string | null) {
  return agents
    .filter(a => String(a.parent_user_id) === String(parentId))
    .map(a => {
      const children = buildAgentTreeAndSums(agents, a.id);
      const total_fastags_with_children =
        (a.total_fastags || 0) + children.reduce((sum, c) => sum + (c.total_fastags_with_children || 0), 0);
      const assigned_fastags_with_children =
        (a.assigned_fastags || 0) + children.reduce((sum, c) => sum + (c.assigned_fastags_with_children || 0), 0);
      const sold_fastags_with_children =
        (a.sold_fastags || 0) + children.reduce((sum, c) => sum + (c.sold_fastags_with_children || 0), 0);
      return {
        ...a,
        children,
        total_fastags_with_children,
        assigned_fastags_with_children,
        sold_fastags_with_children,
      };
    });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  try {
    // Ensure sales snapshot table exists for consistent counts
    try {
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
    } catch {}

    // Fetch agent and all descendants using a recursive CTE
    const [agentRows]: any[] = await pool.query(`
      WITH RECURSIVE agent_tree AS (
        SELECT id, name, role, parent_user_id, phone, pincode, status
        FROM users
        WHERE id = ?
        UNION ALL
        SELECT u.id, u.name, u.role, u.parent_user_id, u.phone, u.pincode, u.status
        FROM users u
        INNER JOIN agent_tree at ON u.parent_user_id = at.id
      )
      SELECT at.*,
        (SELECT COUNT(*) FROM fastags f WHERE f.assigned_to_agent_id = at.id AND f.status = 'assigned') as assigned_fastags,
        (
          (SELECT COUNT(*) FROM fastag_sales s WHERE s.sold_by_user_id = at.id OR s.sold_by_agent_id = at.id)
          +
          (SELECT COUNT(*) FROM fastags f2 WHERE f2.status='sold' AND f2.sold_by_user_id = at.id)
        ) as sold_fastags
      FROM agent_tree at
      ORDER BY at.parent_user_id, at.id
    `, [agentId]);

    if (!agentRows.length) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    // Build the hierarchy
    const rootId = agentRows[0].id;
    // Recompute total_fastags as assigned + sold to reflect handled history
    const computed = agentRows.map((r: any) => ({
      ...r,
      total_fastags: Number(r.assigned_fastags || 0) + Number(r.sold_fastags || 0),
    }));
    const tree = buildAgentTreeAndSums(computed, null);
    const root = tree.find(a => String(a.id) === String(rootId));

    return NextResponse.json({
      agent_tree: tree,
      root_agent: root,
    });
  } catch (err) {
    console.error("Hierarchy API error", err);
    return NextResponse.json({ error: "Failed to fetch hierarchy" }, { status: 500 });
  }
}
