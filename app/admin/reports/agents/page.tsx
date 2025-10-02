"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatERPDate } from "@/lib/date-format";

type Row = {
  agent_id: number;
  agent_name: string;
  agent_role: string;
  parent_id?: number | null;
  parent_name?: string;
  parent_role?: string;
  assigned_count: number;
  sold_count: number;
  first_assigned_at?: string | null;
  last_assigned_at?: string | null;
  suppliers?: any;
};

export default function AgentsReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true); setError(null);
    try {
      const params: string[] = [];
      if (name.trim()) params.push(`q=${encodeURIComponent(name.trim())}`);
      if (from) params.push(`from=${from}`);
      if (to) params.push(`to=${to}`);
      const qs = params.length ? `?${params.join('&')}` : '';
      const res = await fetch(`/api/reports/agents/summary${qs}`);
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
      acc.assigned += Number(r.assigned_count || 0);
      acc.sold += Number(r.sold_count || 0);
      return acc;
    }, { assigned: 0, sold: 0 });
  }, [rows]);

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Agents Overview</h1>
        <Link href="/admin/reports" className="text-sm px-3 py-2 border rounded hover:bg-gray-50">← Back to Reports</Link>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Name contains</label>
            <Input value={name} onChange={(e)=> setName(e.target.value)} placeholder="Agent/Shop name" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Assigned From</label>
            <Input type="date" value={from} onChange={(e)=> setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Assigned To</label>
            <Input type="date" value={to} onChange={(e)=> setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button className="px-4 py-2 border rounded" onClick={fetchData} disabled={loading}>Filter</button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardHeader><CardTitle className="text-base">Total Assigned</CardTitle></CardHeader><CardContent>{totals.assigned}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Total Sold</CardTitle></CardHeader><CardContent>{totals.sold}</CardContent></Card>
      </div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Agent</th>
              <th className="text-left p-2">Role</th>
              <th className="text-left p-2">Parent</th>
              <th className="text-right p-2">Assigned</th>
              <th className="text-right p-2">Sold</th>
              <th className="text-left p-2">First Assigned</th>
              <th className="text-left p-2">Last Assigned</th>
              <th className="text-left p-2">Suppliers (available)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              let supp = '-';
              try {
                const obj = typeof r.suppliers === 'string' ? JSON.parse(r.suppliers as any) : r.suppliers;
                if (obj && typeof obj === 'object') {
                  supp = Object.entries(obj).map(([k,v]) => `${k}: ${v}`).join(', ');
                }
              } catch {}
              return (
                <tr key={r.agent_id} className="border-t">
                  <td className="p-2">{r.agent_name}</td>
                  <td className="p-2">{r.agent_role}</td>
                  <td className="p-2">{r.parent_name ? `${r.parent_name} (${r.parent_role})` : '-'}</td>
                  <td className="p-2 text-right">{r.assigned_count}</td>
                  <td className="p-2 text-right">{r.sold_count}</td>
                  <td className="p-2">{formatERPDate(r.first_assigned_at as any)}</td>
                  <td className="p-2">{formatERPDate(r.last_assigned_at as any)}</td>
                  <td className="p-2">{supp}</td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No results</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
