import type React from "react"
import type { Metadata } from "next"
import { AdminHeader } from "@/components/admin/admin-header"
import Heartbeat from "@/components/Heartbeat"
import AdminChatPortal from "@/components/chat/AdminChatPortal"

export const metadata: Metadata = {
  title: "NH360fastag - Admin Portal",
  description: "Manage your FASTag business operations",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader />
      {/* Track admin presence and usage time */}
      <Heartbeat />
      {/* Online users chat, only on tickets routes */}
      <AdminChatPortal />
      <div className="flex-1">{children}</div>
    </div>
  )
}
