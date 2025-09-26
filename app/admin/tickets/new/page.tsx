"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import AutocompleteInput from "@/components/AutocompleteInput";
import UsersAutocomplete, { type UserOption } from "@/components/UsersAutocomplete";
import ShopAutocomplete from "@/components/ShopAutocomplete";
import PickupPointAutocomplete from "@/components/PickupPointAutocomplete";

export default function NewTicketPage() {
  const [message, setMessage] = useState<string | null>(null);

  const initialForm = useMemo(() => ({
    vehicle_reg_no: "",
    phone: "",
    alt_phone: "",
    subject: "ADD new fastag",
    details: "",
    status: "ACTIVATION PENDING",
    kyv_status: "pending",
    assigned_to: "",
    lead_received_from: "",
    role_user_id: "",
    lead_by: "",
    customer_name: "",
    comments: "",
    payment_to_collect: "",
    payment_to_send: "",
    net_value: "",
    pickup_point_name: "",
  }), []);

  const [form, setForm] = useState(initialForm);
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [selectedPickup, setSelectedPickup] = useState<{ id: number; name: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string } | null>(null);
  const [assignedUser, setAssignedUser] = useState<UserOption | null>(null);

  // keep role user id in sync with selected shop
  useEffect(() => {
    setForm((f) => ({ ...f, role_user_id: selectedShop ? String(selectedShop.id) : "" }));
  }, [selectedShop?.id]);

  // load session for Self button and default name
  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const s = data?.session;
        if (s?.id) {
          const me = { id: Number(s.id), name: s.name || 'Me' };
          setCurrentUser(me);
          setAssignedUser(me as any);
          setForm((f) => ({ ...f, assigned_to: String(me.id) }));
        }
      })
      .catch(() => {});
  }, []);

  // auto-calc net value
  useEffect(() => {
    const a = parseFloat(form.payment_to_collect || "");
    const b = parseFloat(form.payment_to_send || "");
    const hasAny = (form.payment_to_collect ?? "") !== "" || (form.payment_to_send ?? "") !== "";
    let sumStr = "";
    if (hasAny) {
      const aNum = isNaN(a) ? 0 : a;
      const bNum = isNaN(b) ? 0 : b;
      sumStr = (aNum + bNum).toFixed(2).replace(/\.00$/, (aNum + bNum) % 1 === 0 ? "" : ".00");
    }
    setForm((f) => (f.net_value === sumStr ? f : { ...f, net_value: sumStr }));
  }, [form.payment_to_collect, form.payment_to_send]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target as any;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function normalizeAssignedTo(val: string) {
    if (val === "" || val === "self") return currentUser ? String(currentUser.id) : "";
    if (!isNaN(Number(val))) return String(parseInt(val, 10));
    return "";
  }

  const canSubmit = useMemo(() => form.subject.trim().length > 0 && form.vehicle_reg_no.trim().length > 0 && form.phone.trim().length > 0, [form.subject, form.vehicle_reg_no, form.phone]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setError("Please fill VRN, Phone and Subject");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const effectiveLeadBy =
        form.lead_received_from === "Shop"
          ? selectedShop?.id || form.lead_by || form.role_user_id || ""
          : form.lead_by || form.role_user_id || "";

      const payload = {
        vehicle_reg_no: form.vehicle_reg_no,
        phone: form.phone,
        alt_phone: form.alt_phone,
        subject: form.subject,
        details: form.details,
        status: form.status,
        kyv_status: form.kyv_status || null,
        assigned_to: normalizeAssignedTo(form.assigned_to),
        lead_received_from: form.lead_received_from,
        lead_by: effectiveLeadBy,
        customer_name: form.customer_name,
        comments: form.comments,
        pickup_point_name: form.pickup_point_name || null,
        payment_to_collect: form.payment_to_collect !== "" ? Number(form.payment_to_collect) : null,
        payment_to_send: form.payment_to_send !== "" ? Number(form.payment_to_send) : null,
        net_value: form.net_value !== "" ? Number(form.net_value) : null,
      };

      const res = await fetch(`/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create ticket");
      setMessage(`Ticket created: #${data.parent_ticket_no || data.ticket_no || data.id}`);
      setForm(initialForm);
      setSelectedShop(null);
      setSelectedPickup(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-screen-2xl mx-auto mt-10 px-8">
      <form className="bg-white rounded-2xl shadow-lg p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" onSubmit={submit}>
        <div>
          <label className="block font-semibold mb-1">Vehicle Reg. No (VRN)</label>
          <input name="vehicle_reg_no" value={form.vehicle_reg_no} onChange={handleChange} className="w-full border p-2 rounded" required />
        </div>
        <div>
          <label className="block font-semibold mb-1">Mobile</label>
          <input name="phone" value={form.phone} onChange={handleChange} className="w-full border p-2 rounded" required />
        </div>
        <div>
          <label className="block font-semibold mb-1">Alt Phone</label>
          <input name="alt_phone" value={form.alt_phone} onChange={handleChange} className="w-full border p-2 rounded" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Subject *</label>
          <AutocompleteInput
            value={form.subject}
            onChange={(v) => setForm((f) => ({ ...f, subject: v }))}
            options={[
              "ADD new fastag",
              "New FASTag",
              "ADD-ON NEWTAG",
              "Replacement FASTag",
              "Hotlisted FASTag",
              "KYC PROCESS",
              "ONLY KYV",
              "ANNUAL PASS",
              "PHONE UPDATE",
              "TAG CLOSING",
              "VRN UPDATE",
              "HOLDER",
              "HOTLIST REMOVING",
              "LOWBALANCE CLEARING",
              "ONLY RECHARGE",
              "OTHER",
            ]}
            placeholder="Type subject"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Assigned To</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <UsersAutocomplete
                value={assignedUser}
                onSelect={(u) => {
                  setAssignedUser(u);
                  setForm((f) => ({ ...f, assigned_to: u ? String(u.id) : "" }));
                }}
                placeholder="Type user name"
              />
            </div>
            <button
              type="button"
              className="px-3 py-2 border rounded"
              onClick={() => {
                if (currentUser) {
                  setAssignedUser({ id: currentUser.id, name: currentUser.name });
                  setForm((f) => ({ ...f, assigned_to: String(currentUser.id) }));
                }
              }}
            >
              Self
            </button>
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">Status</label>
          <AutocompleteInput
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
            options={["ACTIVATION PENDING","ACTIVATED","CUST CANCELLED","CLOSED"]}
            placeholder="Type status"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">KYV Status</label>
          <AutocompleteInput
            value={form.kyv_status}
            onChange={(v) => setForm((f) => ({ ...f, kyv_status: v }))}
            options={["pending","kyv_pending_approval","kyv_success","kyv_hotlisted"]}
            placeholder="Type KYV status"
          />
        </div>

        <div className="lg:col-span-4 md:col-span-2">
          <label className="block font-semibold mb-1">Lead Received From</label>
          <AutocompleteInput
            value={form.lead_received_from}
            onChange={(v) => setForm((f) => ({ ...f, lead_received_from: v }))}
            options={["WhatsApp","Facebook","Social Media","Google Map","Other","Toll-agent","ASM","Shop","Showroom","TL","Manager"]}
            placeholder="Type source"
          />

          {form.lead_received_from === "Shop" && (
            <div className="mt-2">
              <ShopAutocomplete
                value={selectedShop}
                onSelect={(shop) => {
                  setSelectedShop(shop);
                }}
              />
            </div>
          )}
          {["Toll-agent", "ASM", "TL", "Manager"].includes(form.lead_received_from) && (
            <div className="mt-2">
              <UsersAutocomplete
                role={form.lead_received_from}
                value={form.role_user_id ? { id: Number(form.role_user_id), name: "" } : null}
                onSelect={(u) => setForm((f) => ({ ...f, role_user_id: u ? String(u.id) : "" }))}
                placeholder={`Type ${form.lead_received_from} name`}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block font-semibold mb-1">Customer Name</label>
          <input name="customer_name" value={form.customer_name} onChange={handleChange} className="w-full border p-2 rounded" />
        </div>

        <div className="lg:col-span-2">
          <label className="block font-semibold mb-1">Pick-up Point</label>
          <PickupPointAutocomplete value={selectedPickup} onSelect={(p) => {
            setSelectedPickup(p);
            setForm((f) => ({ ...f, pickup_point_name: p ? p.name : "" }));
          }} />
          <div className="text-xs text-gray-500 mt-1">Type to search (Agent, Shop, Warehouse)</div>
        </div>

        <div>
          <label className="block font-semibold mb-1">Payment To Be Collected</label>
          <input name="payment_to_collect" type="number" step="0.01" value={form.payment_to_collect} onChange={handleChange} className="w-full border p-2 rounded" placeholder="0.00" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Payment To Be Sent</label>
          <input name="payment_to_send" type="number" step="0.01" value={form.payment_to_send} onChange={handleChange} className="w-full border p-2 rounded" placeholder="0.00" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Net Value</label>
          <input name="net_value" type="number" step="0.01" value={form.net_value} onChange={handleChange} readOnly className="w-full border p-2 rounded bg-gray-50" placeholder="0.00" />
        </div>

        <div className="lg:col-span-4 md:col-span-2">
          <label className="block font-semibold mb-1">Details</label>
          <textarea name="details" value={form.details} onChange={handleChange} className="w-full border p-2 rounded" rows={3} />
        </div>

        <div className="lg:col-span-4 md:col-span-2">
          <label className="block font-semibold mb-1">Comments</label>
          <input name="comments" value={form.comments} onChange={handleChange} className="w-full border p-2 rounded" />
        </div>

        <div className="lg:col-span-4 md:col-span-2 flex items-center gap-3">
          <Button variant="outline" type="button" onClick={() => setForm(initialForm)} disabled={saving}>Reset</Button>
          <Button type="submit" disabled={saving || !canSubmit}>{saving ? "Creating..." : "Create Ticket"}</Button>
          {error && <span className="text-red-600 text-sm">{error}</span>}
          {message && <span className="text-green-600 text-sm">{message}</span>}
        </div>
      </form>
    </div>
  );
}
