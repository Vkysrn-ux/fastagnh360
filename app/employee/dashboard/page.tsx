"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoIcon } from "lucide-react"
import { getEmployeeStats } from "@/lib/actions/employee-actions"
import { useRouter } from "next/navigation"
import { getEmployeeSession } from "@/lib/actions/auth-actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DailySales } from "@/components/dashboard/DailySales"
import { PendingAmount } from "@/components/dashboard/PendingAmount"

export default function EmployeeDashboardPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hrUsers, setHrUsers] = useState<any[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)

  useEffect(() => {
    const init = async () => {
      const s = await getEmployeeSession()
      if (!s) {
        router.push("/login")
        return
      }
      setSession(s)
    if ((s.displayRole || '').toLowerCase() === 'accountant/hr') {
      try {
        setLoadingActivity(true)
        const res = await fetch('/api/hr/users-activity')
        const data = await res.json()
        setHrUsers(Array.isArray(data) ? data : [])
      } catch {}
      finally { setLoadingActivity(false) }
    }
      try {
        await getEmployeeStats()
      } finally {
        setIsLoading(false)
      }
    }
    init()
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
          <AlertDescription>
            You can manage FASTags, customers, and orders assigned to you from here.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <DailySales />
          <PendingAmount />
        </div>
      </div>
        {String(session?.displayRole || '').toLowerCase() === 'accountant/hr' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {session?.name || '-'}</div>
                  <div><span className="text-muted-foreground">Email:</span> {session?.email || '-'}</div>
                  <div><span className="text-muted-foreground">Role:</span> {session?.displayRole || session?.role || '-'}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Last Login</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {session?.lastLogin ? new Date(session.lastLogin).toLocaleString() : '�'}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  )
}




