"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getBanksCached } from "@/lib/client/cache";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UsersAutocomplete, { type UserOption } from "@/components/UsersAutocomplete";
import { formatERPDate } from "@/lib/date-format";

type Row = { date: string; bank_name: string; fastag_class: string; supplier_name: string; added: number; assigned: number; sold: number };

export default function InventoryFlowReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bank, setBank] = useState("");
  const [fclass, setFclass] = useState("");
  const [supplier, setSupplier] = useState("");
  const [agent, setAgent] = useState<UserOption | null>(null);
  const [bankOptions, setBankOptions] = useState<string[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<{ id: number; name: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true); setError(null);
    try {
      const params: string[] = [];
      if (from) params.push(`from=${from}`);
      if (to) params.push(`to=${to}`);
      if (bank.trim()) params.push(`bank=${encodeURIComponent(bank.trim())}`);
      if (fclass.trim()) params.push(`class=${encodeURIComponent(fclass.trim())}`);
      if (supplier.trim()) {
        const su = supplierOptions.find(s=> s.name.toLowerCase() === supplier.trim().toLowerCase());
        const val = su ? String(su.id) : supplier.trim();
        params.push(`supplier=${encodeURIComponent(val)}`);
      }
      if (agent?.id) params.push(`agent=${encodeURIComponent(String(agent.id))}`);
      const qs = params.length ? `?${params.join('&')}` : '';
      const res = await fetch(`/api/reports/inventory/rollup${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e: any) { setError(e.message || 'Failed to load'); setRows([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    getBanksCached().then(setBankOptions).catch(() => setBankOptions([]));
    fetch('/api/fastags/classes').then(r=>r.json()).then(d => setClassOptions(Array.isArray(d)?d:[])).catch(()=>setClassOptions([]));
    fetch('/api/suppliers/all').then(r=>r.json()).then(d => setSupplierOptions(Array.isArray(d)?d:[])).catch(()=>setSupplierOptions([]));
  }, []);

  const totals = useMemo(() => rows.reduce((a,r)=>({ added:a.added+r.added, assigned:a.assigned+r.assigned, sold:a.sold+r.sold }), {added:0,assigned:0,sold:0}), [rows]);

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Inventory Flow</h1>
        <div className="flex items-center gap-2">
          <button className="text-sm px-3 py-2 border rounded hover:bg-gray-50" onClick={() => {
            const header = ['Date','Bank','Class','Supplier','Added','Assigned','Sold'];
            const lines = [header.join(',')].concat(rows.map(r => [formatERPDate(r.date), r.bank_name||'', r.fastag_class||'', r.supplier_name||'', r.added, r.assigned, r.sold].join(',')));
            const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `inventory-flow.csv`; a.click(); URL.revokeObjectURL(url);
          }}>Export CSV</button>
          <button className="text-sm px-3 py-2 border rounded hover:bg-gray-50" onClick={() => {
            const table = document.querySelector('#inv-flow-table')?.outerHTML || '';
            const w = window.open('', '_blank'); if (!w) return;
            w.document.write(`<html><head><title>Inventory Flow</title></head><body>${table}</body></html>`);
            w.document.close(); w.focus(); w.print();
          }}>Export PDF</button>
          <Link href="/admin/reports" className="text-sm px-3 py-2 border rounded hover:bg-gray-50">← Back to Reports</Link>
        </div>
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
            <label className="block text-xs text-muted-foreground mb-1">Bank</label>
            <input list="banks-list" className="w-full border rounded px-2 py-2" value={bank} onChange={(e)=> setBank(e.target.value)} placeholder="Type bank" />
            <datalist id="banks-list">{bankOptions.map(b => (<option key={b} value={b} />))}</datalist>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Class</label>
            <input list="classes-list" className="w-full border rounded px-2 py-2" value={fclass} onChange={(e)=> setFclass(e.target.value)} placeholder="Type class e.g., class4" />
            <datalist id="classes-list">{classOptions.map(c => (<option key={c} value={c} />))}</datalist>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Supplier</label>
            <input list="suppliers-list" className="w-full border rounded px-2 py-2" value={supplier} onChange={(e)=> setSupplier(e.target.value)} placeholder="Type supplier name or id" />
            <datalist id="suppliers-list">{supplierOptions.map(s => (<option key={s.id} value={s.name}>{s.id}</option>))}</datalist>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Agent/User</label>
            <UsersAutocomplete value={agent} onSelect={setAgent} placeholder="Type agent/shop name" />
          </div>
          <div className="flex items-end">
            <button className="px-4 py-2 border rounded" onClick={fetchData} disabled={loading}>Filter</button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardHeader><CardTitle className="text-base">Added</CardTitle></CardHeader><CardContent>{totals.added}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Assigned</CardTitle></CardHeader><CardContent>{totals.assigned}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Sold</CardTitle></CardHeader><CardContent>{totals.sold}</CardContent></Card>
      </div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm" id="inv-flow-table">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Bank</th>
              <th className="text-left p-2">Class</th>
              <th className="text-left p-2">Supplier</th>
              <th className="text-right p-2">Added</th>
              <th className="text-right p-2">Assigned</th>
              <th className="text-right p-2">Sold</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.date + '|' + idx} className="border-t">
                <td className="p-2">{formatERPDate(r.date)}</td>
                <td className="p-2">{r.bank_name || '-'}</td>
                <td className="p-2">{r.fastag_class || '-'}</td>
                <td className="p-2">{r.supplier_name || '-'}</td>
                <td className="p-2 text-right">{r.added}</td>
                <td className="p-2 text-right">{r.assigned}</td>
                <td className="p-2 text-right">{r.sold}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No results</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
