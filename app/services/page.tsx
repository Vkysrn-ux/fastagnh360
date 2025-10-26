import Link from "next/link"

export default function ServicesPage() {
  return (
    <div className="container py-12">
      <h1 className="font-poppins text-3xl font-bold mb-6">Our Services</h1>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li><Link className="underline" href="/services/new-fastag">New FASTag Registration</Link></li>
        <li><Link className="underline" href="/services/recharge">FASTag Recharge</Link></li>
        <li><Link className="underline" href="/services/blacklist">Blacklist Resolution</Link></li>
        <li><Link className="underline" href="/services/banks">Bank Options</Link></li>
      </ul>
    </div>
  )
}

