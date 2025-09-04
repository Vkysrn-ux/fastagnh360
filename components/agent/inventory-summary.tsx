"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getInventorySummary } from "@/lib/actions/inventory-actions"
import type { InventorySummaryItem } from "@/lib/types"

export function InventorySummary() {
  const [summary, setSummary] = useState<InventorySummaryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await getInventorySummary()
        setSummary(data)
      } catch (error) {
        console.error("Failed to fetch inventory summary:", error)
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
          <CardTitle>Inventory Summary</CardTitle>
          <CardDescription>Summary of your FASTag inventory by bank and type.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="animate-pulse text-primary">Loading summary...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Summary</CardTitle>
        <CardDescription>Summary of your FASTag inventory by bank and type.</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <p className="text-muted-foreground">No inventory data available.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>FASTag Type</TableHead>
                  <TableHead className="text-center">Available</TableHead>
                  <TableHead className="text-right">Price (₹)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.bankName}</TableCell>
                    <TableCell>{item.fastagType}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.price.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={item.quantity > 0 ? "outline" : "destructive"}
                        className={item.quantity > 0 ? "bg-green-50 text-green-700 hover:bg-green-50" : ""}
                      >
                        {item.quantity > 0 ? "In Stock" : "Out of Stock"}
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
