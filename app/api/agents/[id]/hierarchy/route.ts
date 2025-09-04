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
  context: { params: { id: string } }
) {
  const agentId = context.params.id;
  try {
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
        (SELECT COUNT(*) FROM fastags f WHERE f.assigned_to = at.id) as total_fastags,
        (SELECT COUNT(*) FROM fastags f WHERE f.assigned_to = at.id AND f.status = 'assigned') as assigned_fastags,
        (SELECT COUNT(*) FROM fastags f WHERE f.assigned_to = at.id AND f.status = 'sold') as sold_fastags
      FROM agent_tree at
      ORDER BY at.parent_user_id, at.id
    `, [agentId]);

    if (!agentRows.length) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    // Build the hierarchy
    const rootId = agentRows[0].id;
    const tree = buildAgentTreeAndSums(agentRows, null);
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
