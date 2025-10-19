"use client";
import React from "react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Totals = {
  amount_received: number;
  commission_paid: number;
  lead_commission_paid: number;
  from?: string | null;
  to?: string | null;
  error?: string;
};

function formatINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);
  } catch {
    // Fallback
    return `₹${(n || 0).toFixed(2)}`;
  }
}

export default function MoneyFlowReport() {
  const [totals, setTotals] = React.useState<Totals | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [breakdown, setBreakdown] = React.useState<any>(null);
  const [suppliers, setSuppliers] = React.useState<Array<{ id: number; name: string }>>([]);
  const [banks, setBanks] = React.useState<string[]>([]);
  const [classes, setClasses] = React.useState<string[]>([]);
  const [supplierId, setSupplierId] = React.useState<string>("");
  const [bank, setBank] = React.useState<string>("");
  const [klass, setKlass] = React.useState<string>("");
  const [payment, setPayment] = React.useState<string>('all');
  const [rows, setRows] = React.useState<any[]>([]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (supplierId) qs.set('supplier', supplierId);
        if (bank) qs.set('bank', bank);
        if (klass) qs.set('class', klass);
        const q = qs.toString();
        const [resA, resB, resC] = await Promise.all([
          fetch(`/api/reports/money-flow${q ? `?${q}` : ''}`, { cache: "no-store" }),
          fetch(`/api/reports/money-flow/breakdown${q ? `?${q}` : ''}`, { cache: "no-store" }),
          fetch(`/api/reports/money-flow/list${q ? `?${q}&` : '?'}payment=${encodeURIComponent(payment)}`, { cache: 'no-store' }),
        ]);
        const [dataA, dataB, dataC] = await Promise.all([resA.json(), resB.json(), resC.json()]);
        if (!resA.ok || dataA?.error) throw new Error(dataA?.error || "Failed to load totals");
        if (!resB.ok || dataB?.error) throw new Error(dataB?.error || "Failed to load breakdown");
        if (!resC.ok || dataC?.error) throw new Error(dataC?.error || "Failed to load list");
        if (alive) {
          setTotals(dataA);
          setBreakdown(dataB?.periods || null);
          setRows(Array.isArray(dataC) ? dataC : []);
        }
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load totals");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [supplierId, bank, klass, payment]);

  // Load filter options
  React.useEffect(() => {
    let alive = true;
    fetch('/api/suppliers/all', { cache: 'no-store' })
      .then(r => r.json())
      .then(rows => { if (alive) setSuppliers((Array.isArray(rows) ? rows : []).map((r: any) => ({ id: r.id, name: r.name })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    if (supplierId) qs.set('supplier', supplierId);
    fetch(`/api/fastags/distinct/banks${qs.toString() ? `?${qs.toString()}` : ''}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(list => { if (alive) setBanks(Array.isArray(list) ? list : []); })
      .catch(() => setBanks([]));
    fetch(`/api/fastags/distinct/classes${qs.toString() ? `?${qs.toString()}` : ''}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(list => { if (alive) setClasses(Array.isArray(list) ? list : []); })
      .catch(() => setClasses([]));
    // reset dependent selections if supplier changes
    setBank("");
    setKlass("");
    return () => { alive = false; };
  }, [supplierId]);

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Money Flow</h1>
        <Link href="/admin/reports" className="text-sm px-3 py-2 border rounded hover:bg-gray-50">Back to Reports</Link>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div>
            <div className="text-xs text-gray-500 mb-1">Supplier</div>
            <Select value={supplierId || 'all'} onValueChange={(v) => setSupplierId(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Bank</div>
            <Select value={bank || 'all'} onValueChange={(v) => setBank(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {banks.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Class</div>
            <Select value={klass || 'all'} onValueChange={(v) => setKlass(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {classes.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Payment</div>
            <Select value={payment} onValueChange={(v) => setPayment(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="nil">Nil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-primary">Loading totals…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : totals ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500 mb-1">Amount Received</div>
            <div className="text-xl font-semibold">{formatINR(totals.amount_received)}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500 mb-1">Commission Paid</div>
            <div className="text-xl font-semibold">{formatINR(totals.commission_paid)}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500 mb-1">Lead Commission Paid</div>
            <div className="text-xl font-semibold">{formatINR(totals.lead_commission_paid)}</div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500">No totals available.</div>
      )}

      {/* Breakdown by period */}
      {breakdown && (
        <div className="mt-6 space-y-4">
          {(["today","week","month"] as const).map((key) => {
            const p = breakdown[key];
            if (!p) return null;
            return (
              <div key={key}>
                <div className="mb-3">
                  <div className="text-sm text-gray-500">
                    {key === "today" ? "Today" : key === "week" ? "This Week" : "This Month"}
                    {p.from && p.to && (
                      <span className="ml-2 text-xs text-gray-400">({p.from} → {p.to})</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="rounded border p-3">
                    <div className="text-xs text-gray-500 mb-1">Total Received</div>
                    <div className="text-xl font-semibold">{formatINR(p.total_received || 0)}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-gray-500 mb-1">New FASTag Received</div>
                    <div className="text-xl font-semibold">{formatINR(p.new_fastag_received || 0)}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-gray-500 mb-1">Hotlisted Received</div>
                    <div className="text-xl font-semibold">{formatINR(p.hotlisted_received || 0)}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-gray-500 mb-1">Replacement Received</div>
                    <div className="text-xl font-semibold">{formatINR(p.replacement_received || 0)}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-gray-500 mb-1">Tags Sold</div>
                    <div className="text-xl font-semibold">{Number(p.sold_count || 0)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed list */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">Detailed Transactions (per tag)</h2>
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Ticket</th>
                <th className="p-2 text-left">Tag Serial</th>
                <th className="p-2 text-left">Bank</th>
                <th className="p-2 text-left">Class</th>
                <th className="p-2 text-left">Supplier</th>
                <th className="p-2 text-left">Whose Ticket</th>
                <th className="p-2 text-left">Bank Login</th>
                <th className="p-2 text-right">Collect</th>
                <th className="p-2 text-right">Payout</th>
                <th className="p-2 text-right">Net</th>
                <th className="p-2 text-right">Commission</th>
                <th className="p-2 text-right">Lead Comm.</th>
                <th className="p-2 text-right">Pickup Comm.</th>
                <th className="p-2 text-left">Paid Via</th>
                <th className="p-2 text-left">Payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td className="p-3 text-gray-500" colSpan={16}>No data</td></tr>
              ) : rows.map((r) => (
                <tr key={`${r.id}`} className="border-t">
                  <td className="p-1.5 whitespace-nowrap">{r.created_at?.slice(0,19).replace('T',' ') || '-'}</td>
                  <td className="p-1.5 whitespace-nowrap">{r.ticket_no || `#${r.id}`}</td>
                  <td className="p-1.5 whitespace-nowrap">{r.fastag_serial || '-'}</td>
                  <td className="p-1.5 whitespace-nowrap">{r.bank_name || '-'}</td>
                  <td className="p-1.5 whitespace-nowrap">{r.fastag_class || '-'}</td>
                  <td className="p-1.5 whitespace-nowrap">{r.supplier_name || (r.supplier_id ? `#${r.supplier_id}` : '-')}</td>
                  <td className="p-1.5 whitespace-nowrap">{r.assigned_to_name || (r.assigned_to ? `#${r.assigned_to}` : '-')}</td>
                  <td className="p-1.5 whitespace-nowrap">{r.bank_login_user_name || '-'}</td>
                  <td className="p-1.5 text-right">{formatINR(Number(r.payment_to_collect||0))}</td>
                  <td className="p-1.5 text-right">{formatINR(Number(r.payment_to_send||0))}</td>
                  <td className="p-1.5 text-right">{formatINR(Number(r.net_value||0))}</td>
                  <td className="p-1.5 text-right">{formatINR(Number(r.commission_amount||0))}</td>
                  <td className="p-1.5 text-right">{formatINR(Number(r.lead_commission||0))}</td>
                  <td className="p-1.5 text-right">{formatINR(Number(r.pickup_commission||0))}</td>
                  <td className="p-1.5 whitespace-nowrap">{r.paid_via || '-'}</td>
                  <td className="p-1.5 whitespace-nowrap">{r.payment_nil ? 'Nil' : (r.payment_received ? 'Received' : 'Pending')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
