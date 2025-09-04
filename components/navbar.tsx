"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X, ChevronDown, UserCircle } from "lucide-react"
import { ThemeSwitcher } from "@/components/theme-switcher"

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
              NH
            </div>
            <span className="hidden font-poppins text-xl font-bold sm:inline-block">
              NH360
              <span className="text-gradient-royal">fastag</span>
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex md:gap-6 lg:gap-10">
          <Link href="/" className="font-medium transition-colors hover:text-primary">
            Home
          </Link>
          <div className="relative group">
            <button className="flex items-center gap-1 font-medium transition-colors hover:text-primary">
              Services <ChevronDown className="h-4 w-4" />
            </button>
            <div className="absolute left-0 top-full z-50 mt-2 hidden w-48 rounded-md border bg-background p-2 shadow-md group-hover:block">
              <Link href="/services/new-fastag" className="block rounded-sm px-3 py-2 text-sm hover:bg-primary/10">
                New FASTag Registration
              </Link>
              <Link href="/services/recharge" className="block rounded-sm px-3 py-2 text-sm hover:bg-primary/10">
                FASTag Recharge
              </Link>
              <Link href="/services/blacklist" className="block rounded-sm px-3 py-2 text-sm hover:bg-primary/10">
                Blacklist Resolution
              </Link>
              <Link href="/services/banks" className="block rounded-sm px-3 py-2 text-sm hover:bg-primary/10">
                Bank Options
              </Link>
            </div>
          </div>
          <Link href="/about" className="font-medium transition-colors hover:text-primary">
            About Us
          </Link>
          <Link href="/contact" className="font-medium transition-colors hover:text-primary">
            Contact
          </Link>
        </nav>

        <div className="hidden md:flex md:items-center md:gap-4">
          <ThemeSwitcher />
          <Link href="/login">
            <Button variant="outline" size="sm" className="border-2 border-primary/20 hover:border-primary/40">
              <UserCircle className="mr-2 h-4 w-4" />
              Login
            </Button>
          </Link>
          <Link href="/track-order">
            <Button variant="outline" size="sm" className="border-2 border-primary/20 hover:border-primary/40">
              Track Order
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-primary hover:bg-blue-800">
              Register Now
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeSwitcher />
          <button
            className="flex items-center justify-center rounded-md p-2"
            onClick={toggleMenu}
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
            <Link href="/" className="font-medium" onClick={toggleMenu}>
              Home
            </Link>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                Services <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="mt-2 space-y-2 pl-4">
                <Link href="/services/new-fastag" className="block text-sm" onClick={toggleMenu}>
                  New FASTag Registration
                </Link>
                <Link href="/services/recharge" className="block text-sm" onClick={toggleMenu}>
                  FASTag Recharge
                </Link>
                <Link href="/services/blacklist" className="block text-sm" onClick={toggleMenu}>
                  Blacklist Resolution
                </Link>
                <Link href="/services/banks" className="block text-sm" onClick={toggleMenu}>
                  Bank Options
                </Link>
              </div>
            </details>
            <Link href="/about" className="font-medium" onClick={toggleMenu}>
              About Us
            </Link>
            <Link href="/contact" className="font-medium" onClick={toggleMenu}>
              Contact
            </Link>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/login" onClick={toggleMenu}>
                <Button variant="outline" className="w-full border-2 border-primary/20 hover:border-primary/40">
                  <UserCircle className="mr-2 h-4 w-4" />
                  Login
                </Button>
              </Link>
              <Link href="/track-order" onClick={toggleMenu}>
                <Button variant="outline" className="w-full border-2 border-primary/20 hover:border-primary/40">
                  Track Order
                </Button>
              </Link>
              <Link href="/register" onClick={toggleMenu}>
                <Button className="w-full bg-primary hover:bg-blue-800">Register Now</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
