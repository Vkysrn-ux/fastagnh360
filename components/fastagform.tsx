'use client';
import React, { useState } from 'react';

export default function FastagForm() {
  const [form, setForm] = useState({ tag_serial: '', supplier_id: '', purchase_date: '', purchase_price: '', remarks: '' });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/fastags', { method: 'POST', body: JSON.stringify(form) });
    // handle response
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="tag_serial" onChange={handleChange} placeholder="Serial" />
      <input name="supplier_id" onChange={handleChange} placeholder="Supplier ID" />
      <input name="purchase_date" type="date" onChange={handleChange} />
      <input name="purchase_price" onChange={handleChange} placeholder="Price" />
      <input name="remarks" onChange={handleChange} placeholder="Remarks" />
      <button type="submit">Add Fastag</button>
    </form>
  );
}
