"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReportCard = {
  title: string;
  href: string;
  desc?: string;
};

const CARDS: ReportCard[] = [
  {
    title: "Inventory Overview",
    href: "/admin/fastags",
    desc: "Dashboard and grouped view of FASTag inventory (status, bank, class, batch).",
  },
  {
    title: "Inventory Flow",
    href: "/admin/reports/inventory-flow",
    desc: "Track assignments, transfers and sold timeline by day/month.",
  },
  {
    title: "Agents Overview",
    href: "/admin/reports/agents",
    desc: "Per-agent assigned, sold, first/last assignment and suppliers.",
  },
  {
    title: "Money Flow",
    href: "/admin/reports/money-flow",
    desc: "Collected vs payout vs commissions across tickets and sales.",
  },
  {
    title: "Suppliers",
    href: "/admin/reports/suppliers",
    desc: "Supplier report with purchased, sold, available, paid/credit and date filters.",
  },
  {
    title: "Tickets",
    href: "/admin/reports/tickets",
    desc: "Ticket report with date/status/paid-via and assigned filters.",
  },
];

export default function ReportsHome() {
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Link key={c.title} href={c.href} className="block">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>{c.title}</CardTitle>
              </CardHeader>
              {c.desc && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{c.desc}</p>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
