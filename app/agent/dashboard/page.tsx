"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon, Package, ShoppingCart, TrendingUp, Users } from "lucide-react"
import { getAgentStats } from "@/lib/actions/agent-actions"
import { InventorySummary } from "@/components/agent/inventory-summary"
import { RecentTransactions } from "@/components/agent/recent-transactions"
import { useRouter } from "next/navigation"
import { getAgentSession } from "@/lib/actions/auth-actions"

export default function AgentDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    totalInventory: 0,
    availableFastags: 0,
    totalCustomers: 0,
    monthlySales: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const session = await getAgentSession()
      if (!session) {
        router.push("/agent/login")
        return
      }

      try {
        const agentStats = await getAgentStats()
        setStats(agentStats)
      } catch (error) {
        console.error("Failed to fetch agent stats:", error)
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
          <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
          <p className="text-muted-foreground">Manage your FASTag inventory and track sales.</p>
        </div>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Welcome to your dashboard!</AlertTitle>
          <AlertDescription>
            You can manage your FASTag inventory, track sales, and view customer information from here.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInventory}</div>
              <p className="text-xs text-muted-foreground">Total FASTags in inventory</p>
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

        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inventory">Inventory Summary</TabsTrigger>
            <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          </TabsList>
          <TabsContent value="inventory" className="space-y-4">
            <InventorySummary />
          </TabsContent>
          <TabsContent value="transactions" className="space-y-4">
            <RecentTransactions />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
