"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon, CreditCard, ReceiptText, Car, Clock } from "lucide-react"
import { getUserSession } from "@/lib/actions/auth-actions"
import { getUserDashboardData } from "@/lib/actions/user-actions"

export default function UserDashboardPage() {
  const router = useRouter()
  const [userData, setUserData] = useState({
    name: "",
    vehicleNumber: "",
    activeFastags: 0,
    lastRecharge: { amount: 0, date: "" },
    balance: 0,
    recentTransactions: [],
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSessionAndLoadData = async () => {
      const session = await getUserSession()
      if (!session || session.userType !== "user") {
        router.push("/login")
        return
      }

      try {
        const dashboardData = await getUserDashboardData(session.id)
        setUserData(dashboardData)
      } catch (error) {
        console.error("Failed to fetch user data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSessionAndLoadData()
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
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {userData.name}</h1>
          <p className="text-muted-foreground">Manage your FASTag account and transactions.</p>
        </div>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Welcome to your dashboard!</AlertTitle>
          <AlertDescription>
            You can view your FASTag details, check balance, and manage your account from here.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vehicle Number</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userData.vehicleNumber}</div>
              <p className="text-xs text-muted-foreground">Registered vehicle</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active FASTags</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userData.activeFastags}</div>
              <p className="text-xs text-muted-foreground">FASTags linked to your account</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Recharge</CardTitle>
              <ReceiptText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{userData.lastRecharge.amount}</div>
              <p className="text-xs text-muted-foreground">
                {userData.lastRecharge.date ? new Date(userData.lastRecharge.date).toLocaleDateString() : "N/A"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{userData.balance}</div>
              <p className="text-xs text-muted-foreground">Available balance</p>
            </CardContent>
          </Card>
        </div>

        {/* Additional dashboard content would go here */}
      </div>
    </div>
  )
}
