import type React from "react"
import type { Metadata } from "next"
import { UserHeader } from "@/components/user/user-header"

export const metadata: Metadata = {
  title: "NH360fastag - User Portal",
  description: "Manage your FASTag account and transactions",
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <UserHeader />
      <div className="flex-1">{children}</div>
    </div>
  )
}
