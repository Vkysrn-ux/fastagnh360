"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

type MetricsResponse = {
  from: string
  to: string
  days: { date: string; created: number; hotlisted: number }[]
}

export default function TicketsProgress() {
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
        if (mounted) setError(e?.message || "Failed to load metrics")
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
        <CardTitle>Tickets Progress (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-muted-foreground">Loading metrics…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" name="Created" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="hotlisted" name="Hotlisted (KYV)" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

