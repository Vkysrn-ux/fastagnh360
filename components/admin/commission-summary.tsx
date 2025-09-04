"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCommissionSummary } from "@/lib/actions/admin-actions"
import type { CommissionSummaryData } from "@/lib/types"

export function CommissionSummary() {
  const [summary, setSummary] = useState<CommissionSummaryData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await getCommissionSummary()
        setSummary(data)
      } catch (error) {
        console.error("Failed to fetch commission summary:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSummary()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Commission Summary</CardTitle>
          <CardDescription>Summary of commissions paid to agents and users.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="animate-pulse text-primary">Loading commission data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission Summary</CardTitle>
        <CardDescription>Summary of commissions paid to agents and users.</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <p className="text-muted-foreground">No commission data available.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>FASTag Type</TableHead>
                  <TableHead className="text-center">Units Sold</TableHead>
                  <TableHead className="text-right">Total Revenue (₹)</TableHead>
                  <TableHead className="text-right">Agent Commission (₹)</TableHead>
                  <TableHead className="text-right">User Commission (₹)</TableHead>
                  <TableHead className="text-right">Net Profit (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((item) => (
                  <TableRow key={item.fastagType}>
                    <TableCell className="font-medium">{item.fastagType}</TableCell>
                    <TableCell className="text-center">{item.unitsSold}</TableCell>
                    <TableCell className="text-right">{item.totalRevenue.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.agentCommission.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.userCommission.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.netProfit.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-center font-bold">
                    {summary.reduce((acc, item) => acc + item.unitsSold, 0)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ₹{summary.reduce((acc, item) => acc + item.totalRevenue, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ₹{summary.reduce((acc, item) => acc + item.agentCommission, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ₹{summary.reduce((acc, item) => acc + item.userCommission, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ₹{summary.reduce((acc, item) => acc + item.netProfit, 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
