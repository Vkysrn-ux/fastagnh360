"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type TicketRow = {
  id: number
  ticket_no: string | null
  created_by: number | null
  created_by_name: string
  customer_name: string | null
  vehicle_reg_no: string | null
  status: string
  reasons: string[]
  created_at: string | null
  updated_at: string | null
}

type ApiResponse = {
  tickets: TicketRow[]
  summary: Record<string, number>
}

export default function AdminPendingReasons() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/reports/tickets/admin-pending-reasons', { cache: 'no-store' })
        if (!res.ok) throw new Error(await res.text())
        const json = await res.json()
        if (mounted) setData(json)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load pending reasons')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const tickets = useMemo(() => data?.tickets ?? [], [data])
  const summary = useMemo(() => data?.summary ?? {}, [data])

  const reasonLabels: Record<string, string> = {
    unassigned: 'Unassigned',
    payment_pending: 'Payment Pending',
    paid_via_missing: 'Paid Via Missing',
    delivery_pending: 'Delivery Pending',
    lead_commission_pending: 'Lead Commission Pending',
    pickup_commission_pending: 'Pickup Commission Pending',
    kyv_pending: 'KYV Pending',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Why Admin-Created Tickets Are Pending</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {Object.entries(summary).map(([key, count]) => (
                <div key={key} className="rounded border p-2 text-center">
                  <div className="text-xs text-muted-foreground">{reasonLabels[key] || key}</div>
                  <div className="text-lg font-semibold">{count}</div>
                </div>
              ))}
              {Object.keys(summary).length === 0 && (
                <div className="text-sm text-muted-foreground">No pending reasons found.</div>
              )}
            </div>

            {tickets.length > 0 && (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reasons</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.ticket_no || `#${t.id}`}</TableCell>
                        <TableCell>{t.created_by_name || (t.created_by ? `User #${t.created_by}` : '')}</TableCell>
                        <TableCell>{t.customer_name || '-'}</TableCell>
                        <TableCell>{t.vehicle_reg_no || '-'}</TableCell>
                        <TableCell className="capitalize">{t.status || 'open'}</TableCell>
                        <TableCell className="text-xs">
                          {t.reasons.map(r => reasonLabels[r] || r).join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

