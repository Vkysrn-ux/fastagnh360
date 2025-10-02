"use client";
import Link from "next/link";

export default function MoneyFlowReport() {
  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Money Flow</h1>
        <Link href="/admin/reports" className="text-sm px-3 py-2 border rounded hover:bg-gray-50">← Back to Reports</Link>
      </div>
      <p className="text-sm text-muted-foreground">Coming soon: ledger summary by period, collect vs payout vs commission.</p>
    </div>
  );
}
