import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function ViewAllFastagsModal({ open, onClose }) {
  const [fastags, setFastags] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterBank, setFilterBank] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [searchSerial, setSearchSerial] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/fastags/all")
      .then((res) => res.json())
      .then((data) => setFastags(Array.isArray(data) ? data : []));
    fetch("/api/suppliers/all")
      .then((res) => res.json())
      .then((data) => setSuppliers(Array.isArray(data) ? data : []));
  }, [open]);

  // Unique filter options
  const uniqueBanks = Array.from(new Set(fastags.map((f) => f.bank_name))).filter(Boolean);
  const uniqueTypes = Array.from(new Set(fastags.map((f) => f.fastag_class))).filter(Boolean);
  const uniquePayments = Array.from(new Set(fastags.map((f) => f.purchase_type || f.payment_type))).filter(Boolean);

  // Supplier filter list
  const supplierOptions = suppliers.map((s) => ({ id: s.id, name: s.name }));

  // Show supplier name from id
  function getSupplierName(id) {
    const s = suppliers.find((sup) => String(sup.id) === String(id));
    return s ? s.name : "-";
  }

  // Filter logic
  const filtered = fastags.filter((tag) => {
    return (
      (filterSupplier === "all" || String(tag.supplier_id) === filterSupplier) &&
      (filterPayment === "all" || (tag.purchase_type || tag.payment_type) === filterPayment) &&
      (filterBank === "all" || tag.bank_name === filterBank) &&
      (filterClass === "all" || tag.fastag_class === filterClass) &&
      (searchSerial.trim() === "" ||
        tag.tag_serial.toLowerCase().includes(searchSerial.trim().toLowerCase()))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>All FASTags in Inventory</DialogTitle>
        </DialogHeader>
        <div className="p-2">
          {/* Removed the duplicate <h2> */}
          <div className="flex flex-wrap gap-3 mb-3">
            <Input
              placeholder="Search Serial..."
              value={searchSerial}
              onChange={(e) => setSearchSerial(e.target.value)}
              className="w-56"
            />
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {supplierOptions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment</SelectItem>
                {uniquePayments.map((p) =>
                  p ? (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </SelectItem>
                  ) : null
                )}
              </SelectContent>
            </Select>
            <Select value={filterBank} onValueChange={setFilterBank}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Banks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Banks</SelectItem>
                {uniqueBanks.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto max-h-[60vh] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      No FASTags found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>{tag.tag_serial}</TableCell>
                      <TableCell>{tag.bank_name}</TableCell>
                      <TableCell>{tag.fastag_class}</TableCell>
                      <TableCell>{tag.batch_number}</TableCell>
                      <TableCell>{tag.status}</TableCell>
                      <TableCell>
                        {tag.purchase_date ? tag.purchase_date.slice(0, 10) : "-"}
                      </TableCell>
                      <TableCell>{getSupplierName(tag.supplier_id)}</TableCell>
                      <TableCell>{tag.purchase_type || tag.payment_type || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
