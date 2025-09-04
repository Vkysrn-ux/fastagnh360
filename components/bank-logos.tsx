import Image from "next/image"

export function BankLogos() {
  const banks = [
    { name: "HDFC Bank", logo: "/partners/hdfc.png" },
    { name: "ICICI Bank", logo: "/partners/icici.png" },
    { name: "SBI", logo: "/sbi-bank-logo.png" },
    { name: "Axis Bank", logo: "/axis-bank-logo.png" },
    { name: "Paytm Payments Bank", logo: "/paytm-payments-bank-logo.png" },
    { name: "Kotak Mahindra Bank", logo: "/kotak-mahindra-bank-logo.png" },
  ]

  return (
    <div className="flex flex-wrap justify-center gap-8 md:gap-12">
      {banks.map((bank) => (
        <div key={bank.name} className="flex items-center justify-center">
          <Image
            src={bank.logo || "/placeholder.svg"}
            alt={`${bank.name} logo`}
            width={120}
            height={60}
            className="h-12 w-auto grayscale hover:grayscale-0 transition-all"
          />
        </div>
      ))}
    </div>
  )
}
