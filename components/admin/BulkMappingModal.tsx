"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UsersAutocomplete, { type UserOption } from "@/components/UsersAutocomplete";

type FastagRow = {
  id: number;
  tag_serial: string;
  bank_name?: string;
  fastag_class?: string;
  status?: string;
};

export default function BulkMappingModal({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // List and selection
  const [rows, setRows] = useState<FastagRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Filters
  const [filterMode, setFilterMode] = useState<'owner' | 'filter'>('owner');
  const [owner, setOwner] = useState<UserOption | null>(null);
  const [filterBank, setFilterBank] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [mapping, setMapping] = useState<'pending'|'done'|'all'>('pending');
  const [loadingList, setLoadingList] = useState(false);
  // Bank login user (optional)
  const [bankUser, setBankUser] = useState<UserOption | null>(null);
  // Supplier filter
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([]);
  const [supplierId, setSupplierId] = useState<string>("");

  function resetState() {
    setRows([]);
    setChecked({});
    setError(null);
  }

  async function loadList() {
    setLoadingList(true); setError(null);
    try {
      let url = '/api/fastags?';
      const params: string[] = [];
      if (mapping && mapping !== 'all') params.push(`mapping=${encodeURIComponent(mapping)}`);
      if (supplierId) params.push(`supplier=${encodeURIComponent(supplierId)}`);
      // Owner/Admin selection
      if (filterMode === 'owner') {
        if (!owner) { setRows([]); setChecked({}); setLoadingList(false); return; }
        if (String(owner.id) === 'admin') {
          // Admin warehouse => show in_stock, unassigned
          params.push(`status=in_stock`);
        } else {
          params.push(`status=assigned`);
          params.push(`owner=${encodeURIComponent(String(owner.id))}`);
        }
      } else {
        // Free-form filters
        if (filterBank.trim()) params.push(`bank_like=${encodeURIComponent(filterBank.trim())}`);
        if (filterClass.trim()) params.push(`class_like=${encodeURIComponent(filterClass.trim())}`);
      }
      url += params.join('&');
      const res = await fetch(url);
      const data = await res.json();
      const arr: FastagRow[] = Array.isArray(data) ? data : [];
      setRows(arr);
      const preset: Record<string, boolean> = {};
      arr.forEach((r) => { preset[r.tag_serial] = false; });
      setChecked(preset);
    } catch (e: any) {
      setError(e.message || 'Failed to load FASTags');
    } finally { setLoadingList(false); }
  }

  useEffect(() => {
    if (!open) { resetState(); return; }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner?.id, filterMode, filterBank, filterClass, mapping, supplierId, open]);

  // Load suppliers once when modal opens
  useEffect(() => {
    if (!open) return;
    fetch('/api/suppliers')
      .then(r => r.json())
      .then((rows) => {
        setSuppliers(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setSuppliers([]));
  }, [open]);

  async function updateMapping(status: 'pending' | 'done') {
    const list = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);
    if (list.length === 0) { setError('Select at least one FASTag'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/fastags/bulk-mapping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_serials: list, status, bank_login_user_id: bankUser?.id ?? undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update mapping');
      setOpen(false);
      resetState();
      onSuccess?.();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Mapping</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Update Bank Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Filter controls */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs mb-1">Mode</label>
                <select className="border rounded px-2 py-2" value={filterMode} onChange={(e)=> setFilterMode(e.target.value as any)}>
                  <option value="owner">By Owner/Admin</option>
                  <option value="filter">By Filters</option>
                </select>
              </div>
              {filterMode === 'owner' ? (
                <div className="min-w-[260px]">
                  <label className="block text-xs mb-1">Owner</label>
                  <UsersAutocomplete value={owner} onSelect={(u)=> setOwner(u as any)} placeholder="Agent/ASM or Admin" />
                  <div className="text-xs text-muted-foreground mt-1">Pick an agent for assigned stock or leave blank and switch to Filters to view Admin stock.</div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs mb-1">Bank</label>
                    <input className="border rounded px-2 py-2" value={filterBank} onChange={(e)=> setFilterBank(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Class</label>
                    <input className="border rounded px-2 py-2" value={filterClass} onChange={(e)=> setFilterClass(e.target.value)} />
                  </div>
                </>
              )}
              {/* Supplier filter (applies in both modes) */}
              <div>
                <label className="block text-xs mb-1">Supplier</label>
                <select className="border rounded px-2 py-2 min-w-[200px]" value={supplierId} onChange={(e)=> setSupplierId(e.target.value)}>
                  <option value="">All</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Mapping</label>
                <select className="border rounded px-2 py-2" value={mapping} onChange={(e)=> setMapping(e.target.value as any)}>
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                  <option value="all">All</option>
                </select>
              </div>
              {/* Optional: set bank login user for selected tags when updating mapping */}
              <div className="min-w-[260px]">
                <label className="block text-xs mb-1">Bank Login User (optional)</label>
                <UsersAutocomplete value={bankUser} onSelect={(u)=> setBankUser(u as any)} placeholder="Search user to set as holder" />
                <div className="text-xs text-muted-foreground mt-1">If set, saves as bank login holder for these tags.</div>
              </div>
              <Button variant="outline" onClick={loadList} disabled={loadingList}>Reload</Button>
            </div>

            {/* List */}
            <div className="border rounded max-h-[360px] overflow-auto">
              {loadingList ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No FASTags found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left">
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" onChange={(e)=> setChecked(Object.fromEntries(Object.keys(checked).map(k => [k, e.target.checked])))} /> Select All
                        </label>
                      </th>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={() => updateMapping('pending')} disabled={saving || rows.length === 0}>{saving ? 'Updating…' : 'Mark Pending'}</Button>
            <Button onClick={() => updateMapping('done')} disabled={saving || rows.length === 0}>{saving ? 'Updating…' : 'Mark Done'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

