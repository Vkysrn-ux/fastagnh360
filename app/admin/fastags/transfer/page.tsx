// app/admin/fastags/transfer/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAdminSession } from "@/lib/actions/auth-actions";

export default function FastagTransferPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [fromAgent, setFromAgent] = useState("");
  const [toAgent, setToAgent] = useState("");
  const [summary, setSummary] = useState<Array<{ bank_name: string; fastag_class: string; available: number }>>([]);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [barcodesMap, setBarcodesMap] = useState<Record<string, string[]>>({});
  const [barcodesLoading, setBarcodesLoading] = useState<Record<string, boolean>>({});
  const [selectedMap, setSelectedMap] = useState<Record<string, Record<string, boolean>>>({});
  const [message, setMessage] = useState("");
  const [mappingFilter, setMappingFilter] = useState<'all'|'pending'|'done'>('all');

  useEffect(() => {
    const load = async () => {
      const session = await getAdminSession();
      if (!session) return router.push("/admin/login");
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(data);
    };
    load();
  }, [router]);

  const handleTransfer = async () => {
    if (!fromAgent || !toAgent) {
      setMessage("Select both From and To agents.");
      return;
    }
    try {
      const assignments: Array<{ agentId: string | number; serials: string[] }> = [];
      for (const row of summary) {
        const key = `${row.bank_name}|${row.fastag_class}`;
        const qty = Number(qtyMap[key] || 0);
        if (!qty) continue;
        // Prefer explicitly selected barcodes if any
        let serials: string[] = [];
        const selected = Object.entries(selectedMap[key] || {}).filter(([, v]) => v).map(([s]) => s);
        if (selected.length >= qty) {
          serials = selected.slice(0, qty);
        } else {
          // Load full list if not present, then take remaining
          if (!barcodesMap[key]) {
            let url = `/api/fastags?status=assigned&owner=${encodeURIComponent(fromAgent)}&bank=${encodeURIComponent(row.bank_name)}&class=${encodeURIComponent(row.fastag_class)}`;
            if (mappingFilter !== 'all') url += `&mapping=${encodeURIComponent(mappingFilter)}`;
            const data = await fetch(url).then(r => r.json()).catch(() => []);
            const list: Array<{ tag_serial: string }> = Array.isArray(data) ? data : [];
            setBarcodesMap(m => ({ ...m, [key]: list.map(x => x.tag_serial) }));
          }
          const pool = barcodesMap[key] || [];
          // combine selected then fill from pool
          const need = qty - selected.length;
          const fillers = pool.filter(s => !selected.includes(s)).slice(0, Math.max(0, need));
          serials = [...selected, ...fillers];
        }
        if (serials.length > 0) {
          assignments.push({ agentId: toAgent, serials });
        }
      }
      if (assignments.length === 0) { setMessage("Select at least one quantity to transfer."); return; }
      const res = await fetch("/api/fastags/bulk-transfer", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(assignments) });
      const result = await res.json();
      if (result?.success) {
        const total = assignments.reduce((s, a) => s + a.serials.length, 0);
        setMessage(`Successfully transferred ${total} FASTag(s).`);
        const next = await fetch(`/api/agents/${fromAgent}/fastags/available-summary`).then(r=>r.json()).catch(()=>[]);
        setSummary(Array.isArray(next) ? next : []);
        setQtyMap({});
        setSelectedMap({});
      } else {
        setMessage(result?.error || 'Transfer failed.');
      }
    } catch (e: any) {
      setMessage(e.message || 'Transfer failed.');
    }
  };

  return (
    <div className="container py-10">
      <Card>
        <CardHeader>
          <CardTitle>Quick Transfer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>From Agent</Label>
            <Select onValueChange={async (val) => {
              setFromAgent(val);
              setQtyMap({});
              if (val) {
                const rows = await fetch(`/api/agents/${val}/fastags/available-summary`).then(r=>r.json()).catch(()=>[]);
                setSummary(Array.isArray(rows) ? rows : []);
              } else {
                setSummary([]);
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bank Mapping</Label>
            <Select value={mappingFilter} onValueChange={(v: any)=> setMappingFilter(v)}>
              <SelectTrigger><SelectValue placeholder="Mapping Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Mapping Pending</SelectItem>
                <SelectItem value="done">Mapping Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>To Agent</Label>
            <Select onValueChange={setToAgent}>
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fromAgent && (
            <div className="mt-4">
              <Label className="block mb-2">Available by Bank & Class</Label>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-2">Bank</th>
                      <th className="text-left p-2">Class</th>
                      <th className="text-left p-2">Available</th>
                      <th className="text-left p-2">Qty to transfer</th>
                      <th className="text-left p-2">Barcodes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.length === 0 ? (
                      <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">No assigned FASTags for this agent</td></tr>
                    ) : summary.map((r, i) => {
                      const key = `${r.bank_name}|${r.fastag_class}`;
                      const val = qtyMap[key] || 0;
                      return (
                        <>
                          <tr key={key} className={i%2? 'bg-gray-50':''}>
                            <td className="p-2">{r.bank_name}</td>
                            <td className="p-2">{r.fastag_class}</td>
                            <td className="p-2">{r.available}</td>
                            <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              max={r.available}
                              value={val}
                              onChange={async e => {
                                const nextQty = Math.max(0, Math.min(Number(e.target.value||0), Number(r.available)));
                                setQtyMap(m => ({ ...m, [key]: nextQty }));
                                // Ensure barcodes loaded if increasing qty and not loaded yet
                                if (nextQty > 0 && !barcodesMap[key]) {
                                  setBarcodesLoading(m => ({ ...m, [key]: true }));
                                  try {
                                    let url = `/api/fastags?status=assigned&owner=${encodeURIComponent(fromAgent)}&bank=${encodeURIComponent(r.bank_name)}&class=${encodeURIComponent(r.fastag_class)}`;
                                    if (mappingFilter !== 'all') url += `&mapping=${encodeURIComponent(mappingFilter)}`;
                                    const data = await fetch(url).then(res => res.json()).catch(() => []);
                                    const list: Array<{ tag_serial: string }> = Array.isArray(data) ? data : [];
                                    setBarcodesMap(m => ({ ...m, [key]: list.map(x => x.tag_serial) }));
                                  } finally {
                                    setBarcodesLoading(m => ({ ...m, [key]: false }));
                                  }
                                }
                                // Auto-select first N barcodes when qty changes
                                setSelectedMap(prev => {
                                  const pool = barcodesMap[key] || [];
                                  const chosen = pool.slice(0, nextQty);
                                  const nextSel: Record<string, boolean> = {};
                                  chosen.forEach(s => { nextSel[s] = true; });
                                  return { ...prev, [key]: nextSel };
                                });
                              }}
                              className="w-24 border rounded px-2 py-1"
                            />
                          </td>
                          <td className="p-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  // toggle display; fetch if not loaded
                                  if (barcodesMap[key]) {
                                    setBarcodesMap(m => { const c = { ...m }; delete c[key]; return c; });
                                    return;
                                  }
                                  setBarcodesLoading(m => ({ ...m, [key]: true }));
                                  try {
                                    const url = `/api/fastags?status=assigned&owner=${encodeURIComponent(fromAgent)}&bank=${encodeURIComponent(r.bank_name)}&class=${encodeURIComponent(r.fastag_class)}`;
                                    const data = await fetch(url).then(res => res.json()).catch(() => []);
                                    const list: Array<{ tag_serial: string }> = Array.isArray(data) ? data : [];
                                    const codes = list.map(x => x.tag_serial);
                                    setBarcodesMap(m => ({ ...m, [key]: codes }));
                                  } finally {
                                    setBarcodesLoading(m => ({ ...m, [key]: false }));
                                  }
                                }}
                              >
                                {barcodesMap[key] ? 'Hide' : (barcodesLoading[key] ? 'Loading...' : 'Show')}
                              </Button>
                            </td>
                          </tr>
                          {barcodesMap[key] && (
                            <tr>
                              <td className="p-2" colSpan={5}>
                                <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">
                                  {barcodesMap[key].map((code) => {
                                    const sel = !!(selectedMap[key]?.[code]);
                                    return (
                                      <button
                                        type="button"
                                        key={code}
                                        onClick={() => {
                                          setSelectedMap(prev => {
                                            const current = { ...(prev[key] || {}) };
                                            current[code] = !current[code];
                                            // sync qty with selection size
                                            const count = Object.values(current).filter(Boolean).length;
                                            setQtyMap(m => ({ ...m, [key]: count }));
                                            return { ...prev, [key]: current };
                                          });
                                        }}
                                        className={`px-2 py-1 border rounded text-xs ${sel ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}
                                      >
                                        {code}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button className="mt-4" onClick={handleTransfer}>Quick Transfer</Button>
          {message && <p className="text-sm text-muted-foreground pt-2">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
