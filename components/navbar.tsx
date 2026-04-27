"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-[0_8px_32px_rgba(15,58,159,0.08)]">
      <div className="flex justify-between items-center max-w-7xl mx-auto px-6 h-20">
        {/* Brand Logo */}
        <Link href="/" className="text-2xl font-black text-blue-900 tracking-tighter font-manrope">
          NH360 FASTAG
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link href="/" className="text-blue-800 font-bold border-b-2 border-blue-800 pb-1 font-manrope">Home</Link>
          <Link href="/services" className="text-slate-600 font-medium hover:text-blue-700 transition-colors font-manrope">Services</Link>
          <Link href="/services/recharge" className="text-slate-600 font-medium hover:text-blue-700 transition-colors font-manrope">Recharge</Link>
          <Link href="/contact" className="text-slate-600 font-medium hover:text-blue-700 transition-colors font-manrope">Support</Link>
          <Link href="/about" className="text-slate-600 font-medium hover:text-blue-700 transition-colors font-manrope">About</Link>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center space-x-4">
          <Link href="/login">
            <button className="px-5 py-2 text-blue-700 font-bold hover:bg-blue-50/50 rounded-lg transition-all active:scale-95 font-manrope">
              Login
            </button>
          </Link>
          <Link href="/register">
            <button className="px-6 py-2 bg-blue-700 text-white font-bold rounded-lg hover:bg-blue-800 transition-all active:scale-95 font-manrope">
              Apply Now
            </button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="flex md:hidden items-center justify-center rounded-md p-2 text-slate-700"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden px-6 pb-4 border-t border-slate-100 bg-white">
          <nav className="flex flex-col space-y-3 pt-4">
            <Link href="/" className="text-blue-800 font-bold font-manrope" onClick={() => setIsMenuOpen(false)}>Home</Link>
            <Link href="/services" className="text-slate-600 font-medium font-manrope" onClick={() => setIsMenuOpen(false)}>Services</Link>
            <Link href="/services/recharge" className="text-slate-600 font-medium font-manrope" onClick={() => setIsMenuOpen(false)}>Recharge</Link>
            <Link href="/contact" className="text-slate-600 font-medium font-manrope" onClick={() => setIsMenuOpen(false)}>Support</Link>
            <Link href="/about" className="text-slate-600 font-medium font-manrope" onClick={() => setIsMenuOpen(false)}>About</Link>
            <div className="flex gap-3 pt-2">
              <Link href="/login" className="flex-1" onClick={() => setIsMenuOpen(false)}>
                <button className="w-full px-5 py-2 text-blue-700 font-bold border border-blue-200 rounded-lg font-manrope">Login</button>
              </Link>
              <Link href="/register" className="flex-1" onClick={() => setIsMenuOpen(false)}>
                <button className="w-full px-5 py-2 bg-blue-700 text-white font-bold rounded-lg font-manrope">Apply Now</button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
