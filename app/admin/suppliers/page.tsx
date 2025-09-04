"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { getAdminSession } from "@/lib/actions/auth-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RegisterSupplierForm from "@/components/admin/RegisterSupplierForm";
import AddFastagPurchaseModal from "@/components/admin/AddFastagPurchaseModal";
import ViewAllFastagsModal from "@/components/admin/ViewAllFastagsModal";
import SupplierFastagSummaryModal from "@/components/admin/SupplierFastagSummaryModal";
import Link from "next/link";

export default function AdminSuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [editSupplier, setEditSupplier] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddFastagModal, setShowAddFastagModal] = useState(false);
  const [showAllFastags, setShowAllFastags] = useState(false);
  const [deleteSupplier, setDeleteSupplier] = useState<any | null>(null);
const [deleteWithData, setDeleteWithData] = useState(false);
const [deleteError, setDeleteError] = useState<string | null>(null);


  // Supplier summary modal
  const [showSupplierSummary, setShowSupplierSummary] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [supplierSummaryData, setSupplierSummaryData] = useState<any | null>(null);

  // Load suppliers
  const loadSuppliers = async () => {
    try {
      const res = await fetch("/api/suppliers/all");
      const data = await res.json();
      if (Array.isArray(data)) setSuppliers(data);
      else setSuppliers([]);
    } catch (err) {
      setSuppliers([]);
      setError("Failed to fetch supplier data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const session = await getAdminSession();
      if (!session) return router.push("/admin/login");
      await loadSuppliers();
    };
    fetchData();
    // eslint-disable-next-line
  }, [router]);

  // Edit supplier
  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editSupplier) return;
    const formData = new FormData(e.currentTarget);
    const updated = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      status: editStatus,
      payment_status: editPaymentStatus,
    };
    const res = await fetch(`/api/suppliers/${editSupplier.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const result = await res.json();
    if (result.success) {
      setEditSupplier(null);
      setEditStatus("");
      setEditPaymentStatus("");
      await loadSuppliers();
    } else {
      alert("Failed to update supplier: " + result.error);
    }
  };

  // Handle supplier row click
  const handleSupplierRowClick = async (supplier: any, event: any) => {
    // Don't open summary if clicking an action button or link
    if ((event.target as HTMLElement).closest("button,a")) return;
    setSelectedSupplier(supplier);
    setShowSupplierSummary(true);
    setSupplierSummaryData(null); // show loading
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}/fastag-summary`);
      const data = await res.json();
      setSupplierSummaryData(data);
    } catch {
      setSupplierSummaryData({ fastags: [] });
    }
  };

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-6">
        {/* Button Bar */}
        <div className="flex items-center justify-end gap-4">
          <Button
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => setShowAllFastags(true)}
          >
            <span role="img" aria-label="View All FASTags">👁️</span> View All FASTags
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setShowAddForm((prev) => !prev)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {showAddForm ? "Close Form" : "Add New Supplier"}
          </Button>
        </div>

        {/* Add Supplier Form */}
        {showAddForm && (
          <div className="mt-4">
            <RegisterSupplierForm />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Supplier List */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier List</CardTitle>
            <CardDescription>
              View and manage all suppliers with payment status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total FASTags</TableHead>
                    <TableHead>Paid FASTags</TableHead>
                    <TableHead>Unpaid FASTags</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow
                      key={supplier.id}
                      onClick={(event) => handleSupplierRowClick(supplier, event)}
                      className="cursor-pointer hover:bg-gray-50 transition"
                    >
                      <TableCell>{supplier.name}</TableCell>
                      <TableCell>{supplier.email}</TableCell>
                      <TableCell>{supplier.phone}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            supplier.status?.toLowerCase() === "active"
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }
                        >
                          {supplier.status || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-gray-50 text-gray-800">
                          {supplier.total_fastag_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {supplier.paid_fastag_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                          {supplier.unpaid_fastag_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          supplier.paid_fastag_count > 0
                            ? "bg-blue-50 text-blue-700"
                            : supplier.unpaid_fastag_count > 0
                            ? "bg-yellow-50 text-yellow-800"
                            : "bg-muted text-muted-foreground"
                        }>
                          {supplier.paid_fastag_count > 0
                            ? "Paid"
                            : supplier.unpaid_fastag_count > 0
                            ? "Unpaid"
                            : "N/A"}
                        </Badge>
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => {
                              setEditSupplier(supplier);
                              setEditStatus(supplier.status);
                              setEditPaymentStatus(supplier.payment_status);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => {
                                  setDeleteSupplier(supplier);
                                  setDeleteWithData(false);
                                  setDeleteError(null);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Add FASTag Purchase"
                            onClick={() => {
                              setSelectedSupplier(supplier);
                              setShowAddFastagModal(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title="View Products"
                          >
                            <Link href={`/admin/suppliers/${supplier.id}/products`}>
                              <span role="img" aria-label="View Products">📦</span>
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Supplier Modal */}
        {editSupplier && (
          <Dialog
            open={true}
            onOpenChange={() => {
              setEditSupplier(null);
              setEditStatus("");
              setEditPaymentStatus("");
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Supplier</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input name="name" defaultValue={editSupplier.name} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input name="email" defaultValue={editSupplier.email} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={editSupplier.phone} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Status</Label>
                  <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="collected">Collected</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Update Supplier
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {deleteSupplier && (
  <Dialog open={true} onOpenChange={() => setDeleteSupplier(null)}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          Remove Supplier: <span className="font-semibold">{deleteSupplier.name}</span>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p>
          Are you sure you want to remove this supplier?
        </p>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="deleteWithData"
            checked={deleteWithData}
            onChange={e => setDeleteWithData(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="deleteWithData" className="text-sm">
            Also delete all FASTags and data related to this supplier
          </label>
        </div>
        {deleteWithData ? (
          <div className="text-red-600 text-xs">
            <strong>Warning:</strong> This will permanently delete the supplier and all their FASTag records. This action cannot be undone!
          </div>
        ) : (
          <div className="text-yellow-600 text-xs">
            Note: You cannot delete a supplier with related data unless you select the above option.
          </div>
        )}
        {deleteError && (
          <div className="text-red-600 text-xs">{deleteError}</div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={() => setDeleteSupplier(null)}>
          Cancel
        </Button>
        <Button
            variant="destructive"
            onClick={async () => {
              setDeleteError(null);
              // Call your API with the option to also delete data
              const res = await fetch(`/api/suppliers/${deleteSupplier.id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ withData: deleteWithData }),
              });
              let result = {};
              try {
                result = await res.json();
              } catch {
                result = { error: "No response from server." };
              }
              if (result.success) {
                setDeleteSupplier(null);
                setDeleteWithData(false);
                await loadSuppliers();
              } else {
                setDeleteError(result.error || "Failed to delete supplier");
              }
            }}
          >
            {deleteWithData ? "Delete Supplier & Data" : "Delete Supplier"}
          </Button>
      </div>
    </DialogContent>
  </Dialog>
)}


        {/* Add FASTag Purchase Modal */}
        {showAddFastagModal && selectedSupplier && (
          <AddFastagPurchaseModal
            open={showAddFastagModal}
            onClose={() => setShowAddFastagModal(false)}
            supplier={selectedSupplier}
            onSaved={loadSuppliers}
          />
        )}

        {/* View All FASTags Modal */}
        <ViewAllFastagsModal open={showAllFastags} onClose={() => setShowAllFastags(false)} />

        {/* Supplier FASTag Summary Modal */}
        <SupplierFastagSummaryModal
          open={showSupplierSummary}
          onClose={() => setShowSupplierSummary(false)}
          supplier={selectedSupplier}
          data={supplierSummaryData}
        />
      </div>
    </div>
  );
}
