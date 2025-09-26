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

export default function CreateTicketFullModal({
  onCreated,
  asButtonClassName,
  label = "Create New Ticket",
}: {
  onCreated?: (parent: { id: number; ticket_no?: string }) => void;
  asButtonClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  const initialForm = useMemo(() => ({
    vehicle_reg_no: "",
    phone: "",
    alt_phone: "",
    subject: "",
    details: "",
    status: "open",
    kyv_status: "",
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
    bank_name: "",
    fastag_serial: "",
  }), []);

  const [form, setForm] = useState(initialForm);
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [selectedPickup, setSelectedPickup] = useState<{ id: number; name: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string } | null>(null);
  const [assignedUser, setAssignedUser] = useState<{ id: number; name: string } | null>(null);
  const [banks, setBanks] = useState<string[]>([]);
  const [fastagClass, setFastagClass] = useState<string>("");
  const [fastagSerialInput, setFastagSerialInput] = useState("");
  const [fastagOptions, setFastagOptions] = useState<any[]>([]);
  const [fastagOwner, setFastagOwner] = useState<string>("");
  const [commissionAmount, setCommissionAmount] = useState<string>("0");

  // Reset when modal opens
  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
    setSelectedShop(null);
    setSelectedPickup(null);
    setError(null);
  }, [open, initialForm]);

  // load session for Self id/name
  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const s = data?.session;
        if (s?.id) setCurrentUser({ id: Number(s.id), name: s.name || 'Me' });
      })
      .catch(() => {});
  }, []);

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

  // Load banks
  useEffect(() => {
    fetch('/api/banks')
      .then(r => r.json())
      .then(setBanks)
      .catch(() => setBanks([]));
  }, []);

  // FASTag barcode search
  useEffect(() => {
    const term = fastagSerialInput.trim();
    if (term.length < 2) { setFastagOptions([]); return; }
    const q = new URLSearchParams();
    q.set('query', term);
    if (form.bank_name) q.set('bank', form.bank_name);
    if (fastagClass) q.set('class', fastagClass);
    fetch(`/api/fastags?${q.toString()}`)
      .then(r => r.json())
      .then(rows => setFastagOptions(Array.isArray(rows) ? rows : []))
      .catch(() => setFastagOptions([]));
  }, [fastagSerialInput, form.bank_name, fastagClass]);

  function pickFastag(row: any) {
    setFastagSerialInput(row.tag_serial || "");
    setFastagOwner(row.holder ? String(row.holder) : (row.assigned_to_name || ""));
    setForm((f) => ({ ...f, fastag_serial: row.tag_serial || "" }));
    setFastagOptions([]);
  }

  function normalizeAssignedTo(val: string) {
    if (val === "" || val === "self") return currentUser ? String(currentUser.id) : "";
    if (!isNaN(Number(val))) return String(parseInt(val, 10));
    return "";
  }

  const canSubmit = useMemo(
    () => form.subject.trim().length > 0 && form.vehicle_reg_no.trim().length > 0 && form.phone.trim().length > 0,
    [form.subject, form.vehicle_reg_no, form.phone]
  );

  async function submit() {
    if (!canSubmit) {
      setError("Please fill VRN, Phone and Subject");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const effectiveLeadBy =
        form.lead_received_from === "Shop"
          ? selectedShop?.id || form.lead_by || form.role_user_id || ""
          : form.lead_by || form.role_user_id || "";

      const payload: any = {
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
      if (commissionAmount !== "") payload.commission_amount = Number(commissionAmount) || 0;
      if (form.fastag_serial) payload.fastag_serial = form.fastag_serial;

      const res = await fetch(`/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create ticket");
      const id = Number(data.parent_id || data.id || 0);
      const ticket_no = data.parent_ticket_no || data.ticket_no;
      onCreated?.({ id, ticket_no });
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
        <button className={asButtonClassName || "text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"}>{label}</button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
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
                  value={assignedUser}
                  onSelect={(u) => { setAssignedUser(u as any); setForm((f) => ({ ...f, assigned_to: u ? String(u.id) : "" })); }}
                  placeholder="Type user name"
                />
              </div>
              <button type="button" className="px-3 py-2 border rounded" onClick={() => { if (currentUser) { setAssignedUser(currentUser); setForm((f) => ({ ...f, assigned_to: String(currentUser.id) })); } }}>Self</button>
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

          {/* Row 2 */}
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
          <div>
            <label className="block font-semibold mb-1">Lead Received From</label>
            <AutocompleteInput
              value={form.lead_received_from}
              onChange={(v) => setForm((f) => ({ ...f, lead_received_from: v }))}
              options={["WhatsApp","Facebook","Social Media","Google Map","Other","Toll-agent","ASM","Shop","Showroom","TL","Manager"]}
              placeholder="Type source"
            />
          </div>

          {/* Row 3 */}
          <div>
            <label className="block font-semibold mb-1">Customer Name</label>
            <input name="customer_name" value={form.customer_name} onChange={handleChange} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Pick-up Point</label>
            <PickupPointAutocomplete value={selectedPickup} onSelect={(p) => { setSelectedPickup(p); setForm((f) => ({ ...f, pickup_point_name: p ? p.name : "" })); }} />
            <div className="text-xs text-gray-500 mt-1">Type to search (Agent, Shop, Warehouse)</div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Commission Amount</label>
            <input type="number" step="0.01" value={commissionAmount} onChange={(e) => setCommissionAmount(e.target.value)} className="w-full border p-2 rounded" placeholder="0" />
            <div className="text-xs text-gray-500 mt-1">Defaults to 0 if no commission is due.</div>
          </div>
          <div>
            <label className="block font-semibold mb-1">FASTag Bank</label>
            <select className="w-full border rounded p-2" value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}>
              <option value="">Select bank</option>
              {banks.map((b) => (<option key={b} value={b}>{b}</option>))}
            </select>
          </div>

          {/* Row 4 */}
          <div>
            <label className="block font-semibold mb-1">FASTag Class</label>
            <select className="w-full border rounded p-2" value={fastagClass} onChange={(e) => setFastagClass(e.target.value)}>
              <option value="">Select bank first</option>
              <option value="class4">Class 4 (Car/Jeep/Van)</option>
              <option value="class5">Class 5 (LCV)</option>
              <option value="class6">Class 6 (Bus/Truck)</option>
              <option value="class7">Class 7 (Multi-Axle)</option>
              <option value="class12">Class 12 (Oversize)</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block font-semibold mb-1">FASTag Barcode</label>
            <input value={fastagSerialInput} onChange={(e) => setFastagSerialInput(e.target.value)} className="w-full border p-2 rounded" placeholder="Type FASTag barcode" />
            <div className="text-xs text-gray-500 mt-1">Type at least two characters to search for a FASTag barcode.</div>
            {fastagOptions.length > 0 && (
              <div className="mt-1 max-h-40 overflow-auto border rounded">
                {fastagOptions.map((row) => (
                  <div key={row.id} className="px-3 py-2 cursor-pointer hover:bg-orange-50 border-b last:border-b-0" onMouseDown={() => pickFastag(row)}>
                    {row.tag_serial} — {row.bank_name} / {row.fastag_class}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block font-semibold mb-1">FASTag Owner</label>
            <input value={fastagOwner} readOnly className="w-full border p-2 rounded bg-gray-50" placeholder="Owner appears after picking" />
            <div className="text-xs text-gray-500 mt-1">Select a result to fill the barcode and owner details.</div>
          </div>

          {/* Details full width */}
          <div className="lg:col-span-4 md:col-span-2">
            <label className="block font-semibold mb-1">Details</label>
            <textarea name="details" value={form.details} onChange={handleChange} className="w-full border p-2 rounded" rows={3} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !canSubmit}>
            {saving ? "Creating..." : "Create Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
