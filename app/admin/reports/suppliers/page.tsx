"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = {
  supplier_id: number;
  supplier_name: string;
  purchased_count: number;
  sold_count: number;
  available_count: number;
  total_purchase_cost: number;
  credit_items: number;
  paid_items: number;
  first_purchase_date?: string | null;
  last_purchase_date?: string | null;
};

export default function SupplierReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [name, setName] = useState("");
  const [paid, setPaid] = useState<'all'|'paid'|'credit'>('all');
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function fetchData() {
    setLoading(true); setError(null);
    try {
      const params: string[] = [];
      if (name.trim()) params.push(`name=${encodeURIComponent(name.trim())}`);
      if (paid !== 'all') params.push(`paid=${paid}`);
      if (from) params.push(`from=${from}`);
      if (to) params.push(`to=${to}`);
      const qs = params.length ? `?${params.join('&')}` : '';
      const res = await fetch(`/api/reports/suppliers/summary${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
      setRows([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => {
      acc.purchased += Number(r.purchased_count || 0);
      acc.sold += Number(r.sold_count || 0);
      acc.available += Number(r.available_count || 0);
      acc.cost += Number(r.total_purchase_cost || 0);
      return acc;
    }, { purchased: 0, sold: 0, available: 0, cost: 0 });
  }, [rows]);

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Supplier Reports</h1>
        <div className="flex items-center gap-2">
          <button className="text-sm px-3 py-2 border rounded hover:bg-gray-50" onClick={() => {
            const header = ['Supplier','Purchased','Sold','Available','Paid','Credit','Total Cost','First Purchase','Last Purchase'];
            const lines = [header.join(',')].concat(rows.map(r => [r.supplier_name, r.purchased_count, r.sold_count, r.available_count, r.paid_items, r.credit_items, r.total_purchase_cost, r.first_purchase_date||'', r.last_purchase_date||''].join(',')));
            const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `supplier-report.csv`; a.click(); URL.revokeObjectURL(url);
          }}>Export CSV</button>
          <button className="text-sm px-3 py-2 border rounded hover:bg-gray-50" onClick={() => { const t=document.querySelector('#suppliers-table')?.outerHTML||''; const w=window.open('', '_blank'); if(!w) return; w.document.write(`<html><head><title>Suppliers Report</title></head><body>${t}</body></html>`); w.document.close(); w.focus(); w.print(); }}>Export PDF</button>
          <Link href="/admin/reports" className="text-sm px-3 py-2 border rounded hover:bg-gray-50">← Back to Reports</Link>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Supplier name</label>
            <Input value={name} onChange={(e)=> setName(e.target.value)} placeholder="Search supplier" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Paid/Credit</label>
            <select className="w-full border rounded px-2 py-2" value={paid} onChange={(e)=> setPaid(e.target.value as any)}>
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">From</label>
            <Input type="date" value={from} onChange={(e)=> setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">To</label>
            <Input type="date" value={to} onChange={(e)=> setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button className="px-4 py-2 border rounded" onClick={fetchData} disabled={loading}>Filter</button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardHeader><CardTitle className="text-base">Total Purchased</CardTitle></CardHeader><CardContent>{totals.purchased}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Total Sold</CardTitle></CardHeader><CardContent>{totals.sold}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Total Available</CardTitle></CardHeader><CardContent>{totals.available}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Purchase Cost</CardTitle></CardHeader><CardContent>₹ {totals.cost.toFixed(2)}</CardContent></Card>
      </div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm" id="suppliers-table">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Supplier</th>
              <th className="text-right p-2">Purchased</th>
              <th className="text-right p-2">Sold</th>
              <th className="text-right p-2">Available</th>
              <th className="text-right p-2">Paid</th>
              <th className="text-right p-2">Credit</th>
              <th className="text-right p-2">Total Cost</th>
              <th className="text-left p-2">First Purchase</th>
              <th className="text-left p-2">Last Purchase</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.supplier_id} className="border-t">
                <td className="p-2">{r.supplier_name}</td>
                <td className="p-2 text-right">{r.purchased_count}</td>
                <td className="p-2 text-right">{r.sold_count}</td>
                <td className="p-2 text-right">{r.available_count}</td>
                <td className="p-2 text-right">{r.paid_items}</td>
                <td className="p-2 text-right">{r.credit_items}</td>
                <td className="p-2 text-right">₹ {Number(r.total_purchase_cost || 0).toFixed(2)}</td>
                <td className="p-2">{r.first_purchase_date ? new Date(r.first_purchase_date as any).toLocaleDateString() : '-'}</td>
                <td className="p-2">{r.last_purchase_date ? new Date(r.last_purchase_date as any).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">No results</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
