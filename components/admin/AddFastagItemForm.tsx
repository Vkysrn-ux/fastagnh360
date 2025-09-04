"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function AddFastagItemPage() {
  const [form, setForm] = useState({
    tag_serial: "",
    fastag_class: "class4",
    bank_name: "",
    supplier_id: "",
    purchase_price: "",
    purchase_date: "",
    batch_number: "",
    remarks: ""
  });

  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [banks, setBanks] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadDropdowns = async () => {
      const [supplierRes, bankRes] = await Promise.all([
        fetch("/api/suppliers/all"),
        fetch("/api/banks")
      ]);
      const supplierData = await supplierRes.json();
      const bankData = await bankRes.json();
      setSuppliers(supplierData);
      setBanks(bankData);
    };
    loadDropdowns();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const res = await fetch("/api/fastags/add-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        purchase_price: parseFloat(form.purchase_price)
      })
    });
    const result = await res.json();
    if (result.success) {
      setMessage("✅ FASTag added successfully");
      setForm({
        tag_serial: "",
        fastag_class: "class4",
        bank_name: "",
        supplier_id: "",
        purchase_price: "",
        purchase_date: "",
        batch_number: "",
        remarks: ""
      });
    } else {
      setMessage("❌ " + result.error);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Add Individual FASTag</CardTitle>
        <CardDescription>Enter details for a new FASTag item.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Tag Serial</Label>
          <Input name="tag_serial" value={form.tag_serial} onChange={handleChange} />
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
          <Label>Bank</Label>
          <select name="bank_name" className="w-full border rounded px-2 py-2" value={form.bank_name} onChange={handleChange}>
            <option value="">Select bank</option>
            {banks.map((bank) => (
              <option key={bank} value={bank}>{bank}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Supplier</Label>
          <select
            name="supplier_id"
            className="w-full border rounded px-2 py-2"
            value={form.supplier_id}
            onChange={handleChange}
          >
            <option value="">Select supplier</option>
            {Array.isArray(suppliers) &&
              suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <Label>Purchase Price (₹)</Label>
          <Input type="number" name="purchase_price" value={form.purchase_price} onChange={handleChange} />
        </div>
        <div>
          <Label>Purchase Date</Label>
          <Input type="date" name="purchase_date" value={form.purchase_date} onChange={handleChange} />
        </div>
        <div>
          <Label>Batch Number</Label>
          <Input name="batch_number" value={form.batch_number} onChange={handleChange} />
        </div>
        <div>
          <Label>Remarks</Label>
          <Input name="remarks" value={form.remarks} onChange={handleChange} />
        </div>
        <Button className="w-full" onClick={handleSubmit}>Add FASTag</Button>
        {message && <p className="text-sm text-muted-foreground mt-2">{message}</p>}
      </CardContent>
    </Card>
  );
}
