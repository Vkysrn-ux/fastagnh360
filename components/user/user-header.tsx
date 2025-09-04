"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { LogOut, Menu, CreditCard, ReceiptText, User, Bell, X } from "lucide-react"
import { useState, useEffect } from "react"
import { logoutUser, getUserSession } from "@/lib/actions/auth-actions"

export function UserHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userName, setUserName] = useState("")

  useEffect(() => {
    const checkSession = async () => {
      const session = await getUserSession()
      setIsAuthenticated(!!session && session.userType === "user")
      if (session && session.userType === "user") {
        setUserName(session.name)
      }
    }
    checkSession()
  }, [])

  const handleLogout = async () => {
    await logoutUser()
    router.push("/login")
  }

  // Skip rendering the header on the login page
  if (pathname === "/login") {
    return null
  }

  // If not authenticated and not on login page, redirect to login
  if (!isAuthenticated && typeof window !== "undefined" && !pathname.includes("/login")) {
    router.push("/login")
    return null
  }

  const navItems = [
    { href: "/user/dashboard", label: "Dashboard", icon: <User className="mr-2 h-4 w-4" /> },
    { href: "/user/fastags", label: "My FASTags", icon: <CreditCard className="mr-2 h-4 w-4" /> },
    { href: "/user/transactions", label: "Transactions", icon: <ReceiptText className="mr-2 h-4 w-4" /> },
    { href: "/user/notifications", label: "Notifications", icon: <Bell className="mr-2 h-4 w-4" /> },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/user/dashboard" className="flex items-center space-x-2">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
              NH
            </div>
            <span className="hidden font-poppins text-xl font-bold sm:inline-block">
              NH360<span className="text-gradient-royal">fastag</span>
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex md:gap-6 lg:gap-10">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center font-medium transition-colors hover:text-primary ${
                pathname === item.href ? "text-primary" : ""
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex md:items-center md:gap-4">
          <ThemeSwitcher />
          <Button
            variant="outline"
            size="sm"
            className="border-2 border-primary/20 hover:border-primary/40"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeSwitcher />
          <button
            className="flex items-center justify-center rounded-md p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="container pb-4 md:hidden">
          <nav className="flex flex-col space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center font-medium ${pathname === item.href ? "text-primary" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <Button
              variant="outline"
              className="w-full mt-2 border-2 border-primary/20 hover:border-primary/40 justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </nav>
        </div>
      )}
    </header>
  )
}
