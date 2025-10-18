"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type AdminSummary = {
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

type SummaryResponse = { admins: AdminSummary[] }

type TicketRow = {
  id: number
  ticket_no: string | null
  customer_name: string | null
  vehicle_reg_no: string | null
  status: string
  reasons: string[]
  days_open?: number
}

const reasonLabels: Record<string, string> = {
  unassigned: 'Unassigned',
  payment_pending: 'Payment Pending',
  paid_via_missing: 'Paid Via Missing',
  delivery_pending: 'Delivery Pending',
  lead_commission_pending: 'Lead Commission Pending',
  pickup_commission_pending: 'Pickup Commission Pending',
  kyv_pending: 'KYV Pending',
}

function ReasonPill({ label, count }: { label: string, count: number }) {
  return (
    <div className="px-2 py-1 rounded border text-xs flex items-center justify-between">
      <span className="text-muted-foreground mr-2">{label}</span>
      <span className="font-semibold">{count}</span>
    </div>
  )
}

export default function AdminPendingSummary() {
  const [data, setData] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openAdminId, setOpenAdminId] = useState<number | null>(null)
  const [details, setDetails] = useState<Record<number, TicketRow[]>>({})
  const [loadingDetail, setLoadingDetail] = useState<Record<number, boolean>>({})

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/reports/tickets/admin-pending-summary', { cache: 'no-store' })
        if (!res.ok) throw new Error(await res.text())
        const json = await res.json() as SummaryResponse
        if (mounted) setData(json)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load summary')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const admins = useMemo(() => data?.admins ?? [], [data])

  const toggleDetails = useCallback(async (adminId: number) => {
    setOpenAdminId(prev => prev === adminId ? null : adminId)
    if (!details[adminId]) {
      setLoadingDetail(prev => ({ ...prev, [adminId]: true }))
      try {
        const res = await fetch(`/api/reports/tickets/admin-pending-reasons?admin_id=${adminId}`, { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json()
          setDetails(prev => ({ ...prev, [adminId]: (json?.tickets || []).slice(0, 20) }))
        }
      } finally {
        setLoadingDetail(prev => ({ ...prev, [adminId]: false }))
      }
    }
  }, [details])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Reasons by Admin (Open)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && (
          admins.length === 0 ? (
            <div className="text-sm text-muted-foreground">No admin-created open tickets.</div>
          ) : (
            <div className="space-y-4">
              {admins.map(a => (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium">{a.name || `User #${a.id}`}</div>
                      {a.email && <div className="text-xs text-muted-foreground">{a.email}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm"><span className="text-muted-foreground">Total Open:</span> <span className="font-semibold">{a.total_open}</span></div>
                      <div className="text-xs text-muted-foreground">Avg Days Open: <span className="font-semibold text-foreground">{Math.round(a.avg_days_open)}</span></div>
                      <div className="text-xs text-muted-foreground">Max Days: <span className="font-semibold text-foreground">{a.max_days_open}</span></div>
                      <Button variant="outline" size="sm" onClick={() => toggleDetails(a.id)}>
                        {openAdminId === a.id ? 'Hide' : 'View'} tickets
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    <ReasonPill label={reasonLabels.unassigned} count={a.unassigned} />
                    <ReasonPill label={reasonLabels.payment_pending} count={a.payment_pending} />
                    <ReasonPill label={reasonLabels.paid_via_missing} count={a.paid_via_missing} />
                    <ReasonPill label={reasonLabels.delivery_pending} count={a.delivery_pending} />
                    <ReasonPill label={reasonLabels.lead_commission_pending} count={a.lead_commission_pending} />
                    <ReasonPill label={reasonLabels.pickup_commission_pending} count={a.pickup_commission_pending} />
                    <ReasonPill label={reasonLabels.kyv_pending} count={a.kyv_pending} />
                  </div>
                  {openAdminId === a.id && (
                    <div className="mt-3">
                      {loadingDetail[a.id] ? (
                        <div className="text-xs text-muted-foreground">Loading tickets…</div>
                      ) : (
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ticket</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Vehicle</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Days Open</TableHead>
                                <TableHead>Reasons</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(details[a.id] || []).map(t => (
                                <TableRow key={t.id}>
                                  <TableCell className="font-medium">{t.ticket_no || `#${t.id}`}</TableCell>
                                  <TableCell>{t.customer_name || '-'}</TableCell>
                                  <TableCell>{t.vehicle_reg_no || '-'}</TableCell>
                                  <TableCell className="capitalize">{t.status || 'open'}</TableCell>
                                  <TableCell>{typeof t.days_open === 'number' ? t.days_open : '-'}</TableCell>
                                  <TableCell className="text-xs">{t.reasons.map(r => reasonLabels[r] || r).join(', ')}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
