"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import UsersAutocomplete, { type UserOption } from "@/components/UsersAutocomplete";

type FastagRow = {
  id: number;
  tag_serial: string;
  bank_name?: string;
  fastag_class?: string;
  status?: string;
};

export default function BulkMarkSoldModal({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<UserOption | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [rows, setRows] = useState<FastagRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // filter mode
  const [filterMode, setFilterMode] = useState<'owner' | 'filter'>('owner');
  const [filterBank, setFilterBank] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [filterOwner, setFilterOwner] = useState<UserOption | null>(null);
  // dynamic selection rules
  type Rule = { id: string; owner: UserOption | null; bank: string; cls: string; supplierId: string; count: number };
  const [rules, setRules] = useState<Rule[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/fastags/bulk-mark-sold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_serials: input, sold_by_user_id: filterMode==='owner' && owner ? owner.id : (filterMode==='filter' && filterOwner ? filterOwner.id : null) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to mark sold');
      setOpen(false);
      setInput("");
      onSuccess?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitSelected() {
    const list = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);
    if (list.length === 0) { setError('Select at least one FASTag'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/fastags/bulk-mark-sold', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_serials: list, sold_by_user_id: filterMode==='owner' && owner ? owner.id : (filterMode==='filter' && filterOwner ? filterOwner.id : null) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to mark sold');
      setOpen(false); setInput(""); setOwner(null); setRows([]); setChecked({});
      onSuccess?.();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  useEffect(() => {
    if (!open) { setOwner(null); setRows([]); setChecked({}); setError(null); return; }
    // load suppliers list once when opening
    fetch('/api/suppliers/all').then(r=>r.json()).then(data => {
      if (Array.isArray(data)) setSuppliers(data);
    }).catch(()=>{});
  }, [open]);

  useEffect(() => {
    async function load() {
      setLoadingList(true); setError(null);
      try {
        let url = '/api/fastags?status=assigned';
        if (filterMode === 'owner') {
          if (!owner) { setRows([]); setChecked({}); setLoadingList(false); return; }
          url += `&owner=${owner.id}`;
        } else {
          const params: string[] = [];
          if (filterBank.trim()) params.push(`bank_like=${encodeURIComponent(filterBank.trim())}`);
          if (filterClass.trim()) params.push(`class_like=${encodeURIComponent(filterClass.trim())}`);
          if (supplierId) params.push(`supplier=${encodeURIComponent(supplierId)}`);
          if (filterOwner?.id) params.push(`owner=${encodeURIComponent(filterOwner.id)}`);
          if (params.length) url += `&${params.join('&')}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        const arr: FastagRow[] = Array.isArray(data) ? data : [];
        setRows(arr);
        const preset: Record<string, boolean> = {};
        arr.forEach((r) => { preset[r.tag_serial] = false; });
        setChecked(preset);
      } catch (e: any) {
        setError(e.message || 'Failed to load tags');
      } finally { setLoadingList(false); }
    }
    load();
  }, [owner?.id, filterMode, filterBank, filterClass, supplierId, filterOwner?.id]);

  async function applyRules() {
    setError(null);
    setSaving(true);
    try {
      // Keep a map of selected to avoid duplicates
      const selected = new Set<string>(Object.entries(checked).filter(([,v])=>v).map(([k])=>k));
      let aggregateRows: Record<string, FastagRow> = {};
      for (const r of rules) {
        let url = '/api/fastags?status=assigned';
        const params: string[] = [];
        if (r.owner?.id) params.push(`owner=${encodeURIComponent(r.owner.id)}`);
        if (r.bank.trim()) params.push(`bank_like=${encodeURIComponent(r.bank.trim())}`);
        if (r.cls.trim()) params.push(`class_like=${encodeURIComponent(r.cls.trim())}`);
        if (r.supplierId) params.push(`supplier=${encodeURIComponent(r.supplierId)}`);
        if (params.length) url += `&${params.join('&')}`;
        const res = await fetch(url);
        const data: FastagRow[] = await res.json();
        const list: FastagRow[] = Array.isArray(data) ? data : [];
        // Pick up to count not already selected
        let picked = 0;
        for (const row of list) {
          if (picked >= r.count) break;
          if (!selected.has(row.tag_serial)) {
            selected.add(row.tag_serial);
            aggregateRows[row.tag_serial] = row;
            picked++;
          }
        }
      }
      // Merge with existing rows
      const mergedList: FastagRow[] = [...rows];
      for (const key in aggregateRows) {
        if (!rows.find(x => x.tag_serial === key)) mergedList.push(aggregateRows[key]);
      }
      setRows(mergedList);
      const nextChecked: Record<string, boolean> = { ...checked };
      selected.forEach(serial => { nextChecked[serial] = true; });
      setChecked(nextChecked);
    } catch (e: any) {
      setError(e.message || 'Failed to apply rules');
    } finally {
      setSaving(false);
    }
  }

  const allSelected = useMemo(() => rows.length > 0 && rows.every(r => checked[r.tag_serial]), [rows, checked]);
  const toggleAll = (val: boolean) => {
    const next: Record<string, boolean> = { ...checked };
    rows.forEach(r => { next[r.tag_serial] = val; });
    setChecked(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Mark Sold</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl w-full">
        <DialogHeader>
          <DialogTitle>Bulk Mark FASTags as Sold</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-3 text-sm">
            <label className="inline-flex items-center gap-2"><input type="radio" checked={filterMode==='owner'} onChange={()=>setFilterMode('owner')} /> By Owner</label>
            <label className="inline-flex items-center gap-2"><input type="radio" checked={filterMode==='filter'} onChange={()=>setFilterMode('filter')} /> By Filters</label>
          </div>

          {filterMode==='owner' ? (
            <div>
              <label className="block text-sm mb-1">Select Owner (Agent/ASM/...)</label>
              <UsersAutocomplete value={owner} onSelect={setOwner} placeholder="Type owner name" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-sm mb-1">Bank (contains)</label>
                <input className="w-full border rounded p-2" value={filterBank} onChange={(e)=>setFilterBank(e.target.value)} placeholder="Type bank" />
              </div>
              <div>
                <label className="block text-sm mb-1">Class (contains)</label>
                <input className="w-full border rounded p-2" value={filterClass} onChange={(e)=>setFilterClass(e.target.value)} placeholder="e.g., class4" />
              </div>
              <div>
                <label className="block text-sm mb-1">Supplier</label>
                <select className="w-full border rounded p-2" value={supplierId} onChange={(e)=>setSupplierId(e.target.value)}>
                  <option value="">All</option>
                  {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm mb-1">Agent/Owner (optional)</label>
                <UsersAutocomplete value={filterOwner} onSelect={setFilterOwner} placeholder="Filter by owner" />
              </div>
            </div>
          )}

          {filterMode==='owner' ? (
            <>
            {/* Combo quick-select controls */}
            <div className="border rounded p-2 mb-3">
              {owner ? (
                (() => {
                  // Build combos: bank + class with available list
                  const comboMap: Record<string, { bank: string; cls: string; items: FastagRow[]; qty: number }>= {};
                  rows.forEach(r => {
                    const key = `${r.bank_name||''}|${r.fastag_class||''}`;
                    if (!comboMap[key]) comboMap[key] = { bank: r.bank_name||'', cls: r.fastag_class||'', items: [], qty: 0 };
                    comboMap[key].items.push(r);
                  });
                  const combos = Object.values(comboMap);
                  const selectQty = (c: { bank: string; cls: string; items: FastagRow[] }, count: number) => {
                    const next = { ...checked };
                    let picked = 0;
                    for (const it of c.items) {
                      if (picked >= count) break;
                      if (!next[it.tag_serial]) { next[it.tag_serial] = true; picked++; }
                    }
                    setChecked(next);
                  };
                  const removeAll = (c: { bank: string; cls: string; items: FastagRow[] }) => {
                    const next = { ...checked };
                    for (const it of c.items) next[it.tag_serial] = false;
                    setChecked(next);
                  };
                  return (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-2 text-left">Bank</th>
                            <th className="p-2 text-left">Class</th>
                            <th className="p-2 text-left">Available</th>
                            <th className="p-2 text-left">Qty</th>
                            <th className="p-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combos.map((c, idx) => {
                            const available = c.items.filter(it => !checked[it.tag_serial]).length;
                            const [qty, setQty] = [undefined as any, undefined as any];
                            return (
                              <tr key={c.bank + '|' + c.cls} className={idx%2? 'bg-gray-50':''}>
                                <td className="p-2">{c.bank || '-'}</td>
                                <td className="p-2">{c.cls || '-'}</td>
                                <td className="p-2">{available}</td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min={1}
                                    max={available || 1}
                                    defaultValue={Math.min(available, 1)}
                                    className="w-24 border rounded p-1"
                                    onChange={(e)=>{ (c as any)._qty = Number(e.target.value||1) }}
                                  />
                                </td>
                                <td className="p-2 flex gap-2">
                                  <button type="button" className="px-3 py-1 border rounded" onClick={()=> selectQty(c as any, (c as any)._qty || 1)}>Select Qty</button>
                                  <button type="button" className="px-3 py-1 border rounded" onClick={()=> removeAll(c as any)}>Remove All</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              ) : (
                <div className="text-sm text-gray-500">Select owner to load combinations</div>
              )}
            </div>
            {/* Detailed list */}
            <div className="border rounded p-2 max-h-[380px] overflow-auto">
              {loadingList ? (
                <div className="text-sm text-gray-500">Loading tags…</div>
              ) : rows.length === 0 ? (
                <div className="text-sm text-gray-500">No assigned FASTags for this user.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left"><input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /> Select All</th>
                      <th className="p-2 text-left">Bank</th>
                      <th className="p-2 text-left">Class</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.tag_serial} className="border-t">
                        <td className="p-2">
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={!!checked[r.tag_serial]} onChange={(e) => setChecked({ ...checked, [r.tag_serial]: e.target.checked })} />
                            {r.tag_serial}
                          </label>
                        </td>
                        <td className="p-2">{r.bank_name || '-'}</td>
                        <td className="p-2">{r.fastag_class || '-'}</td>
                        <td className="p-2">{r.status || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="border rounded p-2 max-h-[300px] overflow-auto">
                {loadingList ? (
                  <div className="text-sm text-gray-500">Loading tags…</div>
                ) : rows.length === 0 ? (
                  <div className="text-sm text-gray-500">No matching FASTags.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-2 text-left"><input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /> Select All</th>
                        <th className="p-2 text-left">Bank</th>
                        <th className="p-2 text-left">Class</th>
                        <th className="p-2 text-left">Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.tag_serial} className="border-t">
                          <td className="p-2">
                            <label className="inline-flex items-center gap-2">
                              <input type="checkbox" checked={!!checked[r.tag_serial]} onChange={(e) => setChecked({ ...checked, [r.tag_serial]: e.target.checked })} />
                              {r.tag_serial}
                            </label>
                          </td>
                          <td className="p-2">{r.bank_name || '-'}</td>
                          <td className="p-2">{r.fastag_class || '-'}</td>
                          <td className="p-2">{(r as any).supplier_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="mt-3">
                <label className="block text-sm font-semibold mb-1">Selection Rules (multi-owner/class/bank/supplier)</label>
                <div className="space-y-2">
                  {rules.map((r, idx) => (
                    <div key={r.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border rounded p-2">
                      <div className="md:col-span-2">
                        <label className="block text-xs mb-1">Owner</label>
                        <UsersAutocomplete value={r.owner} onSelect={(u)=> setRules(prev => prev.map(x => x.id===r.id ? { ...x, owner: u } : x))} placeholder="Agent/ASM" />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Bank</label>
                        <input className="w-full border rounded p-2" value={r.bank} onChange={(e)=> setRules(prev => prev.map(x => x.id===r.id ? { ...x, bank: e.target.value } : x))} />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Class</label>
                        <input className="w-full border rounded p-2" value={r.cls} onChange={(e)=> setRules(prev => prev.map(x => x.id===r.id ? { ...x, cls: e.target.value } : x))} />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Supplier</label>
                        <select className="w-full border rounded p-2" value={r.supplierId} onChange={(e)=> setRules(prev => prev.map(x => x.id===r.id ? { ...x, supplierId: e.target.value } : x))}>
                          <option value="">All</option>
                          {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Count</label>
                        <input type="number" min={1} className="w-full border rounded p-2" value={r.count} onChange={(e)=> setRules(prev => prev.map(x => x.id===r.id ? { ...x, count: Number(e.target.value||1) } : x))} />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="px-3 py-2 border rounded" onClick={()=> setRules(prev => prev.filter(x => x.id!==r.id))}>Remove</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="px-3 py-2 border rounded" onClick={()=> setRules(prev => ([...prev, { id: Math.random().toString(36).slice(2), owner: null, bank: '', cls: '', supplierId: '', count: 1 }]))}>Add Rule</button>
                  <button type="button" className="ml-2 px-3 py-2 border rounded" onClick={applyRules} disabled={saving || rules.length===0}>Apply Rules (select)</button>
                </div>
              </div>
              <label className="block text-sm mt-3">Or paste FASTag barcodes (comma, space, or newline separated)</label>
              <textarea className="w-full border rounded p-2 min-h-[80px]" value={input} onChange={(e) => setInput(e.target.value)} />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          {filterMode==='owner' ? (
            <Button onClick={submitSelected} disabled={saving || rows.length === 0}>{saving ? 'Updating…' : 'Mark Selected Sold'}</Button>
          ) : (
            <Button onClick={submit} disabled={saving || input.trim() === ""}>{saving ? 'Updating…' : 'Mark Sold'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
