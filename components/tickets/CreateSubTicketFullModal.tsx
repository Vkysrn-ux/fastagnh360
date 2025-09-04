"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ShopAutocomplete from "@/components/ShopAutocomplete";
import AutocompleteInput from "@/components/AutocompleteInput";
import UsersAutocomplete from "@/components/UsersAutocomplete";
import PickupPointAutocomplete from "@/components/PickupPointAutocomplete";

type User = { id: number; name: string };
type Ticket = {
  id: number;
  vehicle_reg_no?: string;
  phone?: string;
  alt_phone?: string | null;
  subject?: string;
  details?: string;
  status?: string;
  assigned_to?: string | number | null;
  lead_received_from?: string | null;
  lead_by?: string | number | null;
  customer_name?: string | null;
  comments?: string | null;
};

export default function CreateSubTicketFullModal({
  parent,
  currentUserId = 1,
  onCreated,
  asButtonClassName,
  label = "Create Sub Ticket",
}: {
  parent: Ticket;
  currentUserId?: number;
  onCreated?: (child: { id: number; ticket_no: string }) => void;
  asButtonClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    vehicle_reg_no: parent.vehicle_reg_no || "",
    phone: parent.phone || "",
    alt_phone: parent.alt_phone || "",
    subject: "",
    details: "",
    status: "open",
    kyv_status: "",
    assigned_to: String(parent.assigned_to ?? ""),
    lead_received_from: parent.lead_received_from || "",
    role_user_id: "",
    lead_by: parent.lead_by ? String(parent.lead_by) : "",
    customer_name: parent.customer_name || "",
    comments: "",
    payment_to_collect: "",
    payment_to_send: "",
    net_value: "",
    pickup_point_name: "",
  });

  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [selectedPickup, setSelectedPickup] = useState<{ id: number; name: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when modal opens
  useEffect(() => {
    if (!open) return;
    setForm({
      vehicle_reg_no: parent.vehicle_reg_no || "",
      phone: parent.phone || "",
      alt_phone: parent.alt_phone || "",
      subject: "",
      details: "",
      status: "open",
      kyv_status: "",
      assigned_to: String(parent.assigned_to ?? ""),
      lead_received_from: parent.lead_received_from || "",
      role_user_id: "",
      lead_by: parent.lead_by ? String(parent.lead_by) : "",
      customer_name: parent.customer_name || "",
      comments: "",
      payment_to_collect: "",
      payment_to_send: "",
      net_value: "",
      pickup_point_name: "",
    });
    setSelectedShop(null);
    setSelectedPickup(null);
    setError(null);
  }, [open, parent]);

  // keep role user id in sync with selected shop
  useEffect(() => {
    setForm((f) => ({ ...f, role_user_id: selectedShop ? String(selectedShop.id) : "" }));
  }, [selectedShop?.id]);

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
    if (val === "" || val === "self") return String(currentUserId);
    if (!isNaN(Number(val))) return String(parseInt(val, 10));
    return "";
  }

  const canSubmit = useMemo(() => form.subject.trim().length > 0, [form.subject]);

  async function submit() {
    if (!canSubmit) {
      setError("Subject is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // If Shop selected, place its id in role_user_id for lead_by mapping
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

      // Use children endpoint to ensure parenting and inheritance behavior
      const res = await fetch(`/api/tickets/${parent.id}/children`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create sub-ticket");

      onCreated?.({ id: data.id, ticket_no: data.ticket_no });
      setOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={asButtonClassName || "text-green-600 hover:underline"}>{label}</button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Sub Ticket for #{parent.id}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block font-semibold mb-1">Vehicle No</label>
            <input
              name="vehicle_reg_no"
              value={form.vehicle_reg_no}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Mobile</label>
            <input name="phone" value={form.phone} onChange={handleChange} className="w-full border p-2 rounded" />
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
              options={["New FASTag","Replacement FASTag","Hotlisted FASTag","KYC Related","Mobile Number Updation","Other"]}
              placeholder="Type subject"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Assigned To</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <UsersAutocomplete
                  value={form.assigned_to ? { id: Number(form.assigned_to), name: "" } : null}
                  onSelect={(u) => setForm((f) => ({ ...f, assigned_to: u ? String(u.id) : "" }))}
                  placeholder="Type user name"
                />
              </div>
              <button type="button" className="px-3 py-2 border rounded" onClick={() => setForm((f) => ({ ...f, assigned_to: String(currentUserId) }))}>Self</button>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Status</label>
            <AutocompleteInput
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              options={["open","processing","kyc_pending","done","waiting","closed","completed"]}
              placeholder="Type status"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">KYV Status</label>
            <AutocompleteInput
              value={form.kyv_status}
              onChange={(v) => setForm((f) => ({ ...f, kyv_status: v }))}
              options={["kyv_pending","kyv_pending_approval","kyv_success","kyv_hotlisted"]}
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

          {/* Payment fields */}
          <div>
            <label className="block font-semibold mb-1">Payment To Be Collected</label>
            <input
              name="payment_to_collect"
              type="number"
              step="0.01"
              value={form.payment_to_collect}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Payment To Be Sent</label>
            <input
              name="payment_to_send"
              type="number"
              step="0.01"
              value={form.payment_to_send}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Net Value</label>
            <input
              name="net_value"
              type="number"
              step="0.01"
              value={form.net_value}
              onChange={handleChange}
              readOnly
              className="w-full border p-2 rounded bg-gray-50"
              placeholder="0.00"
            />
          </div>

          {/* Pickup Point */}
          <div className="lg:col-span-2">
            <label className="block font-semibold mb-1">Pick-up Point</label>
            <PickupPointAutocomplete value={selectedPickup} onSelect={(p) => {
              setSelectedPickup(p);
              setForm((f) => ({ ...f, pickup_point_name: p ? p.name : "" }));
            }} />
            <div className="text-xs text-gray-500 mt-1">Type to search (Agent, Shop, Warehouse)</div>
          </div>

          <div className="lg:col-span-4 md:col-span-2">
            <label className="block font-semibold mb-1">Details</label>
            <textarea name="details" value={form.details} onChange={handleChange} className="w-full border p-2 rounded" rows={3} />
          </div>

          <div className="lg:col-span-4 md:col-span-2">
            <label className="block font-semibold mb-1">Comments</label>
            <input name="comments" value={form.comments} onChange={handleChange} className="w-full border p-2 rounded" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !canSubmit}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
