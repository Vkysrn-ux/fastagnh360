import type React from "react"
import type { Metadata } from "next"
import { Inter, Poppins, Manrope } from "next/font/google"
import { headers } from "next/headers"
import "./globals.css"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { ThemeProvider } from "@/components/theme-provider"
import { GoogleAnalytics } from "@/components/google-analytics"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
})

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
})

export const metadata: Metadata = {
  title: "NH360fastag.com - FASTag Services Across India",
  description:
    "Register for FASTag for all vehicles, all bank FASTag available, nationwide delivery, recharge services, and blacklist resolution.",
    generator: 'v0.dev',
    manifest: '/manifest.webmanifest',
  icons: {
      icon: '/logo.png',
      apple: '/logo.png',
    },
}

export const viewport = {
  themeColor: '#0b5cc2',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const ERP_ONLY = process.env.ERP_ONLY === 'true'
  const pathname = (await headers()).get('x-pathname') ?? ''
  const isErpRoute = ['/admin', '/agent', '/employee', '/user'].some(p => pathname.startsWith(p))
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} ${manrope.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="royal" enableSystem disableTransitionOnChange>
          <GoogleAnalytics />
          <SonnerToaster richColors position="top-right" />
          <div className="flex min-h-screen flex-col">
            {!ERP_ONLY && !isErpRoute && <Navbar />}
            <main className="flex-1">{children}</main>
            {!ERP_ONLY && !isErpRoute && <Footer />}
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
