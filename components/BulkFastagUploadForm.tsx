"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function BulkFastagUploadForm() {
  const [form, setForm] = useState({
    serial_from: "",
    serial_to: "",
    supplier_id: "",
    purchase_date: "",
    purchase_price: "",
    bank_name: "",
    fastag_class: "class4",
    batch_number: "",
    remarks: ""
  });
  const [message, setMessage] = useState("");
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [banks, setBanks] = useState<string[]>([]);

  useEffect(() => {
  const loadData = async () => {
    try {
      const [supplierRes, bankRes] = await Promise.all([
        fetch("/api/suppliers/all"),
        fetch("/api/banks")
      ]);
      const supplierData = await supplierRes.json();
      const bankData = await bankRes.json();

      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setBanks(Array.isArray(bankData) ? bankData : []);
    } catch (err) {
      console.error("Error loading dropdown data:", err);
      setSuppliers([]);
      setBanks([]);
    }
  };
  loadData();
}, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleUpload = async () => {
    const res = await fetch("/api/fastags/bulk-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        serial_from: parseInt(form.serial_from),
        serial_to: parseInt(form.serial_to),
        purchase_price: parseFloat(form.purchase_price)
      })
    });

    const result = await res.json();
    if (result.success) {
      setMessage(`✅ Uploaded ${result.count} FASTags`);
    } else {
      setMessage(`❌ ${result.error}`);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Bulk FASTag Upload</CardTitle>
        <CardDescription>Enter full FASTag info to upload a batch.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>From Serial</Label>
            <Input name="serial_from" value={form.serial_from} onChange={handleChange} />
          </div>
          <div>
            <Label>To Serial</Label>
            <Input name="serial_to" value={form.serial_to} onChange={handleChange} />
          </div>
          <div>
            <Label>Supplier</Label>
            <select name="supplier_id" className="w-full border rounded px-2 py-2" value={form.supplier_id} onChange={handleChange}>
              <option value="">Select supplier</option>
                  {Array.isArray(suppliers) &&
                      suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
            </select>
          </div>
          <div>
            <Label>Purchase Date</Label>
            <Input type="date" name="purchase_date" value={form.purchase_date} onChange={handleChange} />
          </div>
          <div>
            <Label>Purchase Price (₹)</Label>
            <Input type="number" name="purchase_price" value={form.purchase_price} onChange={handleChange} />
          </div>
          <div>
            <Label>Bank Name</Label>
            <select name="bank_name" className="w-full border rounded px-2 py-2" value={form.bank_name} onChange={handleChange}>
              <option value="">Select bank</option>
              {Array.isArray(banks) &&
                  banks.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                ))}
            </select>
          </div>
          <div>
            <Label>FASTag Class</Label>
            <select name="fastag_class" className="w-full border rounded px-2 py-2" value={form.fastag_class} onChange={handleChange}>
              <option value="class4">Class 4 (Car/Jeep/Van)</option>
              <option value="class5">Class 5 (LCV)</option>
              <option value="class6">Class 6 (Bus/Truck)</option>
              <option value="class7">Class 7 (Multi-Axle)</option>
              <option value="class12">Class 12 (Oversize)</option>
            </select>
          </div>
          <div>
            <Label>Batch Number</Label>
            <Input name="batch_number" value={form.batch_number} onChange={handleChange} />
          </div>
        </div>

        <div>
          <Label>Remarks (optional)</Label>
          <Input name="remarks" value={form.remarks} onChange={handleChange} />
        </div>

        <Button className="w-full" onClick={handleUpload}>Upload FASTags</Button>

        {message && <p className="text-sm text-muted-foreground mt-2">{message}</p>}
      </CardContent>
    </Card>
  );
}
