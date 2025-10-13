"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Download, Search, Edit, Trash2 } from "lucide-react";
import AddFastagItemForm from "@/components/admin/AddFastagItemForm";
import BulkFastagUploadForm from "@/components/BulkFastagUploadForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BulkTransferModal from "@/components/admin/BulkTransferModal";
import BulkMarkSoldModal from "@/components/admin/BulkMarkSoldModal";
import BulkMappingModal from "@/components/admin/BulkMappingModal";
import UsersAutocomplete, { type UserOption } from "@/components/UsersAutocomplete";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const COLORS = ["#2ecc40", "#0074d9", "#ff4136", "#ffb347", "#a569bd", "#5dade2"];

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="rounded-lg shadow p-4 flex-1 text-center" style={{ background: color, color: "#fff" }}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-2">{label}</div>
    </div>
  );
}

// AGENT SUMMARY DASHBOARD
function AgentDashboard({ fastags, agents }: { fastags: any[]; agents: any[] }) {
  // Group fastags by agent_id and count
  const agentStats = useMemo(() => {
    const map: Record<string, { agent: any; count: number }> = {};
    fastags.forEach(tag => {
      if ((tag.assigned_to_agent_id || tag.assigned_to) && tag.agent_name) {
        map[tag.agent_name] = map[tag.agent_name] || { agent: tag.agent_name, count: 0 };
        map[tag.agent_name].count++;
      }
    });
    // Return as sorted array
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [fastags]);
  if (!agentStats.length) return null;
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Agents Overview</CardTitle>
        <CardDescription>FASTag count per agent</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          {agentStats.map(({ agent, count }) => (
            <StatCard key={agent} label={agent} value={count} color="#0074d9" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FastagDashboard({ fastags, agents }: { fastags: any[]; agents: any[] }) {
  // Stat cards
  const stats = useMemo(() => {
    const total = fastags.length;
    const inStock = fastags.filter(f => f.status === "in_stock").length;
    const assigned = fastags.filter(f => f.status === "assigned").length;
    const sold = fastags.filter(f => f.status === "sold").length;
    const usedInTickets = fastags.filter((f: any) => !!f.used_in_ticket).length;
    const isMapped = (f: any) => {
      const s = String(f.bank_mapping_status || '').toLowerCase();
      if (s === 'done') return true;
      if (s === 'pending') return false;
      if (typeof f.mapping_done !== 'undefined') return !!f.mapping_done;
      return false;
    };
    const mapped = fastags.filter((f: any) => isMapped(f)).length;
    const mappingPending = fastags.filter((f: any) => !isMapped(f)).length;
    return { total, inStock, assigned, sold, usedInTickets, mapped, mappingPending };
  }, [fastags]);

  // By Status
  const statusData = useMemo(() => {
    const map: any = {};
    fastags.forEach(f => {
      map[f.status] = (map[f.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [fastags]);

  // By Bank
  const bankData = useMemo(() => {
    const map: any = {};
    fastags.forEach(f => {
      map[f.bank_name] = (map[f.bank_name] || 0) + 1;
    });
    return Object.entries(map).map(([bank, count]) => ({ bank, count }));
  }, [fastags]);

  // By Class/Type
  const classData = useMemo(() => {
    const map: any = {};
    fastags.forEach(f => {
      map[f.fastag_class] = (map[f.fastag_class] || 0) + 1;
    });
    return Object.entries(map).map(([type, count]) => ({ type, count }));
  }, [fastags]);

  const [sellerRows, setSellerRows] = useState<{ user_id: number | null; name: string; sold_count: number }[]>([]);
  // Sellers by Class UI state
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [bankOptions, setBankOptions] = useState<string[]>([]);
  const [sellerClass, setSellerClass] = useState<string>("");
  const [sellerBank, setSellerBank] = useState<string>("");
  const [sellersByClass, setSellersByClass] = useState<{ user_id: number | null; name: string; sold_count: number }[]>([]);
  useEffect(() => {
    fetch('/api/fastags/sales/by-seller?limit=10')
      .then(r => r.json())
      .then(data => setSellerRows(Array.isArray(data) ? data : []))
      .catch(() => setSellerRows([]));
  }, []);

  // Load filter options for sellers-by-class
  useEffect(() => {
    fetch('/api/fastags/classes')
      .then(r => r.json())
      .then(d => setClassOptions(Array.isArray(d) ? d : []))
      .catch(() => setClassOptions([]));
    fetch('/api/fastags/distinct/banks')
      .then(r => r.json())
      .then(d => setBankOptions(Array.isArray(d) ? d : []))
      .catch(() => setBankOptions([]));
  }, []);

  // Load sellers for chosen class/bank
  useEffect(() => {
    if (!sellerClass) { setSellersByClass([]); return; }
    const params = new URLSearchParams();
    params.set('class', sellerClass);
    if (sellerBank) params.set('bank', sellerBank);
    fetch(`/api/fastags/sales/by-class?${params.toString()}`)
      .then(r => r.json())
      .then(rows => setSellersByClass(Array.isArray(rows) ? rows : []))
      .catch(() => setSellersByClass([]));
  }, [sellerClass, sellerBank]);

  return (
    <div className="p-4">
      {/* Stat cards */}
      <div className="flex flex-wrap gap-4 mb-8">
        <StatCard label="Total FASTags" value={stats.total} color="#0074d9" />
        <StatCard label="In Stock" value={stats.inStock} color="#2ecc40" />
        <StatCard label="Assigned" value={stats.assigned} color="#ffb347" />
        <StatCard label="Sold" value={stats.sold} color="#ff4136" />
        <StatCard label="Used In Tickets" value={stats.usedInTickets} color="#a569bd" />
        <StatCard label="Mapped" value={stats.mapped} color="#5dade2" />
        <StatCard label="Mapping Pending" value={stats.mappingPending} color="#8e44ad" />
      </div>
      {/* Agent summary */}
      <AgentDashboard fastags={fastags} agents={agents} />
      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow flex flex-col items-center">
          <h2 className="font-semibold text-lg mb-3">FASTags by Status</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {statusData.map((entry, idx) => (
                  <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="font-semibold text-lg mb-3">FASTags by Bank</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bankData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bank" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#0074d9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="font-semibold text-lg mb-3">Top FASTag Sellers</h2>
          {sellerRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sales recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2">Seller</th>
                    <th className="text-left p-2">Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {sellerRows.map((r, i) => (
                    <tr key={(r.user_id ?? 'null') + '-' + i} className={i % 2 ? 'bg-gray-50' : ''}>
                      <td className="p-2">{r.name || `User #${r.user_id ?? ''}`}</td>
                      <td className="p-2">{r.sold_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="font-semibold text-lg mb-3">FASTags by Type</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={classData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#a569bd" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="font-semibold text-lg mb-3">Who Sold by Class</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            <select className="border rounded px-2 py-2" value={sellerClass} onChange={e=> setSellerClass(e.target.value)}>
              <option value="">Select Class</option>
              {classOptions.map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
            <select className="border rounded px-2 py-2" value={sellerBank} onChange={e=> setSellerBank(e.target.value)}>
              <option value="">All Banks</option>
              {bankOptions.map(b => (<option key={b} value={b}>{b}</option>))}
            </select>
          </div>
          {!sellerClass ? (
            <div className="text-sm text-muted-foreground">Pick a class to see sellers.</div>
          ) : sellersByClass.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sellers found for this class.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2">Seller</th>
                    <th className="text-left p-2">Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {sellersByClass.map((r, i) => (
                    <tr key={(r.user_id ?? 'null') + '-' + i} className={i % 2 ? 'bg-gray-50' : ''}>
                      <td className="p-2">{r.name || `User #${r.user_id ?? ''}`}</td>
                      <td className="p-2">{r.sold_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminFastagsPage() {
  const [fastags, setFastags] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showBulkTransfer, setShowBulkTransfer] = useState(false);
  const [view, setView] = useState<"dashboard" | "table">("dashboard");

  // Filters for table view
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBank, setFilterBank] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [agentIdFilter, setAgentIdFilter] = useState("all");
  const [bankUserFilter, setBankUserFilter] = useState<UserOption | null>(null);
  // Date filters
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [assignedFrom, setAssignedFrom] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [soldFrom, setSoldFrom] = useState("");
  const [soldTo, setSoldTo] = useState("");

  useEffect(() => {
    const fetchFastags = async () => {
      const params: string[] = [];
      // Show ALL fastags on dashboard (do not restrict by mapping)
      params.push(`mapping=all`);
      if (bankUserFilter?.id) params.push(`bank_user=${encodeURIComponent(String(bankUserFilter.id))}`);
      if (createdFrom) params.push(`created_from=${encodeURIComponent(createdFrom)}`);
      if (createdTo) params.push(`created_to=${encodeURIComponent(createdTo)}`);
      if (assignedFrom) params.push(`assigned_from=${encodeURIComponent(assignedFrom)}`);
      if (assignedTo) params.push(`assigned_to=${encodeURIComponent(assignedTo)}`);
      if (soldFrom) params.push(`sold_from=${encodeURIComponent(soldFrom)}`);
      if (soldTo) params.push(`sold_to=${encodeURIComponent(soldTo)}`);
      // No limit by default; API now returns all unless limit is provided
      const qs = params.length ? `?${params.join("&")}` : "";
      const res = await fetch(`/api/fastags${qs}`);
      const data = await res.json();
      let fastagArr = [] as any[];
      if (Array.isArray(data)) fastagArr = data;
      else if (Array.isArray((data as any).fastags)) fastagArr = (data as any).fastags;
      else fastagArr = [];
      setFastags(fastagArr);
    };
    fetchFastags();
    fetch("/api/agents")
      .then(res => res.json())
      .then(data => setAgents(Array.isArray(data) ? data : []));
  }, [createdFrom, createdTo, assignedFrom, assignedTo, soldFrom, soldTo, bankUserFilter?.id]);

  // Filter logic for table
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fastags.filter((fastag) => {
      const serial = String(fastag.tag_serial || "").toLowerCase();
      const bank = String(fastag.bank_name || "").toLowerCase();
      const fclass = String(fastag.fastag_class || "").toLowerCase();
      const batch = String(fastag.batch_number || "").toLowerCase();
      const agentName = String(fastag.agent_name || fastag.assigned_to_name || "").toLowerCase();

      const matchesSearch =
        q === "" ||
        serial.includes(q) ||
        bank.includes(q) ||
        fclass.includes(q) ||
        batch.includes(q) ||
        agentName.includes(q) ||
        assignedStr.includes(q);

      const matchesBank = filterBank === "all" || fastag.bank_name === filterBank;
      const matchesType = filterType === "all" || fastag.fastag_class === filterType;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "assigned" && !!fastag.assigned_to) ||
        (filterStatus === "unassigned" && !fastag.assigned_to);

      const matchesAgent = (
        agentIdFilter === "all" ||
        String(fastag.assigned_to_agent_id ?? "") === String(agentIdFilter) ||
        String(fastag.assigned_to ?? "") === String(agentIdFilter) ||
        (
          String(fastag.status || '').toLowerCase() === 'sold' && (
            String((fastag as any).sold_by_user_id ?? '') === String(agentIdFilter) ||
            String((fastag as any).sold_by_agent_id ?? '') === String(agentIdFilter)
          )
        )
      );

      return matchesSearch && matchesBank && matchesType && matchesStatus && matchesAgent;
    });
  }, [fastags, searchQuery, filterBank, filterType, filterStatus, agentIdFilter]);

  // Aggregate by Bank + Class + Batch with counts
  const aggregated = useMemo(() => {
    function toTs(v: any): number | null {
      if (!v) return null;
      const d = new Date(v);
      const ts = d.getTime();
      return isNaN(ts) ? null : ts;
    }
    const map: Record<string, {
      bank: string;
      type: string;
      batch: string;
      total: number;
      in_stock: number;
      assigned: number;
      sold: number;
      assignedMin: number | null;
      assignedMax: number | null;
      soldMin: number | null;
      soldMax: number | null;
    }> = {};
    for (const t of filtered) {
      const bank = String(t.bank_name || '');
      const type = String(t.fastag_class || '');
      const batch = String(t.batch_number || '');
      const key = `${bank}|${type}|${batch}`;
      if (!map[key]) map[key] = { bank, type, batch, total: 0, in_stock: 0, assigned: 0, sold: 0, assignedMin: null, assignedMax: null, soldMin: null, soldMax: null };
      map[key].total += 1;
      const status = String(t.status || '').toLowerCase();
      if (status === 'assigned') map[key].assigned += 1;
      else if (status === 'sold') map[key].sold += 1;
      else map[key].in_stock += 1;
      // collect date ranges
      const assignedAtTs = toTs(t.assigned_at) ?? (t.assigned_date ? toTs(`${t.assigned_date}T00:00:00`) : null);
      if (assignedAtTs) {
        map[key].assignedMin = map[key].assignedMin === null ? assignedAtTs : Math.min(map[key].assignedMin, assignedAtTs);
        map[key].assignedMax = map[key].assignedMax === null ? assignedAtTs : Math.max(map[key].assignedMax, assignedAtTs);
      }
      const soldAtTs = toTs(t.sold_at);
      if (soldAtTs) {
        map[key].soldMin = map[key].soldMin === null ? soldAtTs : Math.min(map[key].soldMin, soldAtTs);
        map[key].soldMax = map[key].soldMax === null ? soldAtTs : Math.max(map[key].soldMax, soldAtTs);
      }
    }
    return Object.values(map).sort((a, b) => a.bank.localeCompare(b.bank) || a.type.localeCompare(b.type) || a.batch.localeCompare(b.batch));
  }, [filtered]);

  const uniqueBanks = useMemo(() => Array.from(new Set(fastags.map((f) => f.bank_name))).filter(Boolean), [fastags]);
  const uniqueTypes = useMemo(() => Array.from(new Set(fastags.map((f) => f.fastag_class))).filter(Boolean), [fastags]);
  const agentOptions = useMemo(() => agents.map(a => ({ id: String(a.id), name: a.name })), [agents]);

  // Backfill UI state per aggregated group
  const [backfillDates, setBackfillDates] = useState<Record<string, string>>({});
  const [backfillBusy, setBackfillBusy] = useState<Record<string, boolean>>({});

  async function backfillSoldForGroup(key: string, g: { bank: string; type: string; batch: string }) {
    if (agentIdFilter === 'all') { alert('Select an Agent first to attribute sales.'); return; }
    const sold_date = backfillDates[key]?.trim() || '';
    setBackfillBusy(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/fastags/sales/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank: g.bank, class: g.type, batch: g.batch, seller: Number(agentIdFilter), sold_date })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Backfill failed');
      // Refresh data to reflect updated sold counts/dates
      window.location.reload();
    } catch (e: any) {
      alert(e.message || 'Backfill failed');
    } finally {
      setBackfillBusy(prev => ({ ...prev, [key]: false }));
    }
  }

  function formatYmd(ts: number | null): string {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function formatRange(minTs: number | null, maxTs: number | null): string {
    const a = formatYmd(minTs);
    const b = formatYmd(maxTs);
    if (a && b && a !== b) return `${a} → ${b}`;
    return a || b || '-';
  }

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">FASTag Management</h1>
            <p className="text-muted-foreground">Manage all FASTags in the system.</p>
          </div>
          <div className="flex flex-wrap gap-2">
{/*             <Button onClick={() => setShowAddForm((prev) => !prev)}>
              <Plus className="mr-2 h-4 w-4" />
              {showAddForm ? "Close Add Form" : "Add FASTag"}
            </Button>
            <Button variant="outline" onClick={() => setShowBulkForm((prev) => !prev)}>
              <Upload className="mr-2 h-4 w-4" />
              {showBulkForm ? "Close Bulk Form" : "Bulk Add"}
            </Button> */}
            <Button variant="outline" onClick={() => setShowBulkTransfer(true)}>
              <Download className="mr-2 h-4 w-4" />
              Bulk Transfer
            </Button>
            <BulkMarkSoldModal onSuccess={() => window.location.reload()} />
            <BulkMappingModal onSuccess={() => window.location.reload()} />
            {/* Dashboard/Table toggle */}
            <Button variant={view === "dashboard" ? "default" : "outline"} onClick={() => setView("dashboard")}>
              Dashboard View
            </Button>
            <Button variant={view === "table" ? "default" : "outline"} onClick={() => setView("table")}>
              Table View
            </Button>
          </div>
        </div>

        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New FASTag</CardTitle>
              <CardDescription>Enter the details of the new FASTag below.</CardDescription>
            </CardHeader>
            <CardContent>
              <AddFastagItemForm />
            </CardContent>
          </Card>
        )}

        {showBulkForm && (
          <Card>
            <CardHeader>
              <CardTitle>Bulk Upload FASTags</CardTitle>
              <CardDescription>Enter a range of FASTag serials and batch info.</CardDescription>
            </CardHeader>
            <CardContent>
              <BulkFastagUploadForm />
            </CardContent>
          </Card>
        )}

        {/* DASHBOARD VIEW */}
        {view === "dashboard" && (
          <Card>
            <CardContent>
              <FastagDashboard fastags={fastags} agents={agents} />
            </CardContent>
          </Card>
        )}

        {/* TABLE VIEW (older view) */}
        {view === "table" && (
          <Card>
            <CardHeader>
              <CardTitle>FASTag Inventory</CardTitle>
              <CardDescription>View and manage all FASTags in the system.</CardDescription>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search FASTags..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <UsersAutocomplete value={bankUserFilter} onSelect={(u)=> setBankUserFilter(u as any)} placeholder="Filter by bank login user" />
              </div>
                <div>
                  <Select value={filterBank} onValueChange={setFilterBank}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by bank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Banks</SelectItem>
                      {uniqueBanks.map((bank) => (
                        <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={agentIdFilter} onValueChange={setAgentIdFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      {agentOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {uniqueTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Date filters row */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Added From</label>
                  <Input type="date" value={createdFrom} onChange={(e)=> setCreatedFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Added To</label>
                  <Input type="date" value={createdTo} onChange={(e)=> setCreatedTo(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Assigned From</label>
                  <Input type="date" value={assignedFrom} onChange={(e)=> setAssignedFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Assigned To</label>
                  <Input type="date" value={assignedTo} onChange={(e)=> setAssignedTo(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Sold From</label>
                  <Input type="date" value={soldFrom} onChange={(e)=> setSoldFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Sold To</label>
                  <Input type="date" value={soldTo} onChange={(e)=> setSoldTo(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Quick summary for current filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Filtered Total</div>
                  <div className="text-xl font-semibold">{filtered.length}</div>
                </div>
                <div className="rounded border p-3 text-center">
                  <div className="text-xs text-muted-foreground">In Stock</div>
                  <div className="text-xl font-semibold">{filtered.filter(f => f.status === 'in_stock').length}</div>
                </div>
                <div className="rounded border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Assigned</div>
                  <div className="text-xl font-semibold">{filtered.filter(f => f.status === 'assigned').length}</div>
                </div>
                <div className="rounded border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Sold</div>
                  <div className="text-xl font-semibold text-green-700">{filtered.filter(f => f.status === 'sold').length}</div>
                </div>
              </div>
              {aggregated.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">No FASTag groups found.</div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bank</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Batch Number</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">In Stock</TableHead>
                        <TableHead className="text-right">Assigned</TableHead>
                        <TableHead className="text-right">Sold</TableHead>
                        <TableHead>Assigned Dates</TableHead>
                        <TableHead>Sold Dates</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aggregated.map((g, idx) => {
                        const key = `${g.bank}|${g.type}|${g.batch}`;
                        const busy = !!backfillBusy[key];
                        return (
                        <TableRow key={key}>
                          <TableCell>{g.bank}</TableCell>
                          <TableCell>{g.type}</TableCell>
                          <TableCell>{g.batch}</TableCell>
                          <TableCell className="text-right font-semibold">{g.total}</TableCell>
                          <TableCell className="text-right">{g.in_stock}</TableCell>
                          <TableCell className="text-right">{g.assigned}</TableCell>
                          <TableCell className="text-right text-green-700">{g.sold}</TableCell>
                          <TableCell>{formatRange(g.assignedMin, g.assignedMax)}</TableCell>
                          <TableCell>{formatRange(g.soldMin, g.soldMax)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input type="date" value={backfillDates[key] || ''} onChange={(e)=> setBackfillDates(prev => ({ ...prev, [key]: e.target.value }))} className="w-40" />
                              <Button size="sm" disabled={agentIdFilter==='all' || busy} onClick={()=> backfillSoldForGroup(key, g)}>
                                {busy ? 'Backfilling…' : 'Backfill Sold'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* BULK TRANSFER MODAL */}
        <BulkTransferModal
          open={showBulkTransfer}
          onClose={() => setShowBulkTransfer(false)}
          banks={uniqueBanks}
          classes={uniqueTypes}
          agents={agents}
          users={agents}
          onSuccess={() => window.location.reload()}
        />
      </div>
    </div>
  );
}
