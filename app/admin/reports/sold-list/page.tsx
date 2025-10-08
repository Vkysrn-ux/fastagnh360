"use client";

import { useEffect, useMemo, useState } from "react";
import UsersAutocomplete, { type UserOption } from "@/components/UsersAutocomplete";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type SoldRow = {
  tag_serial: string;
  sold_at: string;
  seller_id: number | null;
  seller_name: string;
  bank_name?: string;
  fastag_class?: string;
  supplier_id?: number | null;
  supplier_name?: string;
  vehicle_reg_no?: string | null;
  ticket_id?: number | null;
};

export default function SoldListReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [seller, setSeller] = useState<UserOption | null>(null);
  const [bank, setBank] = useState("");
  const [klass, setKlass] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SoldRow[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/suppliers/all')
      .then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : []))
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const params: string[] = [];
        if (from) params.push(`from=${encodeURIComponent(from)}`);
        if (to) params.push(`to=${encodeURIComponent(to)}`);
        if (seller?.id) params.push(`seller=${encodeURIComponent(seller.id)}`);
        if (bank.trim()) params.push(`bank=${encodeURIComponent(bank.trim())}`);
        if (klass.trim()) params.push(`class=${encodeURIComponent(klass.trim())}`);
        if (supplierId) params.push(`supplier=${encodeURIComponent(supplierId)}`);
        if (q.trim()) params.push(`q=${encodeURIComponent(q.trim())}`);
        params.push(`limit=2000`);
        const qs = params.length ? `?${params.join('&')}` : '';
        const res = await fetch(`/api/fastags/sales/list${qs}`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data as SoldRow[] : []);
      } catch (e: any) {
        setError(e.message || 'Failed to load data');
      } finally { setLoading(false); }
    }
    load();
  }, [from, to, seller?.id, bank, klass, supplierId, q]);

  const csv = useMemo(() => {
    const header = ["Sold At","Barcode","Bank","Class","Seller","Vehicle","Ticket Id"]; 
    const lines = rows.map(r => [
      r.sold_at || '', r.tag_serial || '', r.bank_name || '', r.fastag_class || '', r.seller_name || `User #${r.seller_id ?? ''}`, r.vehicle_reg_no || '', r.ticket_id ?? ''
    ].map(v => String(v).replaceAll('"','""')));
    const out = [header.map(h => `"${h}"`).join(','), ...lines.map(cols => cols.map(c => `"${c}"`).join(','))].join("\n");
    return out;
  }, [rows]);

  function downloadCsv() {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sold_fastags_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container py-10">
      <Card>
        <CardHeader>
          <CardTitle>Sold FASTags</CardTitle>
          <CardDescription>List of sold FASTags with barcode and seller. Filter by date, seller, bank or class.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">From</label>
              <Input type="date" value={from} onChange={e=> setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">To</label>
              <Input type="date" value={to} onChange={e=> setTo(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Seller</label>
              <UsersAutocomplete value={seller} onSelect={setSeller} placeholder="Agent/ASM/User" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Bank</label>
              <Input value={bank} onChange={e=> setBank(e.target.value)} placeholder="e.g., ICICI" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Class</label>
              <Input value={klass} onChange={e=> setKlass(e.target.value)} placeholder="e.g., class4" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Supplier</label>
              <select className="w-full border rounded p-2" value={supplierId} onChange={(e)=> setSupplierId(e.target.value)}>
                <option value="">All</option>
                {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-muted-foreground mb-1">Search Barcode</label>
              <Input value={q} onChange={e=> setQ(e.target.value)} placeholder="Full or partial barcode" />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={downloadCsv} disabled={rows.length===0}>Download CSV</Button>
            </div>
          </div>

          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
          {loading ? (
            <div className="text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sold FASTags found for the selected filters.</div>
          ) : (
            <div className="overflow-x-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sold At</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Ticket</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={r.tag_serial + '-' + (r.sold_at || '') + '-' + i}>
                      <TableCell>{r.sold_at ? new Date(r.sold_at).toLocaleString() : '-'}</TableCell>
                      <TableCell>{r.tag_serial}</TableCell>
                      <TableCell>{r.bank_name || '-'}</TableCell>
                      <TableCell>{r.supplier_name || (r.supplier_id ? `#${r.supplier_id}` : '-')}</TableCell>
                      <TableCell>{r.fastag_class || '-'}</TableCell>
                      <TableCell>{r.seller_name || (r.seller_id ? `User #${r.seller_id}` : '-')}</TableCell>
                      <TableCell>{r.vehicle_reg_no || '-'}</TableCell>
                      <TableCell>{r.ticket_id ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
