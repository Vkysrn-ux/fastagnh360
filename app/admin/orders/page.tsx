"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type OrderStatus = "PENDING" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "LOST"
type RequesterType = "Agent" | "User" | "Toll Agent"

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

// Demo dataset. Replace with API integration when backend is ready.
const SEED_DISPATCHES: DispatchOrder[] = [
  {
    id: "1",
    requestNumber: "REQ-24001",
    requesterType: "Agent",
    requesterName: "Ankit Kumar",
    items: [
      { bank: "IDFC", classType: "VC4", qty: 100 },
      { bank: "IDFC", classType: "VC5", qty: 30 },
      { bank: "IDFC", classType: "VC6", qty: 20 },
      { bank: "IDFC", classType: "VC7", qty: 20 },
    ],
    packedState: "Pending to Pack",
    dispatchVia: "DTDC",
    trackingId: "P20545454",
    status: "SHIPPED",
    packedBy: "user/employees",
    createdBy: "user/employees",
    requestedAt: new Date().toISOString(),
  },
  {
    id: "2",
    requestNumber: "REQ-24002",
    requesterType: "Agent",
    requesterName: "SBI TL",
    items: [
      { bank: "SBI", classType: "VC4", qty: 200 },
      { bank: "SBI", classType: "VC12", qty: 50 },
    ],
    packedState: "Packed & Ready",
    dispatchVia: "Self delivery",
    status: "PENDING",
    packedBy: "user/employees",
    createdBy: "user/employees",
    requestedAt: new Date().toISOString(),
  },
]

const SEED_SUPPLIER_ORDERS: SupplierOrder[] = [
  {
    id: "SO-1001",
    supplierName: "Supplier A",
    classType: "VC4",
    qtyOrdered: 500,
    dateOrdered: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    dateReceived: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    qtyDelivered: 500,
  },
  {
    id: "SO-1002",
    supplierName: "Supplier B",
    classType: "VC12",
    qtyOrdered: 300,
    dateOrdered: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
]

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

  // Local state for create/edit flows
  const [dispatches, setDispatches] = useState<DispatchOrder[]>(SEED_DISPATCHES)
  const [supOrders, setSupOrders] = useState<SupplierOrder[]>(SEED_SUPPLIER_ORDERS)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editing, setEditing] = useState<DispatchOrder | null>(null)
  const [isSupplierOpen, setIsSupplierOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierOrder | null>(null)

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

  // Initial data fetch once
  useState(() => { fetchDispatches(); fetchSupplierOrders(); return null })

  async function fetchDispatches() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "All") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/orders?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setDispatches(Array.isArray(data) ? data : []);
  }

  async function fetchSupplierOrders() {
    const res = await fetch(`/api/supplier-orders`, { cache: "no-store" });
    const data = await res.json();
    setSupOrders(Array.isArray(data) ? data : []);
  }

  function startCreate() {
    const newOrder: DispatchOrder = {
      id: `d-${Date.now()}`,
      requestNumber: `REQ-${String(Math.floor(Math.random() * 90000) + 10000)}`,
      requesterType: "Agent",
      requesterName: "",
      items: [{ bank: "IDFC", classType: "VC4", qty: 10 }],
      packedState: "Pending to Pack",
      dispatchVia: "DTDC",
      status: "PENDING",
      packedBy: "",
      createdBy: "",
      requestedAt: new Date().toISOString(),
    }
    setEditing(newOrder)
    setIsEditOpen(true)
  }

  function startEdit(order: DispatchOrder) {
    setEditing(JSON.parse(JSON.stringify(order)))
    setIsEditOpen(true)
  }

  async function saveDispatch(order: DispatchOrder) {
    const isExisting = dispatches.some((d) => String(d.id) === String(order.id) && typeof d.id === "number");
    if (isExisting) {
      const id = String(order.id);
      await fetch(`/api/orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
    } else {
      const res = await fetch(`/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
      const created = await res.json();
      // Replace temp one if present
    }
    await fetchDispatches();
    setIsEditOpen(false);
    setEditing(null);
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
    const isExisting = supOrders.some((x) => String(x.id) === String(s.id) && typeof x.id === "number");
    if (isExisting) {
      await fetch(`/api/supplier-orders/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    } else {
      await fetch(`/api/supplier-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    }
    await fetchSupplierOrders();
    setIsSupplierOpen(false);
    setEditingSupplier(null);
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
                <Input value={editing.requestNumber} onChange={(e)=> setEditing({ ...editing, requestNumber: e.target.value })} placeholder="Request Number" />
                <Select value={editing.requesterType} onValueChange={(v: RequesterType)=> setEditing({ ...editing, requesterType: v })}>
                  <SelectTrigger><SelectValue placeholder="Requester Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agent">Agent</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="Toll Agent">Toll Agent</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={editing.requesterName} onChange={(e)=> setEditing({ ...editing, requesterName: e.target.value })} placeholder="Requester Name" />
                <Input type="date" value={editing.requestedAt.substring(0,10)} onChange={(e)=> setEditing({ ...editing, requestedAt: new Date(e.target.value).toISOString() })} />
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
                <Select value={editing.packedState} onValueChange={(v: any)=> setEditing({ ...editing, packedState: v })}>
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
                <Select value={editing.status} onValueChange={(v: any)=> setEditing({ ...editing, status: v })}>
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
                <Input value={editing.createdBy || ""} onChange={(e)=> setEditing({ ...editing, createdBy: e.target.value })} placeholder="Created By" />
                <Input type="date" value={editing.eta ? editing.eta.substring(0,10) : ""} onChange={(e)=> setEditing({ ...editing, eta: e.target.value ? new Date(e.target.value).toISOString() : undefined })} placeholder="ETA" />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={()=> { setIsEditOpen(false); setEditing(null) }}>Cancel</Button>
            {editing && <Button onClick={()=> saveDispatch(editing)}>Save</Button>}
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
            <Button variant="outline" onClick={()=> { setIsSupplierOpen(false); setEditingSupplier(null) }}>Cancel</Button>
            {editingSupplier && <Button onClick={()=> saveSupplier(editingSupplier)}>Save</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
