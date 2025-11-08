import type React from "react"
import type { Metadata } from "next"
import { EmployeeHeader } from "@/components/employee/employee-header"
import Heartbeat from "@/components/Heartbeat"

export const metadata: Metadata = {
  title: "NH360fastag - Employee Portal",
  description: "Manage your FASTag operations as an employee",
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <EmployeeHeader />
      {/* Track employee presence */}
      <Heartbeat />
      <div className="flex-1">{children}</div>
    </div>
  )
}
