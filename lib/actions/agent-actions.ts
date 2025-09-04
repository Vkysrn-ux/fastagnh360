"use server"

import type { AgentStats } from "../types"

export async function getAgentStats(): Promise<AgentStats> {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Return mock data
  return {
    totalInventory: 250,
    availableFastags: 187,
    totalCustomers: 63,
    monthlySales: 126000,
  }
}
