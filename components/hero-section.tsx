import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden gradient-hero py-16 md:py-24">
      <div className="container relative z-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-8 items-center">
          <div className="flex flex-col space-y-6 text-center md:text-left">
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-primary text-sm font-medium mb-2">
              India's Trusted FASTag Provider
            </div>
            <h1 className="font-poppins text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              FASTag Solutions <span className="text-gradient-royal">For All Vehicles</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-[600px] mx-auto md:mx-0">
              Register, recharge, and resolve FASTag issues with doorstep delivery across India.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link href="/register">
                <Button size="lg" className="font-medium bg-primary hover:bg-blue-800 shadow-primary">
                  Register Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/services">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-medium border-2 border-primary/20 hover:border-primary/40"
                >
                  Explore Services
                </Button>
              </Link>
            </div>
            <div className="flex items-center justify-center md:justify-start space-x-2 text-sm">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-8 w-8 rounded-full border-2 border-background ${
                      i === 1 ? "bg-blue-900" : i === 2 ? "bg-blue-800" : i === 3 ? "bg-blue-700" : "bg-primary"
                    }`}
                  />
                ))}
              </div>
              <p className="text-muted-foreground">
                <span className="font-medium">1000+</span> satisfied customers
              </p>
            </div>
          </div>
          <div className="relative mx-auto md:mr-0 w-full max-w-md">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-transparent z-10 rounded-xl"></div>
              <Image
                src="/placeholder.svg?key=t2aj6"
                alt="FASTag on highway"
                width={800}
                height={600}
                className="object-cover"
                priority
              />
            </div>
            <div className="absolute -bottom-6 -left-6 rounded-lg bg-primary p-4 shadow-primary text-white">
              <div className="flex items-center space-x-2">
                <div className="rounded-full bg-white/20 p-1">
                  <div className="rounded-full bg-white h-2 w-2" />
                </div>
                <div className="text-sm font-medium">All India Delivery</div>
              </div>
            </div>
            <div className="absolute -top-6 -right-6 rounded-lg bg-secondary p-4 shadow-secondary text-white">
              <div className="flex items-center space-x-2">
                <div className="rounded-full bg-white/20 p-1">
                  <div className="rounded-full bg-white h-2 w-2" />
                </div>
                <div className="text-sm font-medium">All Bank Options</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Soft background elements */}
      <div className="absolute top-1/4 left-0 w-64 h-64 bg-blue-800 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
      <div className="absolute top-1/3 right-0 w-72 h-72 bg-blue-700 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>

      <div className="absolute inset-0 -z-10 overflow-hidden">
        <svg
          className="absolute left-[max(50%,25rem)] top-0 h-[64rem] w-[128rem] -translate-x-1/2 stroke-blue-200 [mask-image:radial-gradient(64rem_64rem_at_top,white,transparent)]"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="e813992c-7d03-4cc4-a2bd-151760b470a0"
              width={200}
              height={200}
              x="50%"
              y={-1}
              patternUnits="userSpaceOnUse"
            >
              <path d="M100 200V.5M.5 .5H200" fill="none" />
            </pattern>
          </defs>
          <svg x="50%" y={-1} className="overflow-visible fill-blue-50">
            <path
              d="M-100.5 0h201v201h-201Z M699.5 0h201v201h-201Z M499.5 400h201v201h-201Z M-300.5 600h201v201h-201Z"
              strokeWidth={0}
            />
          </svg>
          <rect width="100%" height="100%" strokeWidth={0} fill="url(#e813992c-7d03-4cc4-a2bd-151760b470a0)" />
        </svg>
      </div>
    </section>
  )
}
