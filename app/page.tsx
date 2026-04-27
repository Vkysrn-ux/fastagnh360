export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <div className="font-manrope bg-white text-slate-900 antialiased">

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40 bg-gradient-to-b from-blue-50/50 to-white">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="space-y-6">
            <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 text-xs font-extrabold uppercase tracking-widest rounded-full">
              Efficiency in Transit
            </span>
            <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-tight">
              Seamless FASTAG <br />
              <span className="text-brand-blue">Sales &amp; Services</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-lg leading-relaxed">
              Experience the next generation of highway transit with NH360. Professional issuance and management at your fingertips.
            </p>
            <div className="flex items-center pt-4">
              <a href="/register">
                <button className="flex items-center space-x-3 px-8 py-4 bg-brand-darkBlue text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95">
                  <span>Get FASTAG Now</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path clipRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" fillRule="evenodd" />
                  </svg>
                </button>
              </a>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative">
            <div className="rounded-3xl overflow-hidden shadow-2xl transform hover:rotate-1 transition-transform duration-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Bus on Highway"
                className="w-full h-auto object-cover aspect-[4/3] scale-125"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMH76ZjXHcybj3XnVe62_60pHEI1XZoGKUULLRiNlAlYEgUDVGSoN7dzcaEDBV0Tth626KSLg_AP8jS2lrXV5K2AHJTqIgEteuKjP19etRJrXLIJwQ4x7oxmmjGNTK20xAhyGYzdD7sbp44dQ_tla4EQ5wHdGbGx0Aw7M57HMyPXvjSnSdtnTgTgFDfEnnCC0rbq26iIgd0hOdQEHFDDKsdWi0fkMjGQEreCFOMUZmnjVcs9CQ186XqYA3t9GLIemZ1vO4HRs6nj4b"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-blue-600/10 rounded-full blur-2xl" />
          </div>
        </div>
      </section>

      {/* Our Services */}
      <section className="py-24 bg-slate-50/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-2">Our Services</h2>
            <div className="w-20 h-1.5 bg-brand-blue rounded-full" />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Service Card 1 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 transition-transform duration-200 hover:scale-[1.02]">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-brand-blue">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">New FASTAG Issuance</h3>
              <p className="text-slate-500 leading-relaxed">
                Instant issuance for private and commercial vehicles with minimal documentation.
              </p>
            </div>

            {/* Service Card 2 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 transition-transform duration-200 hover:scale-[1.02]">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-brand-blue">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Recharge Services</h3>
              <p className="text-slate-500 leading-relaxed">
                Quick and secure top-ups with all major payment gateways supported 24/7.
              </p>
            </div>

            {/* Service Card 3 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 transition-transform duration-200 hover:scale-[1.02]">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-brand-blue">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Account Management</h3>
              <p className="text-slate-500 leading-relaxed">
                Track transactions, view history, and manage multiple tags under one dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Support Banner */}
      <section className="py-20 bg-brand-darkBlue text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <circle cx="90" cy="10" fill="white" r="20" />
            <circle cx="10" cy="90" fill="white" r="30" />
          </svg>
        </div>
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl font-extrabold mb-6">Expert Support &amp; Assistance</h2>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Facing issues with your FASTAG? Our dedicated support team is here to help you resolve technical or payment queries instantly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <a href="/contact">
              <button className="w-full sm:w-auto flex items-center justify-center space-x-2 px-10 py-4 bg-white text-brand-darkBlue font-bold rounded-xl hover:bg-blue-50 transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                <span>Contact Support</span>
              </button>
            </a>
            <a href="/faq">
              <button className="w-full sm:w-auto px-10 py-4 border-2 border-white/30 text-white font-bold rounded-xl hover:bg-white/10 transition-colors">
                FAQ Center
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* Partner Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-start">
            {/* Left Content */}
            <div className="space-y-8">
              <div>
                <span className="text-brand-blue font-bold tracking-widest text-xs uppercase">Growth Opportunity</span>
                <h2 className="text-5xl font-extrabold text-slate-900 mt-2 mb-6">Partner with Us</h2>
                <p className="text-slate-600 text-lg leading-relaxed mb-8">
                  Become a certified NH360 FASTAG dealer and unlock a steady stream of income. We provide the infrastructure, technology, and support you need to succeed.
                </p>
                <ul className="space-y-4">
                  {["Low investment, high returns", "Instant technical onboarding", "Marketing and POS collateral provided"].map((item) => (
                    <li key={item} className="flex items-center space-x-3 text-slate-700 font-semibold">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
                        </svg>
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Handshake Image */}
              <div className="relative rounded-3xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Partnership Handshake"
                  className="w-full h-auto"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZ9oNDezTObW670oguGCFnSP5aM7oy5oPH28xeIDCl-FNG2o5Z4ahfFHqifRdNFoeRxyaytEB0eakZdkzXSkOSn3oxmBQ0rDZzwJ_7CBVYdN7xQd3SUNu0HVxvBXQk9-zR939cYsv1MYbEfHHxbHOKhg-GPmVCNLV5f8ORMsp2BuBPhJ9dsa4faZzFx8jYnXSeRusiQ2mCb5U93i6WaeKeVG6RzorCbJbpl_9neHRJ-GhUvxIUGw9viPiqrodk3GXsnKJ0le0KO5l_"
                />
                <div className="absolute inset-0 bg-black/40 flex items-end p-8">
                  <div className="bg-white/20 backdrop-blur-md p-6 rounded-2xl border border-white/30 text-white w-full">
                    <p className="text-2xl font-bold">Over 500+ Dealers Nationwide</p>
                    <p className="text-sm opacity-80">Join India&apos;s fastest growing logistics network.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content: Enquiry Form */}
            <div className="bg-white border border-slate-100 shadow-2xl rounded-[2.5rem] p-10 lg:p-12">
              <h3 className="text-3xl font-extrabold text-slate-900 text-center mb-8">Dealer Enquiry</h3>
              <form className="space-y-6" action="/api/dealer-enquiry" method="POST">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                  <input
                    className="w-full px-5 py-4 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-brand-blue focus:bg-white transition-all text-slate-700"
                    placeholder="John Doe"
                    type="text"
                    name="fullName"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Phone Number</label>
                  <input
                    className="w-full px-5 py-4 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-brand-blue focus:bg-white transition-all text-slate-700"
                    placeholder="+91 98765 43210"
                    type="tel"
                    name="phone"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Location / City</label>
                  <input
                    className="w-full px-5 py-4 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-brand-blue focus:bg-white transition-all text-slate-700"
                    placeholder="Mumbai, Maharashtra"
                    type="text"
                    name="location"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Business Background (Optional)</label>
                  <textarea
                    className="w-full px-5 py-4 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-brand-blue focus:bg-white transition-all text-slate-700"
                    placeholder="Tell us about your current business..."
                    rows={4}
                    name="background"
                  />
                </div>
                <button
                  className="w-full py-5 bg-brand-darkBlue text-white font-bold rounded-xl text-lg hover:shadow-xl hover:shadow-blue-900/20 active:scale-95 transition-all"
                  type="submit"
                >
                  Submit Enquiry
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
