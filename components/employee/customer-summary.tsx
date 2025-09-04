"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getCustomerSummary } from "@/lib/actions/employee-actions"
import type { CustomerSummaryData } from "@/lib/types"

export function CustomerSummary() {
  const [summary, setSummary] = useState<CustomerSummaryData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await getCustomerSummary()
        setSummary(data)
      } catch (error) {
        console.error("Failed to fetch customer summary:", error)
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
          <CardTitle>Customer Summary</CardTitle>
          <CardDescription>Summary of your customers and their purchases.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="animate-pulse text-primary">Loading customer data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Summary</CardTitle>
        <CardDescription>Summary of your customers and their purchases.</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <p className="text-muted-foreground">No customer data available.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle Number</TableHead>
                  <TableHead>FASTag Type</TableHead>
                  <TableHead className="text-center">Purchase Date</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((customer, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.vehicleNumber}</TableCell>
                    <TableCell>{customer.fastagType}</TableCell>
                    <TableCell className="text-center">
                      {new Date(customer.purchaseDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">{customer.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={customer.status === "Active" ? "outline" : "secondary"}
                        className={
                          customer.status === "Active"
                            ? "bg-green-50 text-green-700 hover:bg-green-50"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-50"
                        }
                      >
                        {customer.status}
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
