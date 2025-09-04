"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Repeat2, Eye, Edit, Trash2, Plus, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAdminSession } from "@/lib/actions/auth-actions";
import type { Agent } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RegisterAgentForm from "@/components/admin/registeragentform";


const ROLE_ORDER = {
  asm: 1,
  manager: 2,
  tl: 3,
  'toll-agent': 4,
  shop: 5,
  showroom: 5,
};


// --- Hierarchy helpers ---
function buildAgentTree(agents) {
  const idMap = {};
  const roots = [];
  agents.forEach(agent => {
    idMap[agent.id] = { ...agent, children: [] };
  });
  agents.forEach(agent => {
    if (agent.parent_user_id && idMap[agent.parent_user_id]) {
      idMap[agent.parent_user_id].children.push(idMap[agent.id]);
    } else {
      roots.push(idMap[agent.id]);
    }
  });
  return roots;
}

// Returns: Array<{...agent, key, level, hasChildren, expanded, onExpand, parent}>
function flattenTreeWithExpand(tree, expandedMap, setExpandedMap, searchQuery, filterStatus, level = 0, parent = null, parentKey = "") {
  let rows = [];
  tree.forEach(agent => {
    const key = parentKey + agent.id;
    const hasChildren = agent.children && agent.children.length > 0;
    const isExpanded = !!expandedMap[key];

    // Apply search/status filter to agent or its descendants
    const matchesSearch =
      !searchQuery ||
      agent.name.toLowerCase().includes(searchQuery) ||
      (agent.email && agent.email.toLowerCase().includes(searchQuery)) ||
      agent.phone.includes(searchQuery) ||
      agent.pincode.toLowerCase().includes(searchQuery);

    const matchesStatus =
      filterStatus === "all" || (agent.status || "Active").toLowerCase() === filterStatus;

    let visibleDescendants = [];
    if (hasChildren) {
      visibleDescendants = flattenTreeWithExpand(
        agent.children,
        expandedMap,
        setExpandedMap,
        searchQuery,
        filterStatus,
        level + 1,
        agent,
        key + "-"
      );
    }
    const descendantMatch = visibleDescendants.some(row => row._match);

    const show = (matchesSearch && matchesStatus) || descendantMatch;

    if (show) {
      rows.push({
        ...agent,
        key,
        level,
        hasChildren,
        expanded: isExpanded,
        onExpand: () =>
          setExpandedMap(prev => ({ ...prev, [key]: !prev[key] })),
        parent,
        _match: matchesSearch && matchesStatus,
      });
      if (hasChildren && isExpanded) {
        rows = rows.concat(visibleDescendants);
      }
    }
  });
  return rows;
}

// --- Hierarchy Modal Rendering Helper ---
function renderHierarchyRows(tree, level = 0) {
  if (!Array.isArray(tree)) return null;
  return tree.flatMap(agent => [
    <TableRow key={agent.id}>
      <TableCell style={{ paddingLeft: level * 28, fontWeight: level === 0 ? 'bold' : undefined }}>
        {agent.name}
      </TableCell>
      <TableCell>{agent.role}</TableCell>
      <TableCell>{agent.total_fastags ?? 0}</TableCell>
      <TableCell>{agent.assigned ?? 0}</TableCell>
      <TableCell>{agent.sold ?? 0}</TableCell>
    </TableRow>,
    ...(agent.children?.length ? renderHierarchyRows(agent.children, level + 1) : [])
  ]);
}

export default function AdminAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Modal/dashboard state
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentDetails, setAgentDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [modalTab, setModalTab] = useState<"owned" | "hierarchy">("owned");

  // Expanded state (by row key)
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const checkSessionAndLoadAgents = async () => {
      const session = await getAdminSession();
      if (!session) {
        router.push("/admin/login");
        return;
      }
      try {
        const res = await fetch("/api/agents/all");
        const agentData = await res.json();
        if (Array.isArray(agentData)) {
          setAgents(agentData);
        } else {
          setAgents([]);
          setError(agentData?.error || "Failed to load agent data.");
        }
      } catch (error) {
        setAgents([]);
        setError("Failed to load agent data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    checkSessionAndLoadAgents();
  }, [router]);

  // --- Hierarchical agent list with expand/collapse ---
  const agentTree = buildAgentTree(agents);
  // Expand all root nodes by default (only at first render)
  useEffect(() => {
    if (agentTree.length && Object.keys(expandedRows).length === 0) {
      const roots = {};
      agentTree.forEach(agent => {
        roots[agent.id] = true;
      });
      setExpandedRows(roots);
    }
    // eslint-disable-next-line
  }, [agents]);

  const flattenedAgents = flattenTreeWithExpand(
    agentTree,
    expandedRows,
    setExpandedRows,
    searchQuery.toLowerCase(),
    filterStatus === "all" ? "all" : filterStatus.toLowerCase()
  );

  // Handle row click: load agent details and hierarchy (unchanged)
  function handleRowClick(agent: Agent) {
    setSelectedAgent(agent);
    setLoadingDetails(true);
    setAgentDetails(null);
    setHierarchy(null);
    setLoadingHierarchy(true);
    setModalTab("owned");

    fetch(`/api/agents/${agent.id}/details`)
      .then((res) => res.json())
      .then((data) => setAgentDetails(data))
      .finally(() => setLoadingDetails(false));

    fetch(`/api/agents/${agent.id}/hierarchy`)
      .then(res => res.json())
      .then(data => setHierarchy(data))
      .finally(() => setLoadingHierarchy(false));
  }

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-6">
        {/* --- top buttons & register agent form, unchanged --- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Management</h1>
            <p className="text-muted-foreground">Manage all agents in the system.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button className="w-full sm:w-auto" onClick={() => setShowAddForm((prev) => !prev)}>
              <Plus className="mr-2 h-4 w-4" />
              {showAddForm ? "Close Form" : "Add New Agent"}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => router.push("/admin/fastags/transfer")}
            >
              <Repeat2 className="mr-2 h-4 w-4" />
              Transfer FASTags
            </Button>
          </div>
        </div>
        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Register New Agent</CardTitle>
              <CardDescription>Fill in the details to add a new agent.</CardDescription>
            </CardHeader>
            <CardContent>
              <RegisterAgentForm />
            </CardContent>
          </Card>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* --- MAIN TABLE: Hierarchical, with expand/collapse --- */}
        <Card>
          <CardHeader>
            <CardTitle>Agent List (Grouped by Hierarchy)</CardTitle>
            <CardDescription>View and manage all agents, visually grouped by hierarchy.</CardDescription>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Pincode</TableHead>
                    <TableHead>Parent Agent</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Total FASTags</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : flattenedAgents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No agents found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    flattenedAgents.map((agent) => (
                      <TableRow
                        key={agent.key}
                        className="cursor-pointer hover:bg-blue-50"
                        onClick={() => handleRowClick(agent)}
                      >
                        <TableCell className="font-medium">
                          <span style={{ paddingLeft: agent.level * 24, fontWeight: agent.level === 0 ? "bold" : undefined, display: "inline-flex", alignItems: "center" }}>
                            {agent.hasChildren && (
                              <span
                                onClick={e => {
                                  e.stopPropagation();
                                  agent.onExpand();
                                }}
                                style={{
                                  display: "inline-block",
                                  marginRight: 8,
                                  width: 20,
                                  cursor: "pointer",
                                  userSelect: "none"
                                }}
                                title={agent.expanded ? "Collapse" : "Expand"}
                              >
                                {agent.expanded ? "▼" : "▶"}
                              </span>
                            )}
                            {agent.name}
                          </span>
                          <span style={{ color: "#888", marginLeft: 8 }}>
                            ({agent.role})
                          </span>
                        </TableCell>
                        <TableCell>{agent.phone}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{agent.pincode}</TableCell>
                        <TableCell>
                          {agent.parent
                            ? `${agent.parent.name} (${agent.parent.role})`
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              (agent.status || "Active").toLowerCase() === "active"
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-red-100 text-red-800 border border-red-200"
                            }
                          >
                            {(agent.status || "Active").charAt(0).toUpperCase() +
                              (agent.status || "Active").slice(1).toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{agent.total_fastags}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/admin/agents/${agent.id}`);
                              }}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                alert("Edit Agent (not implemented)");
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                alert("Delete Agent (not implemented)");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* --- Modal/details logic --- */}
        {selectedAgent && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl w-full relative">
              <button
                onClick={() => {
                  setSelectedAgent(null);
                  setAgentDetails(null);
                  setHierarchy(null);
                }}
                className="absolute top-3 right-4 text-2xl"
              >
                &times;
              </button>
              <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-2">
                <h2 className="text-2xl font-bold">
                  Agent: {selectedAgent.name}
                </h2>
                <div className="flex gap-8 mt-2 md:mt-0 text-base">
                  <div>
                    <b>Role:</b> {selectedAgent.role}
                  </div>
                  <div>
                    <b>Parent Agent:</b>{" "}
                    {selectedAgent.parent_name
                      ? `${selectedAgent.parent_name} (${selectedAgent.parent_role})`
                      : <span className="text-muted-foreground">None</span>}
                  </div>
                </div>
              </div>
              <div className="flex border-b mb-4 gap-3">
                <button
                  className={`px-4 py-2 font-semibold border-b-2 ${modalTab === "owned" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600"}`}
                  onClick={() => setModalTab("owned")}
                >
                  FASTags Owned
                </button>
                {(hierarchy?.agent_tree && hierarchy.agent_tree.some(a => a.children && a.children.length > 0)) && (
                  <button
                    className={`px-4 py-2 font-semibold border-b-2 ${modalTab === "hierarchy" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600"}`}
                    onClick={() => setModalTab("hierarchy")}
                  >
                    Agent Hierarchy
                  </button>
                )}
              </div>
              {modalTab === "owned" ? (
                loadingDetails ? (
                  <div>Loading details...</div>
                ) : agentDetails ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <b>Total FASTags handled:</b> {agentDetails?.total_fastags ?? 0}
                      </div>
                      <div>
                        <b>Currently Available:</b> {agentDetails?.available_fastags ?? 0}
                      </div>
                      <div>
                        <b>Sold FASTags:</b> {agentDetails?.sold_fastags ?? 0}
                      </div>
                      <div>
                        <b>Reassigned to Others:</b> {agentDetails?.reassigned_fastags ?? 0}
                      </div>
                    </div>
                    {/* --- SUMMARY TABLE --- */}
                    <div className="overflow-auto max-h-96">
                      <h3 className="font-semibold mb-2">FASTag Summary By Bank, Serial Prefix & Class</h3>
                      {/* --- Build summaryList from agentDetails.fastag_serials --- */}
                      {(() => {
                        let summaryList = [];
                        if (agentDetails && Array.isArray(agentDetails.fastag_serials)) {
                          const map = {};
                          agentDetails.fastag_serials.forEach(tag => {
                            const [bankCode, mid] = tag.tag_serial.split("-");
                            const bank_name = tag.bank_name || bankCode;
                            const serial_prefix = tag.serial_prefix || `${bankCode}-${mid}`;
                            let classType = "";
                            if (mid === "030" || mid === "040") classType = "Class 4";
                            else if (mid === "050") classType = "Class 5";
                            else classType = tag.fastag_class ? tag.fastag_class.replace(/^class/i, "Class ") : "Unknown";
                            const key = `${bank_name}|${serial_prefix}|${classType}`;
                            if (!map[key]) map[key] = { bank_name, serial_prefix, classType, available: 0, sold: 0 };
                            if (tag.status === "sold") map[key].sold += 1;
                            else map[key].available += 1;
                          });
                          summaryList = Object.values(map);
                        }
                        return (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Bank</TableHead>
                                <TableHead>FASTag Serial Prefix</TableHead>
                                <TableHead>Class Type</TableHead>
                                <TableHead>Available</TableHead>
                                <TableHead>Sold</TableHead>
                                <TableHead>Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {summaryList.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                                    No tags available for this bank/class
                                  </TableCell>
                                </TableRow>
                              ) : (
                                summaryList.map((row, i) => (
                                  <TableRow key={row.bank_name + row.serial_prefix + row.classType} className={i % 2 ? "bg-gray-50" : ""}>
                                    <TableCell>{row.bank_name}</TableCell>
                                    <TableCell>{row.serial_prefix}</TableCell>
                                    <TableCell>{row.classType}</TableCell>
                                    <TableCell>{row.available}</TableCell>
                                    <TableCell>{row.sold}</TableCell>
                                    <TableCell>{row.available + row.sold}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <div>No details found for agent.</div>
                )
              ) : (
                <div style={{ marginTop: 24 }}>
                  <h3 className="font-semibold mb-2">Agent Hierarchy</h3>
                  {loadingHierarchy ? (
                    <div>Loading hierarchy...</div>
                  ) : hierarchy?.agent_tree && hierarchy.agent_tree.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Total FASTags</TableHead>
                          <TableHead>Assigned</TableHead>
                          <TableHead>Sold</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {renderHierarchyRows(hierarchy.agent_tree)}
                      </TableBody>
                    </Table>
                  ) : (
                    <div>No hierarchy data.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
