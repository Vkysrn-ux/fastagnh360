import Link from "next/link";
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from "lucide-react";


export default function PrivacyPolicyPage() {
  return <PrivacyPolicy />;
}


export function Footer() {
  return (
    <footer className="bg-gradient-to-b from-background to-blue-50/50 dark:from-background dark:to-blue-950/20 border-t">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand/About */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                NH
              </div>
              <span className="font-poppins text-xl font-bold">
                NH360
                <span className="text-gradient-royal">fastag</span>
              </span>
            </div>
            <p className="text-muted-foreground mb-4">
              Your trusted partner for all FASTag services across India. We provide registration, recharge, and
              blacklist resolution services.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://facebook.com"
                className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Facebook className="h-5 w-5" />
                <span className="sr-only">Facebook</span>
              </a>
              <a
                href="https://instagram.com"
                className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="h-5 w-5" />
                <span className="sr-only">Instagram</span>
              </a>
              <a
                href="https://twitter.com"
                className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </a>
            </div>
          </div>
          {/* Quick Links */}
          <div>
            <h3 className="font-poppins text-lg font-semibold mb-4 text-gradient-royal">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-muted-foreground hover:text-primary transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-muted-foreground hover:text-primary transition-colors">
                  FAQs
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy <span className="text-xs text-gray-400">(Coming Soon)</span>
                </Link>
              </li>
            </ul>
          </div>
          {/* Services */}
          <div>
            <h3 className="font-poppins text-lg font-semibold mb-4 text-gradient-royal-light">Services</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/services/new-fastag"
                  className="text-muted-foreground hover:text-secondary transition-colors"
                >
                  New FASTag Registration
                </Link>
              </li>
              <li>
                <Link
                  href="/services/recharge"
                  className="text-muted-foreground hover:text-secondary transition-colors"
                >
                  FASTag Recharge
                </Link>
              </li>
              <li>
                <Link
                  href="/services/blacklist"
                  className="text-muted-foreground hover:text-secondary transition-colors"
                >
                  Blacklist Resolution
                </Link>
              </li>
              <li>
                <Link href="/services/banks" className="text-muted-foreground hover:text-secondary transition-colors">
                  Bank Options
                </Link>
              </li>
              <li>
                <Link href="/track-order" className="text-muted-foreground hover:text-secondary transition-colors">
                  Track Your Order
                </Link>
              </li>
            </ul>
          </div>
          {/* Contact */}
          <div>
            <h3 className="font-poppins text-lg font-semibold mb-4 text-gradient-royal-light">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <div className="h-6 w-6 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 mt-0.5 mr-2">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <span className="text-muted-foreground">
                  Coimbatore
                  <br />
                  <a
                    href="https://maps.app.goo.gl/unSFYUEtQPazo6RJ9"
                    className="text-xs text-blue-700 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Google Maps
                  </a>
                </span>
              </li>
              <li className="flex items-center">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mr-2">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <a href="tel:+918667460635" className="text-muted-foreground hover:text-primary transition-colors">
                  +91 86674 60635
                </a>
              </li>
              <li className="flex items-center">
                <div className="h-6 w-6 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0 mr-2">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <a
                  href="mailto:info@nh360fastag.com"
                  className="text-muted-foreground hover:text-secondary transition-colors"
                >
                  info@nh360fastag.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t pt-6">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} NH360fastag.com. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
