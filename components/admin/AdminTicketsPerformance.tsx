"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type AdminPerfRow = {
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

export default function AdminTicketsPerformance() {
  const [rows, setRows] = useState<AdminPerfRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/reports/tickets/admin-performance', { cache: 'no-store' })
        if (!res.ok) throw new Error(await res.text())
        const json = await res.json()
        if (mounted) setRows(Array.isArray(json?.admins) ? json.admins : [])
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load admin performance')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Ticket Performance</CardTitle>
        <CardDescription>Created, assigned, and status-wise counts per admin.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex justify-center items-center h-24">
            <div className="animate-pulse text-primary">Loading…</div>
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}
        {!loading && !error && (
          rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No admins found.</div>
          ) : (
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
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{r.name || `User #${r.id}`}</span>
                          {r.email && <span className="text-xs text-muted-foreground">{r.email}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{r.created_count}</TableCell>
                      <TableCell className="text-center">{r.assigned_count}</TableCell>
                      <TableCell className="text-center">{r.open_count}</TableCell>
                      <TableCell className="text-center">{r.in_progress_count}</TableCell>
                      <TableCell className="text-center">{r.completed_count}</TableCell>
                      <TableCell className="text-center">{r.closed_count}</TableCell>
                      <TableCell className="text-center">{r.cancelled_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}

