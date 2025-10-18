"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

type DayRow = {
  date: string
  open: number
  in_progress: number
  completed: number
  closed: number
  cancelled: number
}

type MetricsResponse = {
  from: string
  to: string
  days: (DayRow & { created: number; hotlisted: number })[]
}

export default function TicketsStatusProgress() {
  const [data, setData] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/reports/tickets/metrics?days=30`, { cache: "no-store" })
        if (!res.ok) throw new Error(await res.text())
        const json = (await res.json()) as MetricsResponse
        if (mounted) setData(json)
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load status metrics")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const chartData = useMemo(() => data?.days || [], [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets by Status (Daily)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="open" name="Open" stackId="a" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.25} />
                <Area type="monotone" dataKey="in_progress" name="In Progress" stackId="a" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
                <Area type="monotone" dataKey="completed" name="Completed" stackId="a" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                <Area type="monotone" dataKey="closed" name="Closed" stackId="a" stroke="#6b7280" fill="#6b7280" fillOpacity={0.25} />
                <Area type="monotone" dataKey="cancelled" name="Cancelled" stackId="a" stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

