import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Truck, CreditCard, ShieldCheck, ArrowRight } from "lucide-react"
import { HeroSection } from "@/components/hero-section"
import { ServiceCard } from "@/components/service-card"
import { TestimonialCard } from "@/components/testimonial-card"
import { BankLogos } from "@/components/bank-logos"
import { FAQSection } from "@/components/faq-section"

export default function Home() {
  return (
    <div className="flex flex-col">
      <HeroSection />

      {/* Features Section */}
      <section className="py-12 md:py-20 gradient-feature">
        <div className="container">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-primary text-sm font-medium mb-4">
              Our Advantages
            </div>
            <h2 className="font-poppins text-3xl font-bold tracking-tight md:text-4xl mb-4">
              Why Choose <span className="text-gradient-royal">NH360fastag</span>?
            </h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              We provide comprehensive FASTag solutions for all your needs with nationwide coverage and exceptional
              service.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="gradient-card border-none shadow-primary hover:shadow-md hover:shadow-primary/20 transition-all">
              <CardHeader className="pb-2">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                </div>
                <CardTitle className="font-poppins">All Vehicle Types</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  FASTag solutions for all vehicle categories from two-wheelers to heavy commercial vehicles.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="gradient-card border-none shadow-secondary hover:shadow-md hover:shadow-secondary/20 transition-all">
              <CardHeader className="pb-2">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <Truck className="h-5 w-5 text-white" />
                  </div>
                </div>
                <CardTitle className="font-poppins">Pan-India Delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Fast and reliable delivery of FASTag devices to your doorstep anywhere in India.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="gradient-card border-none shadow-accent hover:shadow-md hover:shadow-accent/20 transition-all">
              <CardHeader className="pb-2">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                </div>
                <CardTitle className="font-poppins">Multiple Banks</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Choose from a wide range of bank-issued FASTags as per your preference and convenience.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="gradient-card border-none shadow-primary hover:shadow-md hover:shadow-primary/20 transition-all">
              <CardHeader className="pb-2">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </div>
                </div>
                <CardTitle className="font-poppins">Blacklist Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Specialized services to resolve blacklisted FASTag issues quickly and efficiently.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-12 md:py-20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-50 to-transparent"></div>
        <div className="container relative z-10">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-primary text-sm font-medium mb-4">
              What We Offer
            </div>
            <h2 className="font-poppins text-3xl font-bold tracking-tight md:text-4xl mb-4">
              Our <span className="text-gradient-royal">Services</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              Comprehensive FASTag solutions for all your highway travel needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ServiceCard
              title="New FASTag Registration"
              description="Register for a new FASTag for any vehicle type with quick processing and doorstep delivery."
              icon="CreditCard"
              link="/services/new-fastag"
              color="primary"
            />

            <ServiceCard
              title="FASTag Recharge"
              description="Instant online recharge services for your existing FASTag with secure payment options."
              icon="RefreshCw"
              link="/services/recharge"
              color="secondary"
            />

            <ServiceCard
              title="Blacklist Resolution"
              description="Specialized services to resolve blacklisted FASTag issues and get you back on the road."
              icon="ShieldAlert"
              link="/services/blacklist"
              color="accent"
            />
          </div>

          <div className="text-center mt-10">
            <Link href="/services">
              <Button variant="outline" className="group border-2 border-primary/20 hover:border-primary/40">
                View All Services
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Soft background elements */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-700 rounded-full mix-blend-multiply filter blur-3xl opacity-5"></div>
        <div className="absolute top-1/3 left-0 w-72 h-72 bg-blue-800 rounded-full mix-blend-multiply filter blur-3xl opacity-5"></div>
      </section>

      {/* Bank Partners */}
      <section className="py-12 md:py-16 gradient-feature">
        <div className="container">
          <div className="text-center mb-10">
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-primary text-sm font-medium mb-4">
              Trusted Partners
            </div>
            <h2 className="font-poppins text-3xl font-bold tracking-tight md:text-4xl mb-4">
              Our <span className="text-gradient-royal">Bank Partners</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              We offer FASTag from all major banks across India
            </p>
          </div>

          <BankLogos />

          <div className="text-center mt-10">
            <Link href="/services/banks">
              <Button className="bg-primary hover:bg-blue-800 shadow-primary">Explore Bank Options</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 md:py-20 gradient-testimonial">
        <div className="container">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-primary text-sm font-medium mb-4">
              Customer Stories
            </div>
            <h2 className="font-poppins text-3xl font-bold tracking-tight md:text-4xl mb-4">
              What Our <span className="text-gradient-royal">Customers Say</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              Hear from our satisfied customers across India
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard
              name="Rajesh Kumar"
              location="Delhi"
              quote="The FASTag was delivered within 2 days and the registration process was seamless. Excellent service!"
              rating={5}
              color="primary"
            />

            <TestimonialCard
              name="Priya Sharma"
              location="Mumbai"
              quote="Had issues with my blacklisted FASTag. NH360fastag resolved it within 24 hours. Highly recommended!"
              rating={5}
              color="secondary"
            />

            <TestimonialCard
              name="Anand Patel"
              location="Ahmedabad"
              quote="Very professional service. The recharge was instant and customer support was very helpful."
              rating={4}
              color="accent"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQSection />

      {/* CTA Section */}
      <section className="py-12 md:py-16 gradient-cta text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/pattern-dots.png')] opacity-5"></div>
        <div className="container relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left max-w-2xl">
              <h2 className="font-poppins text-3xl font-bold tracking-tight md:text-4xl mb-4">
                Ready to Get Your FASTag?
              </h2>
              <p className="text-white/90 text-lg">
                Register now for quick processing and doorstep delivery across India.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 shadow-md">
                  Register Now
                </Button>
              </Link>
              <Link href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent text-white border-white hover:bg-white/10"
                >
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
