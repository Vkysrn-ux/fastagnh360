import Link from "next/link"

export function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-4">
            <div className="text-xl font-bold text-blue-900 font-manrope">NH360 FASTAG</div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs font-manrope">
              Kinetic Anchor Management's premier solution for streamlined highway experiences across India.
            </p>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-manrope">Company</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-slate-500 text-sm hover:text-blue-600 hover:underline decoration-blue-500 underline-offset-4 transition-all font-manrope">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="#" className="text-slate-500 text-sm hover:text-blue-600 hover:underline decoration-blue-500 underline-offset-4 transition-all font-manrope">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="#" className="text-slate-500 text-sm hover:text-blue-600 hover:underline decoration-blue-500 underline-offset-4 transition-all font-manrope">
                  Partner Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-manrope">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy-policy" className="text-slate-500 text-sm hover:text-blue-600 hover:underline decoration-blue-500 underline-offset-4 transition-all font-manrope">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="text-slate-500 text-sm hover:text-blue-600 hover:underline decoration-blue-500 underline-offset-4 transition-all font-manrope">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="#" className="text-slate-500 text-sm hover:text-blue-600 hover:underline decoration-blue-500 underline-offset-4 transition-all font-manrope">
                  Compliance
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-manrope">Support</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/contact" className="text-blue-700 text-sm font-semibold hover:underline underline-offset-4 font-manrope">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-slate-500 text-sm hover:text-blue-600 hover:underline decoration-blue-500 underline-offset-4 transition-all font-manrope">
                  FAQ Center
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-slate-200 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-slate-400 text-xs gap-4 font-manrope">
          <p>© {new Date().getFullYear()} NH360 FASTAG Solutions. Kinetic Anchor Management.</p>
          <p>Kinetic Anchor movement.</p>
        </div>
      </div>
    </footer>
  )
}
