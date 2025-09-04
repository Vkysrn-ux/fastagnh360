"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Edit, Loader2, Plus, Search, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getAgentSession } from "@/lib/actions/auth-actions"
import {
  addInventoryItem,
  deleteInventoryItem,
  getInventory,
  updateInventoryItem,
} from "@/lib/actions/inventory-actions"
import type { InventoryItem } from "@/lib/types"

export default function InventoryPage() {
  const router = useRouter()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [formData, setFormData] = useState({
    bankName: "",
    fastagType: "Car/Jeep/Van",
    quantity: "1",
    price: "",
    batchNumber: "",
  })

  useEffect(() => {
    const checkSessionAndLoadInventory = async () => {
      const session = await getAgentSession()
      if (!session) {
        router.push("/agent/login")
        return
      }

      try {
        const inventoryData = await getInventory()
        setInventory(inventoryData)
      } catch (error) {
        console.error("Failed to fetch inventory:", error)
        setError("Failed to load inventory data. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    checkSessionAndLoadInventory()
  }, [router])

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const newItem = await addInventoryItem({
        ...formData,
        quantity: Number.parseInt(formData.quantity),
        price: Number.parseFloat(formData.price),
      })
      setInventory([...inventory, newItem])
      setIsAddDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Failed to add inventory item:", error)
      setError("Failed to add inventory item. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return

    setIsSubmitting(true)
    setError(null)

    try {
      const updatedItem = await updateInventoryItem(selectedItem.id, {
        ...formData,
        quantity: Number.parseInt(formData.quantity),
        price: Number.parseFloat(formData.price),
      })
      setInventory(inventory.map((item) => (item.id === updatedItem.id ? updatedItem : item)))
      setIsEditDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Failed to update inventory item:", error)
      setError("Failed to update inventory item. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this inventory item?")) return

    try {
      await deleteInventoryItem(id)
      setInventory(inventory.filter((item) => item.id !== id))
    } catch (error) {
      console.error("Failed to delete inventory item:", error)
      setError("Failed to delete inventory item. Please try again.")
    }
  }

  const resetForm = () => {
    setFormData({
      bankName: "",
      fastagType: "Car/Jeep/Van",
      quantity: "1",
      price: "",
      batchNumber: "",
    })
    setSelectedItem(null)
  }

  const openEditDialog = (item: InventoryItem) => {
    setSelectedItem(item)
    setFormData({
      bankName: item.bankName,
      fastagType: item.fastagType,
      quantity: item.quantity.toString(),
      price: item.price.toString(),
      batchNumber: item.batchNumber,
    })
    setIsEditDialogOpen(true)
  }

  const filteredInventory = inventory.filter(
    (item) =>
      item.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.fastagType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-primary">Loading inventory...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
            <p className="text-muted-foreground">Manage your FASTag inventory stock.</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Add New Stock
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New FASTag Stock</DialogTitle>
                <DialogDescription>Add new FASTag inventory to your stock.</DialogDescription>
              </DialogHeader>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Select
                    value={formData.bankName}
                    onValueChange={(value) => setFormData({ ...formData, bankName: value })}
                    required
                  >
                    <SelectTrigger id="bankName">
                      <SelectValue placeholder="Select Bank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HDFC Bank">HDFC Bank</SelectItem>
                      <SelectItem value="ICICI Bank">ICICI Bank</SelectItem>
                      <SelectItem value="SBI">SBI</SelectItem>
                      <SelectItem value="Axis Bank">Axis Bank</SelectItem>
                      <SelectItem value="Paytm Payments Bank">Paytm Payments Bank</SelectItem>
                      <SelectItem value="Kotak Mahindra Bank">Kotak Mahindra Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fastagType">FASTag Type</Label>
                  <Select
                    value={formData.fastagType}
                    onValueChange={(value) => setFormData({ ...formData, fastagType: value })}
                    required
                  >
                    <SelectTrigger id="fastagType">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Car/Jeep/Van">Car/Jeep/Van</SelectItem>
                      <SelectItem value="LCV">LCV (Light Commercial Vehicle)</SelectItem>
                      <SelectItem value="Bus/Truck">Bus/Truck</SelectItem>
                      <SelectItem value="Multi-Axle Vehicle">Multi-Axle Vehicle</SelectItem>
                      <SelectItem value="Oversized Vehicle">Oversized Vehicle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price per Unit (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batchNumber">Batch Number</Label>
                  <Input
                    id="batchNumber"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm()
                      setIsAddDialogOpen(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
                      </>
                    ) : (
                      "Add Stock"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>FASTag Inventory</CardTitle>
            <CardDescription>Manage your available FASTag stock.</CardDescription>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by bank, type, or batch number..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredInventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p className="text-muted-foreground">No inventory items found.</p>
                {searchQuery && (
                  <Button variant="link" onClick={() => setSearchQuery("")}>
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead className="text-right">Price (₹)</TableHead>
                      <TableHead>Batch Number</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.bankName}</TableCell>
                        <TableCell>{item.fastagType}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.price.toLocaleString()}</TableCell>
                        <TableCell>{item.batchNumber}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={item.quantity > 0 ? "outline" : "destructive"}
                            className={item.quantity > 0 ? "bg-green-50 text-green-700 hover:bg-green-50" : ""}
                          >
                            {item.quantity > 0 ? "In Stock" : "Out of Stock"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} title="Edit">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit FASTag Stock</DialogTitle>
            <DialogDescription>Update FASTag inventory details.</DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-bankName">Bank Name</Label>
              <Select
                value={formData.bankName}
                onValueChange={(value) => setFormData({ ...formData, bankName: value })}
                required
              >
                <SelectTrigger id="edit-bankName">
                  <SelectValue placeholder="Select Bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HDFC Bank">HDFC Bank</SelectItem>
                  <SelectItem value="ICICI Bank">ICICI Bank</SelectItem>
                  <SelectItem value="SBI">SBI</SelectItem>
                  <SelectItem value="Axis Bank">Axis Bank</SelectItem>
                  <SelectItem value="Paytm Payments Bank">Paytm Payments Bank</SelectItem>
                  <SelectItem value="Kotak Mahindra Bank">Kotak Mahindra Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fastagType">FASTag Type</Label>
              <Select
                value={formData.fastagType}
                onValueChange={(value) => setFormData({ ...formData, fastagType: value })}
                required
              >
                <SelectTrigger id="edit-fastagType">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Car/Jeep/Van">Car/Jeep/Van</SelectItem>
                  <SelectItem value="LCV">LCV (Light Commercial Vehicle)</SelectItem>
                  <SelectItem value="Bus/Truck">Bus/Truck</SelectItem>
                  <SelectItem value="Multi-Axle Vehicle">Multi-Axle Vehicle</SelectItem>
                  <SelectItem value="Oversized Vehicle">Oversized Vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-quantity">Quantity</Label>
              <Input
                id="edit-quantity"
                type="number"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">Price per Unit (₹)</Label>
              <Input
                id="edit-price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-batchNumber">Batch Number</Label>
              <Input
                id="edit-batchNumber"
                value={formData.batchNumber}
                onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm()
                  setIsEditDialogOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                  </>
                ) : (
                  "Update Stock"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
