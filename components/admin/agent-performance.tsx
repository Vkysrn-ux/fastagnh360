"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

type AdminPerf = {
  id: number
  name: string
  email: string | null
  created_count: number
  assigned_count: number
  open_count: number
  in_progress_count: number
  completed_count: number
  closed_count: number
  cancelled_count: number
}

type PendingSummary = {
  id: number
  name: string
  email: string | null
  total_open: number
  avg_days_open: number
  max_days_open: number
  unassigned: number
  payment_pending: number
  paid_via_missing: number
  delivery_pending: number
  lead_commission_pending: number
  pickup_commission_pending: number
  kyv_pending: number
}

export function AgentPerformance() {
  const [admins, setAdmins] = useState<AdminPerf[]>([])
  const [summary, setSummary] = useState<PendingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [p1, p2] = await Promise.all([
          fetch('/api/reports/tickets/admin-performance', { cache: 'no-store' }),
          fetch('/api/reports/tickets/admin-pending-summary', { cache: 'no-store' }),
        ])
        if (!p1.ok) throw new Error(await p1.text())
        if (!p2.ok) throw new Error(await p2.text())
        const j1 = await p1.json()
        const j2 = await p2.json()
        if (mounted) {
          setAdmins(Array.isArray(j1?.admins) ? j1.admins : [])
          setSummary(Array.isArray(j2?.admins) ? j2.admins : [])
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load admin performance')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const statusChartData = useMemo(() => {
    return admins.map(a => ({
      name: a.name || `#${a.id}`,
      Open: a.open_count,
      InProgress: a.in_progress_count,
      Completed: a.completed_count,
      Closed: a.closed_count,
      Cancelled: a.cancelled_count,
    }))
  }, [admins])

  const reasonsChartData = useMemo(() => {
    return summary.map(a => ({
      name: a.name || `#${a.id}`,
      Unassigned: a.unassigned,
      Payment: a.payment_pending,
      PaidVia: a.paid_via_missing,
      Delivery: a.delivery_pending,
      Lead: a.lead_commission_pending,
      Pickup: a.pickup_commission_pending,
      KYV: a.kyv_pending,
    }))
  }, [summary])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admins Performance</CardTitle>
        <CardDescription>Ticket metrics per admin with status and reason breakdowns.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading && (
          <div className="flex justify-center items-center h-32">
            <div className="animate-pulse text-primary">Loading…</div>
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}

        {!loading && !error && (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead className="text-center">Created</TableHead>
                    <TableHead className="text-center">Assigned</TableHead>
                    <TableHead className="text-center">Open</TableHead>
                    <TableHead className="text-center">In Progress</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-center">Closed</TableHead>
                    <TableHead className="text-center">Cancelled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-center">{a.created_count}</TableCell>
                      <TableCell className="text-center">{a.assigned_count}</TableCell>
                      <TableCell className="text-center">{a.open_count}</TableCell>
                      <TableCell className="text-center">{a.in_progress_count}</TableCell>
                      <TableCell className="text-center">{a.completed_count}</TableCell>
                      <TableCell className="text-center">{a.closed_count}</TableCell>
                      <TableCell className="text-center">{a.cancelled_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tickets by Status (per Admin)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer>
                      <BarChart data={statusChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Open" fill="#0ea5e9" />
                        <Bar dataKey="InProgress" fill="#f59e0b" />
                        <Bar dataKey="Completed" fill="#10b981" />
                        <Bar dataKey="Closed" fill="#6b7280" />
                        <Bar dataKey="Cancelled" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pending Reasons (per Admin)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer>
                      <BarChart data={reasonsChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Unassigned" stackId="a" fill="#64748b" />
                        <Bar dataKey="Payment" stackId="a" fill="#2563eb" />
                        <Bar dataKey="PaidVia" stackId="a" fill="#22c55e" />
                        <Bar dataKey="Delivery" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="Lead" stackId="a" fill="#8b5cf6" />
                        <Bar dataKey="Pickup" stackId="a" fill="#06b6d4" />
                        <Bar dataKey="KYV" stackId="a" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

