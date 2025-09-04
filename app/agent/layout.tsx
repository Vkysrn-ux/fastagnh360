import type React from "react"
import type { Metadata } from "next"
import { AgentHeader } from "@/components/agent/agent-header"

export const metadata: Metadata = {
  title: "NH360fastag - Agent Portal",
  description: "Manage your FASTag inventory and sales as an authorized agent",
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AgentHeader />
      <div className="flex-1">{children}</div>
    </div>
  )
}
