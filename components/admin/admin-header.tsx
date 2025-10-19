"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { LogOut, Menu, Package, Users, Settings, CreditCard, UserCircle, UserCog, BarChart3, X, Ticket } from "lucide-react"
import { useState, useEffect } from "react"
// use client-side API calls instead of server actions

export function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [userName, setUserName] = useState<string>("")

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        const data = await res.json();
        const session = data?.session;
        const isAdmin = !!session && session.userType === 'admin';
        setIsAuthenticated(isAdmin);
        const display = String(session?.displayRole || '').toLowerCase();
        // Track Super Admin
        setIsSuperAdmin(isAdmin && display === 'super admin');
        setUserName(String(session?.name || session?.username || "").trim());
        if (!isAdmin) router.push('/admin/login');
      } catch {
        router.push('/admin/login');
      }
    };
    checkSession();
  }, [router])


  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    router.push("/login")
  }

  // Skip rendering the header on the login page
  if (pathname === "/admin/login") {
    return null
  }

  // // If not authenticated and not on login page, redirect to login
  // if (!isAuthenticated && typeof window !== "undefined") {
  //   router.push("/admin/login")
  //   return null
  // }

  // Build menus based on role rules:
  // - Super Admin: all menus
  // - Admin: only Fastags, Agents, Suppliers, Tickets (+Dashboard retained for navigation)
  const commonItems = [
    { href: "/admin/fastags", label: "FASTags", icon: <CreditCard className="mr-2 h-4 w-4" /> },
    { href: "/admin/agents", label: "Agents", icon: <UserCircle className="mr-2 h-4 w-4" /> },
    { href: "/admin/suppliers", label: "Suppliers", icon: <Users className="mr-2 h-4 w-4" /> },
    { href: "/admin/tickets", label: "Tickets", icon : <Ticket className="mr-2 h-4 w-4" /> },
  ] as const;

  const superExtra = [
    { href: "/admin/users", label: "Users", icon: <UserCog className="mr-2 h-4 w-4" /> },
    { href: "/admin/reports", label: "Reports", icon: <BarChart3 className="mr-2 h-4 w-4" /> },
    // Future: settings/commissions can be added back here
  ] as const;

  const dashboardItem = { href: "/admin/dashboard", label: "Dashboard", icon: <BarChart3 className="mr-2 h-4 w-4" /> } as const;
  const navItems = isSuperAdmin ? [dashboardItem, ...commonItems, ...superExtra] : [...commonItems]

  const logoHref = isSuperAdmin ? "/admin/dashboard" : "/admin/fastags";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={logoHref} className="flex items-center space-x-2">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
              NH
            </div>
            <span className="hidden font-poppins text-xl font-bold sm:inline-block">
              Admin <span className="text-gradient-royal">Portal</span>
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
          {userName && (
            <div className="text-sm text-muted-foreground">
              {userName}
            </div>
          )}
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
            {userName && (
              <div className="text-sm text-muted-foreground px-1">
                Signed in as {userName}
              </div>
            )}
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

