import { redirect } from "next/navigation"
export const dynamic = 'force-dynamic'
import { ContactCTA } from "@/components/contact-cta"

export default function Home() {
  if (process.env.ERP_ONLY === 'true') {
    redirect('/login')
  }
  return (
    <div className="flex flex-col">
      <div className="container mt-10 text-center">
        <h1 className="font-poppins text-4xl font-bold">NH360 Fastag Solutions</h1>
        <p className="text-muted-foreground mt-3">Buy FASTag online @ nh360fastag.com</p>
      </div>
      <ContactCTA />
    </div>
  )
}
