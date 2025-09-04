// components/admin/RegisterSupplierForm.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterSupplierForm() {
  const [form, setForm] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: ""
  });

  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const res = await fetch("/api/suppliers/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    const result = await res.json();
    if (result.success) {
      setMessage("✅ Supplier added successfully");
      setForm({ name: "", contact_person: "", email: "", phone: "", address: "" });
    } else {
      setMessage("❌ " + result.error);
    }
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Add New Supplier</CardTitle>
        <CardDescription>Enter the supplier's information below.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input name="name" value={form.name} onChange={handleChange} />
        </div>
        <div>
          <Label>Contact Person</Label>
          <Input name="contact_person" value={form.contact_person} onChange={handleChange} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" name="email" value={form.email} onChange={handleChange} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input name="phone" value={form.phone} onChange={handleChange} />
        </div>
        <div>
          <Label>Address</Label>
          <Input name="address" value={form.address} onChange={handleChange} />
        </div>
        <Button className="w-full" onClick={handleSubmit}>Add Supplier</Button>
        {message && <p className="text-sm text-muted-foreground mt-2">{message}</p>}
      </CardContent>
    </Card>
  );
}
