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
        const { getAuthSessionCached } = await import('@/lib/client/cache');
        const data = await getAuthSessionCached();
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
  // - Super Admin: all menus (ensure "Reports" appears before long-tail items)
  // - Admin: only Fastags, Agents, Suppliers, Tickets (+Dashboard retained for navigation)
  const fastagsItem   = { href: "/admin/fastags", label: "FASTags", icon: <CreditCard className="h-4 w-4 xl:mr-2" /> } as const;
  const agentsItem    = { href: "/admin/agents", label: "Agents", icon: <UserCircle className="h-4 w-4 xl:mr-2" /> } as const;
  const suppliersItem = { href: "/admin/suppliers", label: "Suppliers", icon: <Users className="h-4 w-4 xl:mr-2" /> } as const;
  const ordersItem    = { href: "/admin/orders", label: "Orders", icon: <Package className="h-4 w-4 xl:mr-2" /> } as const;
  const ticketsItem   = { href: "/admin/tickets", label: "Tickets", icon: <Ticket className="h-4 w-4 xl:mr-2" /> } as const;
  const ecomItem      = { href: "/admin/ecom-updates", label: "Ecom Updates", icon: <BarChart3 className="h-4 w-4 xl:mr-2" /> } as const;

  const usersItem     = { href: "/admin/users", label: "Users", icon: <UserCog className="h-4 w-4 xl:mr-2" /> } as const;
  const reportsItem   = { href: "/admin/reports", label: "Reports", icon: <BarChart3 className="h-4 w-4 xl:mr-2" /> } as const;

  const commonItems = [fastagsItem, agentsItem, suppliersItem, ordersItem, ticketsItem, ecomItem] as const;
  const dashboardItem = { href: "/admin/dashboard", label: "Dashboard", icon: <BarChart3 className="h-4 w-4 xl:mr-2" /> } as const;

  // Order for Super Admin keeps Reports visible without scrolling
  const navItems = isSuperAdmin
    ? [dashboardItem, fastagsItem, agentsItem, suppliersItem, ordersItem, ticketsItem, reportsItem, ecomItem, usersItem]
    : [...commonItems]

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

        {/* Desktop Navigation: tighter gaps, no scrolling */}
        <nav className="hidden md:flex items-center gap-3 lg:gap-4 xl:gap-6 flex-nowrap flex-1 min-w-0 mx-4 overflow-hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center font-medium text-sm transition-colors hover:text-primary whitespace-nowrap ${
                pathname === item.href ? "text-primary" : ""
              }`}
            >
              {item.icon}
              <span className="hidden xl:inline">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex md:items-center md:gap-3 shrink-0">
          {userName && (
            <div className="hidden xl:block text-sm text-muted-foreground">
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
            <LogOut className="h-4 w-4 xl:mr-2" />
            <span className="hidden xl:inline">Logout</span>
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

