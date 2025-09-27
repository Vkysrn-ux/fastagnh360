"use server"

import type { AgentStats } from "../types"
import { pool } from "@/lib/db"
import { getAgentSession } from "@/lib/actions/auth-actions"

export async function getAgentStats(): Promise<AgentStats> {
  const session = await getAgentSession()
  const userId = Number(session?.id)
  if (!userId) {
    return { totalInventory: 0, availableFastags: 0, soldFastags: 0, totalCustomers: 0, monthlySales: 0 }
  }

  try {
    const [[inv]]: any = await pool.query(
      "SELECT COUNT(*) AS cnt FROM fastags WHERE assigned_to_agent_id = ? AND status = 'assigned'",
      [userId]
    )
    const totalInventory = Number(inv?.cnt || 0)

    const [[s1]]: any = await pool.query(
      "SELECT COUNT(*) AS cnt FROM fastag_sales WHERE sold_by_user_id = ? OR sold_by_agent_id = ?",
      [userId, userId]
    )
    let soldFastags = Number(s1?.cnt || 0)
    if (!soldFastags) {
      const [[s2]]: any = await pool.query(
        "SELECT COUNT(*) AS cnt FROM fastags WHERE status='sold' AND sold_by_user_id = ?",
        [userId]
      )
      soldFastags = Number(s2?.cnt || 0)
    }

    let totalCustomers = 0
    try {
      const [[c]]: any = await pool.query(
        "SELECT COUNT(DISTINCT phone) AS cnt FROM tickets_nh WHERE assigned_to = ?",
        [userId]
      )
      totalCustomers = Number(c?.cnt || 0)
    } catch {}

    let monthlySales = 0
    try {
      const [[m]]: any = await pool.query(
        `SELECT COALESCE(SUM(net_value), 0) AS amt
         FROM fastag_sales
         WHERE (sold_by_user_id = ? OR sold_by_agent_id = ?)
           AND MONTH(created_at) = MONTH(CURRENT_DATE())
           AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
        [userId, userId]
      )
      monthlySales = Number(m?.amt || 0)
    } catch {}

    return {
      totalInventory,
      availableFastags: totalInventory,
      soldFastags,
      totalCustomers,
      monthlySales,
    }
  } catch (e) {
    return { totalInventory: 0, availableFastags: 0, soldFastags: 0, totalCustomers: 0, monthlySales: 0 }
  }
}
