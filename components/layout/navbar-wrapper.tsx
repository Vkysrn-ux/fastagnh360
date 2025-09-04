"use client"

import { usePathname } from "next/navigation"
import { Navbar } from "@/components/layout/navbar"

export function NavbarWrapper() {
  const pathname = usePathname()

  const hideNavbarRoutes = [
    "/admin/dashboard",
    "/agent/dashboard",
    "/employee/dashboard",
  ]

  const shouldHideNavbar = hideNavbarRoutes.some(route =>
    pathname.startsWith(route)
  )

  if (shouldHideNavbar) return null

  return <Navbar />
}
