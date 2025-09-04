import type React from "react"
import type { Metadata } from "next"
import { AdminHeader } from "@/components/admin/admin-header"

export const metadata: Metadata = {
  title: "NH360fastag - Admin Portal",
  description: "Manage your FASTag business operations",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader />
      <div className="flex-1">{children}</div>
    </div>
  )
}
