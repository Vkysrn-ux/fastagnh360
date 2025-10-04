"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UsersAutocomplete, { type UserOption } from "@/components/UsersAutocomplete";
import { formatERPDate } from "@/lib/date-format";

type TicketRow = {
  id: number;
  ticket_no?: string;
  customer_name?: string;
  phone?: string;
  vehicle_reg_no?: string;
  status?: string;
  created_at?: string;
  assigned_to?: string | number | null;
  paid_via?: string;
  lead_received_from?: string;
};

export default function TicketsReportPage() {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [paidVia, setPaidVia] = useState("all");
  const [assigned, setAssigned] = useState<UserOption | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/tickets?scope=all');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e.message || 'Failed to load'); setRows([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const fromD = from ? new Date(from) : null;
    const toD = to ? new Date(to) : null;
    const query = q.trim().toLowerCase();
    return rows.filter((t) => {
      // date
      let okDate = true;
      if (fromD || toD) {
        const d = t.created_at ? new Date(String(t.created_at)) : null;
        okDate = !!d;
        if (okDate && fromD && d! >= fromD) okDate = true; else if (fromD) okDate = okDate && d! >= fromD;
        if (okDate && toD && d! <= toD) okDate = true; else if (toD) okDate = okDate && d! <= toD;
      }
      // status (treat 'completed' as 'closed')
      const rawStatus = String(t.status || '').toLowerCase();
      const normalized = rawStatus === 'completed' ? 'closed' : rawStatus;
      const okStatus = status === 'all' || normalized === status.toLowerCase();
      // paid via
      const okPaid = paidVia === 'all' || (String((t as any).paid_via || '').toLowerCase() === paidVia.toLowerCase());
      // assigned
      const okAssigned = !assigned || String(t.assigned_to ?? '') === String(assigned.id);
      // query
      const okQ = query === '' || [t.ticket_no, t.customer_name, t.phone, t.vehicle_reg_no]
        .some(v => String(v || '').toLowerCase().includes(query));
      return okDate && okStatus && okPaid && okAssigned && okQ;
    });
  }, [rows, from, to, status, paidVia, assigned?.id, q]);

  const totals = useMemo(() => ({
    count: filtered.length,
    open: filtered.filter(t=> String(t.status||'').toLowerCase()==='open').length,
    closed: filtered.filter(t=> {
      const s = String(t.status||'').toLowerCase();
      return s==='closed' || s==='completed';
    }).length,
  }), [filtered]);

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Tickets Report</h1>
        <Link href="/admin/reports" className="text-sm px-3 py-2 border rounded hover:bg-gray-50">← Back to Reports</Link>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">From</label>
            <Input type="date" value={from} onChange={(e)=> setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">To</label>
            <Input type="date" value={to} onChange={(e)=> setTo(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <select className="w-full border rounded px-2 py-2" value={status} onChange={(e)=> setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Paid via</label>
            <select className="w-full border rounded px-2 py-2" value={paidVia} onChange={(e)=> setPaidVia(e.target.value)}>
              <option value="all">All</option>
              <option>Pending</option>
              <option>Paytm QR</option>
              <option>GPay Box</option>
              <option>IDFC Box</option>
              <option>Cash</option>
              <option>Sriram Gpay</option>
              <option>Lakshman Gpay</option>
              <option>Arjunan Gpay</option>
              <option>Vishnu GPay</option>
              <option>Vimal GPay</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Assigned To</label>
            <UsersAutocomplete value={assigned} onSelect={setAssigned} placeholder="Type user" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Search</label>
            <Input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Ticket no, name, phone, VRN" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardHeader><CardTitle className="text-base">Total</CardTitle></CardHeader><CardContent>{totals.count}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Open</CardTitle></CardHeader><CardContent>{totals.open}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Closed</CardTitle></CardHeader><CardContent>{totals.closed}</CardContent></Card>
      </div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Ticket</th>
              <th className="text-left p-2">Customer</th>
              <th className="text-left p-2">VRN</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Paid via</th>
              <th className="text-left p-2">Assigned</th>
              <th className="text-left p-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-2">{t.created_at ? formatERPDate(t.created_at as any) : '-'}</td>
                <td className="p-2">{t.ticket_no || t.id}</td>
                <td className="p-2">{t.customer_name || '-'}</td>
                <td className="p-2">{t.vehicle_reg_no || '-'}</td>
                <td className="p-2">{(String(t.status||'').toLowerCase()==='completed') ? 'closed' : (t.status || '-')}</td>
                <td className="p-2">{(t as any).paid_via || '-'}</td>
                <td className="p-2">{(t as any).assigned_to_name || (t.assigned_to ? `#${t.assigned_to}` : '-') }</td>
                <td className="p-2">{t.lead_received_from || '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No results</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
