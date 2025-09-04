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
      if (tag.assigned_to && tag.agent_name) {
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
    return { total, inStock, assigned, sold };
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

  return (
    <div className="p-4">
      {/* Stat cards */}
      <div className="flex flex-wrap gap-4 mb-8">
        <StatCard label="Total FASTags" value={stats.total} color="#0074d9" />
        <StatCard label="In Stock" value={stats.inStock} color="#2ecc40" />
        <StatCard label="Assigned" value={stats.assigned} color="#ffb347" />
        <StatCard label="Sold" value={stats.sold} color="#ff4136" />
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
  const [agentNameFilter, setAgentNameFilter] = useState("all");

  useEffect(() => {
    const fetchFastags = async () => {
      const res = await fetch("/api/fastags/all");
      const data = await res.json();
      let fastagArr = [];
      if (Array.isArray(data)) fastagArr = data;
      else if (Array.isArray(data.fastags)) fastagArr = data.fastags;
      else fastagArr = [];
      setFastags(fastagArr);
    };
    fetchFastags();
    fetch("/api/agents")
      .then(res => res.json())
      .then(data => setAgents(Array.isArray(data) ? data : []));
  }, []);

  // Filter logic for table
  const filtered = useMemo(() => fastags.filter((fastag) => {
    const matchesSearch =
      fastag.tag_serial?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fastag.bank_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fastag.fastag_class?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fastag.batch_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fastag.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBank = filterBank === "all" || fastag.bank_name === filterBank;
    const matchesType = filterType === "all" || fastag.fastag_class === filterType;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "assigned" && fastag.assigned_to) ||
      (filterStatus === "unassigned" && !fastag.assigned_to);

    const matchesAgent =
      agentNameFilter === "all" ||
      (
        fastag.agent_name &&
        fastag.agent_name.trim().toLowerCase() === agentNameFilter.trim().toLowerCase()
      );

    return matchesSearch && matchesBank && matchesType && matchesStatus && matchesAgent;
  }), [fastags, searchQuery, filterBank, filterType, filterStatus, agentNameFilter]);

  const uniqueBanks = useMemo(() => Array.from(new Set(fastags.map((f) => f.bank_name))).filter(Boolean), [fastags]);
  const uniqueTypes = useMemo(() => Array.from(new Set(fastags.map((f) => f.fastag_class))).filter(Boolean), [fastags]);
  const uniqueAgentNames = useMemo(() => Array.from(new Set(agents.map(a => a.name))).filter(Boolean), [agents]);

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
                  <Select value={agentNameFilter} onValueChange={setAgentNameFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      {uniqueAgentNames.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
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
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">No FASTags found.</div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serial</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Batch Number</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((tag) => (
                        <TableRow key={tag.id}>
                          <TableCell>{tag.tag_serial}</TableCell>
                          <TableCell>{tag.bank_name}</TableCell>
                          <TableCell>{tag.fastag_class}</TableCell>
                          <TableCell>{tag.batch_number}</TableCell>
                          <TableCell>{tag.assigned_to ? `Agent: ${tag.agent_name}` : "Unassigned"}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                tag.status === "assigned"
                                  ? "bg-yellow-50 text-yellow-700"
                                  : tag.status === "sold"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-green-50 text-green-700"
                              }
                            >
                              {tag.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
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
