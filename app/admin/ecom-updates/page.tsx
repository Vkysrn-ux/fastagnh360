"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type EcomLead = {
  id: number
  name?: string | null
  phone?: string | null
  email?: string | null
  message?: string | null
  source?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  created_at: string
}

type EcomOrder = {
  id: number
  external_order_id?: string | null
  customer_name?: string | null
  phone?: string | null
  email?: string | null
  items_summary?: string | null
  amount?: number | null
  currency?: string | null
  payment_status?: string | null
  payment_provider?: string | null
  created_at: string
}

export default function EcomUpdatesPage() {
  const [tab, setTab] = useState("leads")
  const [leads, setLeads] = useState<EcomLead[]>([])
  const [orders, setOrders] = useState<EcomOrder[]>([])
  const [q, setQ] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(true)

  async function fetchLeads() {
    const res = await fetch(`/api/ecom/leads`, { cache: "no-store" })
    const data = await res.json()
    if (Array.isArray(data)) setLeads(data)
  }
  async function fetchOrders() {
    const res = await fetch(`/api/ecom/orders`, { cache: "no-store" })
    const data = await res.json()
    if (Array.isArray(data)) setOrders(data)
  }

  useEffect(() => {
    if (tab === "leads") fetchLeads(); else fetchOrders();
  }, [tab])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      if (tab === "leads") fetchLeads(); else fetchOrders();
    }, 10000)
    return () => clearInterval(id)
  }, [tab, autoRefresh])

  const filteredLeads = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return leads
    return leads.filter(l => (
      `${l.name||''} ${l.phone||''} ${l.email||''} ${l.message||''} ${l.source||''}`.toLowerCase().includes(qq)
    ))
  }, [q, leads])

  const filteredOrders = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return orders
    return orders.filter(o => (
      `${o.external_order_id||''} ${o.customer_name||''} ${o.phone||''} ${o.email||''} ${o.items_summary||''} ${o.payment_status||''} ${o.payment_provider||''}`.toLowerCase().includes(qq)
    ))
  }, [q, orders])

  const leadToday = useMemo(() => filteredLeads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length, [filteredLeads])
  const orderToday = useMemo(() => filteredOrders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length, [filteredOrders])

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">E-commerce Updates</h1>
        <div className="flex gap-2 items-center">
          <Input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Search" className="w-56" />
          <Button variant="outline" onClick={()=> setAutoRefresh(a=> !a)}>{autoRefresh ? 'Auto-Refresh: On' : 'Auto-Refresh: Off'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Leads Today</div>
            <div className="text-2xl font-semibold">{leadToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Orders Today</div>
            <div className="text-2xl font-semibold">{orderToday}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                    <TableCell>{l.name || '-'}</TableCell>
                    <TableCell>{l.phone || '-'}</TableCell>
                    <TableCell>{l.email || '-'}</TableCell>
                    <TableCell>{l.source || '-'}</TableCell>
                    <TableCell className="max-w-[400px] truncate" title={l.message || ''}>{l.message || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap">{new Date(o.created_at).toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">{o.external_order_id || '-'}</TableCell>
                    <TableCell>{o.customer_name || '-'}</TableCell>
                    <TableCell>{o.phone || '-'}</TableCell>
                    <TableCell>{o.email || '-'}</TableCell>
                    <TableCell className="max-w-[400px] truncate" title={o.items_summary || ''}>{o.items_summary || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{o.amount != null ? `${o.currency || 'INR'} ${o.amount.toFixed(2)}` : '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{o.payment_status || '-'}{o.payment_provider ? ` (${o.payment_provider})` : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

