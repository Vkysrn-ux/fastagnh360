"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon, Package, ShoppingCart, TrendingUp, Users } from "lucide-react"
import { getEmployeeStats } from "@/lib/actions/employee-actions"
import { useRouter } from "next/navigation"
import { getEmployeeSession } from "@/lib/actions/auth-actions"
import { RecentTransactions } from "@/components/agent/recent-transactions"
import { CustomerSummary } from "@/components/employee/customer-summary"

export default function EmployeeDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    assignedFastags: 0,
    availableFastags: 0,
    totalCustomers: 0,
    monthlySales: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const session = await getEmployeeSession()
      if (!session) {
        router.push("/employee/login")
        return
      }

      try {
        const employeeStats = await getEmployeeStats()
        setStats(employeeStats)
      } catch (error) {
        console.error("Failed to fetch employee stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [router])

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-primary">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Dashboard</h1>
          <p className="text-muted-foreground">Manage your FASTag operations.</p>
        </div>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Welcome to the employee dashboard!</AlertTitle>
          <AlertDescription>You can manage FASTags, customers, and orders assigned to you from here.</AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned FASTags</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.assignedFastags}</div>
              <p className="text-xs text-muted-foreground">Total FASTags assigned</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available FASTags</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.availableFastags}</div>
              <p className="text-xs text-muted-foreground">FASTags available for sale</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">Customers served</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Sales</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.monthlySales.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Sales this month</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
            <TabsTrigger value="customers">Customer Summary</TabsTrigger>
          </TabsList>
          <TabsContent value="transactions" className="space-y-4">
            <RecentTransactions />
          </TabsContent>
          <TabsContent value="customers" className="space-y-4">
            <CustomerSummary />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
