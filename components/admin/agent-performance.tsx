"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getAgentPerformance } from "@/lib/actions/admin-actions"
import type { AgentPerformanceData } from "@/lib/types"

export function AgentPerformance() {
  const [performance, setPerformance] = useState<AgentPerformanceData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPerformance = async () => {
      try {
        const data = await getAgentPerformance()
        setPerformance(data)
      } catch (error) {
        console.error("Failed to fetch agent performance:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPerformance()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>Performance metrics for your agents.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="animate-pulse text-primary">Loading performance data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Performance</CardTitle>
        <CardDescription>Performance metrics for your agents.</CardDescription>
      </CardHeader>
      <CardContent>
        {performance.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <p className="text-muted-foreground">No performance data available.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-center">FASTags Sold</TableHead>
                  <TableHead className="text-right">Revenue (₹)</TableHead>
                  <TableHead className="text-right">Commission (₹)</TableHead>
                  <TableHead className="text-center">Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performance.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell className="text-center">{agent.fastagsSold}</TableCell>
                    <TableCell className="text-right">{agent.revenue.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{agent.commission.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          agent.performance === "Excellent"
                            ? "outline"
                            : agent.performance === "Good"
                              ? "secondary"
                              : "default"
                        }
                        className={
                          agent.performance === "Excellent"
                            ? "bg-green-50 text-green-700 hover:bg-green-50"
                            : agent.performance === "Good"
                              ? "bg-blue-50 text-blue-700 hover:bg-blue-50"
                              : "bg-amber-50 text-amber-700 hover:bg-amber-50"
                        }
                      >
                        {agent.performance}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
