import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function FAQSection() {
  const faqs = [
    {
      question: "What is a FASTag?",
      answer:
        "FASTag is an electronic toll collection system in India, operated by the National Highway Authority of India (NHAI). It employs Radio Frequency Identification (RFID) technology for making toll payments directly from the prepaid or savings account linked to it.",
    },
    {
      question: "How long does it take to receive a FASTag after ordering?",
      answer:
        "Once you complete the registration and payment process, your FASTag will typically be delivered within 2-5 business days, depending on your location. We offer expedited delivery options for urgent requirements.",
    },
    {
      question: "Which banks' FASTags do you provide?",
      answer:
        "We offer FASTags from all major banks in India, including HDFC, ICICI, SBI, Axis Bank, Paytm Payments Bank, and many more. You can choose the bank as per your preference during registration.",
    },
    {
      question: "How can I recharge my FASTag?",
      answer:
        "You can recharge your FASTag through our website, mobile app, or by visiting our office. We accept various payment methods including credit/debit cards, net banking, UPI, and digital wallets.",
    },
    {
      question: "What documents are required for FASTag registration?",
      answer:
        "For FASTag registration, you need to provide your vehicle's Registration Certificate (RC), a valid ID proof (Aadhar/PAN/Driving License), address proof, and a passport-sized photograph of the vehicle owner.",
    },
    {
      question: "How do you resolve blacklisted FASTag issues?",
      answer:
        "We have a specialized team that handles blacklisted FASTag issues. The resolution process typically involves identifying the cause of blacklisting, coordinating with the relevant authorities, and completing the necessary documentation to reinstate your FASTag.",
    },
  ]

  return (
    <section className="py-12 md:py-20 gradient-feature">
      <div className="container">
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-primary text-sm font-medium mb-4">
            Got Questions?
          </div>
          <h2 className="font-poppins text-3xl font-bold tracking-tight md:text-4xl mb-4">
            Frequently Asked <span className="text-gradient-royal">Questions</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
            Find answers to common questions about our FASTag services
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-primary/5 bg-white rounded-lg mb-4 overflow-hidden"
              >
                <AccordionTrigger className="text-left font-medium px-6 hover:bg-primary/5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground px-6 pb-4">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
