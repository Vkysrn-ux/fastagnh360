import { Mail, Phone, MapPin } from "lucide-react"

export function ContactCTA() {
  return (
    <section className="py-8 md:py-12">
      <div className="container">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-poppins text-lg font-semibold mb-2">Call Us</h3>
              <div className="space-y-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href="tel:+918667460935" className="hover:text-primary">+91 - 8667460935</a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href="tel:+918667460635" className="hover:text-primary">+91 - 8667460635</a>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-poppins text-lg font-semibold mb-2">Email</h3>
              <div className="space-y-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-secondary" />
                  <a href="mailto:info@nh360fastag.com" className="hover:text-secondary">info@nh360fastag.com</a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-secondary" />
                  <a href="mailto:support@nh360fastagsolutions.com" className="hover:text-secondary">support@nh360fastagsolutions.com</a>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-poppins text-lg font-semibold mb-2">Address</h3>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 text-accent mt-1" />
                <p>
                  2nd Floor, Isha Towers, 222/4, New Scheme Rd, near KVB Bank, Pappanaickenpalayam, Coimbatore, Tamil Nadu 641037
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

