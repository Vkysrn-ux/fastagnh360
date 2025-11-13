"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type OrderStatus = "PENDING" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "LOST"
type RequesterType = "Agent" | "User" | "Toll Agent" | "Customer" | "Shop"

type OrderItem = { bank: string; classType: string; qty: number }

type DispatchOrder = {
  id: string | number
  requestNumber: string
  requesterType: RequesterType
  requesterName: string
  items: OrderItem[]
  packedState: "Pending to Pack" | "Packed & Ready"
  dispatchVia:
    | "ST Courier"
    | "DTDC"
    | "Professional Courier"
    | "BUS Driver/Conductor"
    | "Rapido"
    | "Self delivery"
    | "Agent Pickup"
  trackingId?: string
  status: OrderStatus
  packedBy?: string
  createdBy?: string
  requestedAt: string // ISO
  eta?: string
}

type SupplierOrder = {
  id: string | number
  supplierName: string
  classType: string
  qtyOrdered: number
  dateOrdered: string // ISO
  dateReceived?: string // ISO
  qtyDelivered?: number
}

// No static seed data; always use API

function statusBadge(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    PACKED: "bg-blue-100 text-blue-800 border-blue-200",
    SHIPPED: "bg-indigo-100 text-indigo-800 border-indigo-200",
    DELIVERED: "bg-green-100 text-green-800 border-green-200",
    CANCELLED: "bg-red-100 text-red-800 border-red-200",
    LOST: "bg-gray-100 text-gray-800 border-gray-200",
  }
  return map[status]
}

export default function OrdersPage() {
  const [tab, setTab] = useState("dispatch")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<string>("All")
  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")

  // Local state for create/edit flows (start empty; API fills)
  const [dispatches, setDispatches] = useState<DispatchOrder[]>([])
  const [supOrders, setSupOrders] = useState<SupplierOrder[]>([])
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editing, setEditing] = useState<DispatchOrder | null>(null)
  const [isSupplierOpen, setIsSupplierOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierOrder | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>("")
  // Prevent accidental double-submits and show progress
  const [savingOrder, setSavingOrder] = useState(false)
  const [savingSupplier, setSavingSupplier] = useState(false)

  const filtered = useMemo(() => {
    return dispatches.filter((o) => {
      const matchesQ = q ? `${o.requesterType} ${o.requesterName}`.toLowerCase().includes(q.toLowerCase()) : true
      const matchesStatus = status === "All" ? true : o.status === (status as OrderStatus)
      const d = new Date(o.requestedAt).getTime()
      const fromOk = from ? d >= new Date(from).getTime() : true
      const toOk = to ? d <= new Date(to).getTime() : true
      return matchesQ && matchesStatus && fromOk && toOk
    })
  }, [q, status, from, to, dispatches])

  const totals = useMemo(() => {
    const totalQty = dispatches.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0)
    const pending = dispatches.filter((o) => o.status === "PENDING").length
    const deliveryPending = dispatches.filter((o) => o.status === "SHIPPED" || o.status === "PACKED").length
    return { totalQty, pending, deliveryPending }
  }, [dispatches])

  // Initial data fetch once on client
  useEffect(() => {
    fetchDispatches();
    fetchSupplierOrders();
  }, [])

  // Fetch current session (for Created By / Packed By defaults)
  useEffect(() => {
    let cancelled = false;
    import('@/lib/client/cache').then(({ getAuthSessionCached }) =>
      getAuthSessionCached()
        .then((d: any) => {
          if (!cancelled) setCurrentUserName(String(d?.session?.name || d?.session?.username || "").trim())
        })
        .catch(() => {})
    );
    return () => { cancelled = true };
  }, [])

  async function fetchDispatches() {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "All") params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const query = params.toString();
      const url = query ? `/api/orders?${query}` : `/api/orders`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      setDispatches(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setDispatches([]);
    }
  }

  async function fetchSupplierOrders() {
    try {
      const res = await fetch(`/api/supplier-orders`, { cache: "no-store" });
      const data = await res.json();
      setSupOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setSupOrders([]);
    }
  }

  async function startCreate() {
    // Fetch next request number so the field is prefilled in the dialog
    let nextReq = "";
    try {
      const res = await fetch(`/api/orders/next-id`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        nextReq = String(d?.requestNumber || "");
      }
    } catch {}

    const newOrder: DispatchOrder = {
      id: `d-${Date.now()}`,
      requestNumber: nextReq,
      requesterType: "Agent",
      requesterName: "",
      items: [{ bank: "IDFC", classType: "VC4", qty: 10 }],
      packedState: "Pending to Pack",
      dispatchVia: "ST Courier",
      status: "PENDING",
      packedBy: "",
      createdBy: currentUserName || "",
      requestedAt: new Date().toISOString(),
      // Default required date (Shipping Date) to today
      eta: new Date().toISOString(),
    }
    setEditing(newOrder)
    setIsEditOpen(true)
  }

  function startEdit(order: DispatchOrder) {
    setEditing(JSON.parse(JSON.stringify(order)))
    setIsEditOpen(true)
  }

  async function saveDispatch(order: DispatchOrder) {
    if (savingOrder) return;
    setSavingOrder(true);
    try {
      // Decide create vs update solely by persisted numeric id
      const isExisting = typeof order.id === 'number';
      if (isExisting) {
        const id = String(order.id);
        const res = await fetch(`/api/orders/${id}`,
          { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          throw new Error(msg || `Failed to update order #${id}`);
        }
      } else {
        const res = await fetch(`/api/orders`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          throw new Error(msg || 'Failed to create order');
        }
        // const created = await res.json(); // currently unused
      }
      await fetchDispatches();
      setIsEditOpen(false);
      setEditing(null);
    } catch (e: any) {
      console.error(e);
      alert(String(e?.message || e) || 'Failed to save order');
    } finally {
      setSavingOrder(false);
    }
  }

  function startCreateSupplier() {
    const newSup: SupplierOrder = {
      id: `s-${Date.now()}`,
      supplierName: "",
      classType: "VC4",
      qtyOrdered: 0,
      dateOrdered: new Date().toISOString(),
    }
    setEditingSupplier(newSup)
    setIsSupplierOpen(true)
  }

  function startEditSupplier(s: SupplierOrder) {
    setEditingSupplier({ ...s })
    setIsSupplierOpen(true)
  }

  async function saveSupplier(s: SupplierOrder) {
    if (savingSupplier) return;
    setSavingSupplier(true);
    try {
      const isExisting = typeof s.id === 'number';
      if (isExisting) {
        const res = await fetch(`/api/supplier-orders/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
        if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to update supplier order'));
      } else {
        const res = await fetch(`/api/supplier-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
        if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to create supplier order'));
      }
      await fetchSupplierOrders();
      setIsSupplierOpen(false);
      setEditingSupplier(null);
    } catch (e: any) {
      console.error(e);
      alert(String(e?.message || e) || 'Failed to save supplier order');
    } finally {
      setSavingSupplier(false);
    }
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Orders & Logistics</h1>
        <Button onClick={startCreate}>Create New Order</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Qty Required</div>
            <div className="text-2xl font-semibold">{totals.totalQty}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Pending Request</div>
            <div className="text-2xl font-semibold">{totals.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Delivery Pending</div>
            <div className="text-2xl font-semibold">{totals.deliveryPending}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v)=> { setTab(v); if(v==='dispatch'){ fetchDispatches(); } else { fetchSupplierOrders(); } }}>
        <TabsList>
          <TabsTrigger value="dispatch">Requests & Dispatch</TabsTrigger>
          <TabsTrigger value="supplier">Supplier Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="dispatch" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input placeholder="Search (Agent/User)" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="PENDING">PENDING</SelectItem>
                <SelectItem value="PACKED">PACKED</SelectItem>
                <SelectItem value="SHIPPED">SHIPPED</SelectItem>
                <SelectItem value="DELIVERED">DELIVERED</SelectItem>
                <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                <SelectItem value="LOST">LOST</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" placeholder="From" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setQ(""); setStatus("All"); setFrom(""); setTo("") }}>Reset</Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request Number</TableHead>
                  <TableHead>Agent/TL Name</TableHead>
                  <TableHead>Order Details</TableHead>
                  <TableHead>Fulfilled/Packed</TableHead>
                  <TableHead>Dispatch Via</TableHead>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Packed By</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id} className="align-top">
                    <TableCell className="whitespace-nowrap">{o.requestNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{o.requesterName}</div>
                      <div className="text-xs text-muted-foreground">{o.requesterType}</div>
                    </TableCell>
                    <TableCell>
                      {o.items.map((it, idx) => (
                        <div key={idx} className="text-sm">
                          {it.bank} - {it.classType}={it.qty}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      <ul className="list-disc pl-5 text-sm">
                        <li>{o.packedState}</li>
                      </ul>
                    </TableCell>
                    <TableCell>
                      <ul className="list-disc pl-5 text-sm">
                        <li>{o.dispatchVia}</li>
                      </ul>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{o.trackingId || "-"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs ${statusBadge(o.status)}`}>
                        {o.status}
                      </span>
                    </TableCell>
                    <TableCell>{o.packedBy || "-"}</TableCell>
                    <TableCell>{o.createdBy || "-"}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => startEdit(o)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="supplier" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={startCreateSupplier}>Create Supplier Order</Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Qty Ordered</TableHead>
                  <TableHead>Date Ordered</TableHead>
                  <TableHead>Date Received</TableHead>
                  <TableHead>Qty Delivered</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supOrders.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.supplierName}</TableCell>
                    <TableCell>{s.classType}</TableCell>
                    <TableCell>{s.qtyOrdered}</TableCell>
                    <TableCell>{new Date(s.dateOrdered).toLocaleDateString()}</TableCell>
                    <TableCell>{s.dateReceived ? new Date(s.dateReceived).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>{s.qtyDelivered ?? "-"}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => startEditSupplier(s)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dispatch Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing && dispatches.some((d) => d.id === editing.id) ? "Edit Order" : "Create Order"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input value={editing.requestNumber} onChange={(e)=> setEditing({ ...editing, requestNumber: e.target.value })} placeholder="Auto (ORDYYYYMMDD-XX)" />
                <Select value={editing.requesterType} onValueChange={(v: RequesterType)=> setEditing({ ...editing, requesterType: v })}>
                  <SelectTrigger><SelectValue placeholder="Requester Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agent">Agent</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="Toll Agent">Toll Agent</SelectItem>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Shop">Shop</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={editing.requesterName} onChange={(e)=> setEditing({ ...editing, requesterName: e.target.value })} placeholder="Requester Name" />
                {/* Created Date is auto-set on creation; input removed per requirement */}
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Order Items</div>
                {editing.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-2">
                    <Input value={it.bank} onChange={(e)=> {
                      const items = editing.items.slice(); items[idx] = { ...it, bank: e.target.value }; setEditing({ ...editing, items })
                    }} placeholder="Bank" />
                    <Input value={it.classType} onChange={(e)=> {
                      const items = editing.items.slice(); items[idx] = { ...it, classType: e.target.value }; setEditing({ ...editing, items })
                    }} placeholder="Class" />
                    <Input type="number" value={it.qty} onChange={(e)=> {
                      const items = editing.items.slice(); items[idx] = { ...it, qty: Number(e.target.value || 0) }; setEditing({ ...editing, items })
                    }} placeholder="Qty" />
                    <div className="md:col-span-3 flex gap-2">
                      <Button type="button" variant="outline" onClick={()=> {
                        const items = editing.items.slice(); items.splice(idx,1); setEditing({ ...editing, items: items.length ? items : [{ bank: "", classType: "", qty: 0 }] })
                      }}>Remove</Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={()=> setEditing({ ...editing, items: [...editing.items, { bank: "", classType: "", qty: 0 }] })}>Add Item</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select value={editing.packedState} onValueChange={(v: any)=> {
                  const next: DispatchOrder = { ...editing, packedState: v } as DispatchOrder
                  if (v === 'Packed & Ready' && !next.packedBy && currentUserName) {
                    next.packedBy = currentUserName
                  }
                  setEditing(next)
                }}>
                  <SelectTrigger><SelectValue placeholder="Packed State" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending to Pack">Pending to Pack</SelectItem>
                    <SelectItem value="Packed & Ready">Packed & Ready</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={editing.dispatchVia} onValueChange={(v: any)=> setEditing({ ...editing, dispatchVia: v })}>
                  <SelectTrigger><SelectValue placeholder="Dispatch Via" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ST Courier">ST Courier</SelectItem>
                    <SelectItem value="DTDC">DTDC</SelectItem>
                    <SelectItem value="Professional Courier">Professional Courier</SelectItem>
                    <SelectItem value="BUS Driver/Conductor">BUS Driver/Conductor</SelectItem>
                    <SelectItem value="Rapido">Rapido</SelectItem>
                    <SelectItem value="Self delivery">Self delivery</SelectItem>
                    <SelectItem value="Agent Pickup">Agent Pickup</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={editing.trackingId || ""} onChange={(e)=> setEditing({ ...editing, trackingId: e.target.value })} placeholder="Tracking ID" />
                <Select value={editing.status} onValueChange={(v: any)=> {
                  const next: DispatchOrder = { ...editing, status: v } as DispatchOrder
                  if (v === 'PACKED') {
                    if (!next.packedBy && currentUserName) next.packedBy = currentUserName
                    // Set Shipping Date when marked PACKED
                    if (!next.eta) next.eta = new Date().toISOString()
                  }
                  setEditing(next)
                }}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="PACKED">PACKED</SelectItem>
                    <SelectItem value="SHIPPED">SHIPPED</SelectItem>
                    <SelectItem value="DELIVERED">DELIVERED</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                    <SelectItem value="LOST">LOST</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input value={editing.packedBy || ""} onChange={(e)=> setEditing({ ...editing, packedBy: e.target.value })} placeholder="Packed By" />
                <Input value={editing.createdBy || currentUserName || ""} onChange={(e)=> setEditing({ ...editing, createdBy: e.target.value })} placeholder="Created By" />
                {/* Order Date, defaults to today, editable */}
                <Input
                  type="date"
                  required
                  value={(editing.requestedAt || new Date().toISOString()).substring(0,10)}
                  onChange={(e)=> setEditing({ ...editing, requestedAt: new Date(e.target.value).toISOString() })}
                  placeholder="Order Date"
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={()=> { setIsEditOpen(false); setEditing(null) }} disabled={savingOrder}>Cancel</Button>
            {editing && <Button onClick={()=> saveDispatch(editing)} disabled={savingOrder}>{savingOrder ? 'Saving…' : 'Save'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Supplier Order Modal */}
      <Dialog open={isSupplierOpen} onOpenChange={setIsSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier && supOrders.some((x)=> x.id === editingSupplier.id) ? "Edit Supplier Order" : "Create Supplier Order"}</DialogTitle>
          </DialogHeader>
          {editingSupplier && (
            <div className="space-y-3">
              <Input value={editingSupplier.supplierName} onChange={(e)=> setEditingSupplier({ ...editingSupplier, supplierName: e.target.value })} placeholder="Supplier Name" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input value={editingSupplier.classType} onChange={(e)=> setEditingSupplier({ ...editingSupplier, classType: e.target.value })} placeholder="Class Type" />
                <Input type="number" value={editingSupplier.qtyOrdered} onChange={(e)=> setEditingSupplier({ ...editingSupplier, qtyOrdered: Number(e.target.value || 0) })} placeholder="Qty Ordered" />
                <Input type="date" value={editingSupplier.dateOrdered.substring(0,10)} onChange={(e)=> setEditingSupplier({ ...editingSupplier, dateOrdered: new Date(e.target.value).toISOString() })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input type="date" value={editingSupplier.dateReceived ? editingSupplier.dateReceived.substring(0,10) : ""} onChange={(e)=> setEditingSupplier({ ...editingSupplier, dateReceived: e.target.value ? new Date(e.target.value).toISOString() : undefined })} placeholder="Date Received" />
                <Input type="number" value={editingSupplier.qtyDelivered ?? 0} onChange={(e)=> setEditingSupplier({ ...editingSupplier, qtyDelivered: Number(e.target.value || 0) })} placeholder="Qty Delivered" />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={()=> { setIsSupplierOpen(false); setEditingSupplier(null) }} disabled={savingSupplier}>Cancel</Button>
            {editingSupplier && <Button onClick={()=> saveSupplier(editingSupplier)} disabled={savingSupplier}>{savingSupplier ? 'Saving…' : 'Save'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

