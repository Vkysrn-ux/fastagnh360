"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, Save } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getAdminSession } from "@/lib/actions/auth-actions"
import { getCommissionSettings, updateCommissionSettings } from "@/lib/actions/admin-actions"
import type { CommissionSettings } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminCommissionsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<CommissionSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const checkSessionAndLoadSettings = async () => {
      const session = await getAdminSession()
      if (!session) {
        router.push("/admin/login")
        return
      }

      try {
        const commissionData = await getCommissionSettings()
        setSettings(commissionData)
      } catch (error) {
        console.error("Failed to fetch commission settings:", error)
        setError("Failed to load commission settings. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    checkSessionAndLoadSettings()
  }, [router])

  const handleAgentCommissionChange = (fastagType: string, value: string) => {
    if (!settings) return

    const newSettings = { ...settings }
    const numValue = Number.parseFloat(value)

    if (isNaN(numValue) || numValue < 0 || numValue > 100) return

    newSettings.agentCommissions = newSettings.agentCommissions.map((commission) =>
      commission.fastagType === fastagType ? { ...commission, rate: numValue } : commission,
    )

    setSettings(newSettings)
  }

  const handleUserCommissionChange = (fastagType: string, value: string) => {
    if (!settings) return

    const newSettings = { ...settings }
    const numValue = Number.parseFloat(value)

    if (isNaN(numValue) || numValue < 0 || numValue > 100) return

    newSettings.userCommissions = newSettings.userCommissions.map((commission) =>
      commission.fastagType === fastagType ? { ...commission, rate: numValue } : commission,
    )

    setSettings(newSettings)
  }

  const handleDefaultCommissionChange = (type: "agent" | "user", value: string) => {
    if (!settings) return

    const newSettings = { ...settings }
    const numValue = Number.parseFloat(value)

    if (isNaN(numValue) || numValue < 0 || numValue > 100) return

    if (type === "agent") {
      newSettings.defaultAgentCommission = numValue
    } else {
      newSettings.defaultUserCommission = numValue
    }

    setSettings(newSettings)
  }

  const handleSaveSettings = async () => {
    if (!settings) return

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await updateCommissionSettings(settings)
      setSuccess("Commission settings saved successfully!")
    } catch (error) {
      console.error("Failed to save commission settings:", error)
      setError("Failed to save commission settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-primary">Loading commission settings...</div>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="container py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load commission settings. Please refresh the page.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Commission Settings</h1>
            <p className="text-muted-foreground">Manage commission rates for agents and users.</p>
          </div>
          <Button className="w-full sm:w-auto" onClick={handleSaveSettings} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="agent" className="space-y-4">
          <TabsList>
            <TabsTrigger value="agent">Agent Commissions</TabsTrigger>
            <TabsTrigger value="user">User Commissions</TabsTrigger>
          </TabsList>

          <TabsContent value="agent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Agent Commission Rates</CardTitle>
                <CardDescription>Set commission rates for agents by FASTag type.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="defaultAgentCommission" className="text-sm font-medium">
                        Default Agent Commission Rate (%)
                      </label>
                      <Input
                        id="defaultAgentCommission"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={settings.defaultAgentCommission}
                        onChange={(e) => handleDefaultCommissionChange("agent", e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        This rate applies to all new agents and FASTag types without specific rates.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border mt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>FASTag Type</TableHead>
                          <TableHead>Commission Rate (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settings.agentCommissions.map((commission) => (
                          <TableRow key={commission.fastagType}>
                            <TableCell className="font-medium">{commission.fastagType}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={commission.rate}
                                onChange={(e) => handleAgentCommissionChange(commission.fastagType, e.target.value)}
                                className="w-32"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="user" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Commission Rates</CardTitle>
                <CardDescription>Set commission rates for individual users by FASTag type.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="defaultUserCommission" className="text-sm font-medium">
                        Default User Commission Rate (%)
                      </label>
                      <Input
                        id="defaultUserCommission"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={settings.defaultUserCommission}
                        onChange={(e) => handleDefaultCommissionChange("user", e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        This rate applies to all new users and FASTag types without specific rates.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border mt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>FASTag Type</TableHead>
                          <TableHead>Commission Rate (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settings.userCommissions.map((commission) => (
                          <TableRow key={commission.fastagType}>
                            <TableCell className="font-medium">{commission.fastagType}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={commission.rate}
                                onChange={(e) => handleUserCommissionChange(commission.fastagType, e.target.value)}
                                className="w-32"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
