import type React from "react"
import type { Metadata } from "next"
import { EmployeeHeader } from "@/components/employee/employee-header"

export const metadata: Metadata = {
  title: "NH360fastag - Employee Portal",
  description: "Manage your FASTag operations as an employee",
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <EmployeeHeader />
      <div className="flex-1">{children}</div>
    </div>
  )
}
