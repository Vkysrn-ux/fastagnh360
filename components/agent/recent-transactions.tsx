"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getRecentTransactions } from "@/lib/actions/transaction-actions"
import type { Transaction } from "@/lib/types"

export function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        const data = await getRecentTransactions()
        setTransactions(data)
      } catch (error) {
        console.error("Failed to fetch recent transactions:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTransactions()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your most recent FASTag sales and transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="animate-pulse text-primary">Loading transactions...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Your most recent FASTag sales and transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <p className="text-muted-foreground">No recent transactions available.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>FASTag Details</TableHead>
                  <TableHead className="text-center">Date</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.id.substring(0, 8)}</TableCell>
                    <TableCell>{transaction.customerName}</TableCell>
                    <TableCell>
                      {transaction.bankName} - {transaction.fastagType}
                    </TableCell>
                    <TableCell className="text-center">{new Date(transaction.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{transaction.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={transaction.status === "Completed" ? "outline" : "secondary"}
                        className={
                          transaction.status === "Completed"
                            ? "bg-green-50 text-green-700 hover:bg-green-50"
                            : transaction.status === "Pending"
                              ? "bg-amber-50 text-amber-700 hover:bg-amber-50"
                              : "bg-red-50 text-red-700 hover:bg-red-50"
                        }
                      >
                        {transaction.status}
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
