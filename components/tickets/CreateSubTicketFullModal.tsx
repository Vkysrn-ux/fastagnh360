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
  // Local draft key
  const draftKey = useMemo(() => `nh360:draft:subticket:${parent?.id ?? 'unknown'}`, [parent?.id]);

  const initialForm = useMemo(() => ({
    vehicle_reg_no: parent?.vehicle_reg_no || "",
    phone: parent?.phone || "",
    alt_phone: parent?.alt_phone || "",
    subject: "ADD new fastag",
    details: "",
    status: "ACTIVATION PENDING",
    kyv_status: "pending",
    assigned_to: parent?.assigned_to ? String(parent.assigned_to) : "",
    lead_received_from: parent?.lead_received_from || "",
    role_user_id: "",
    lead_by: parent?.lead_by ? String(parent.lead_by) : "",
    customer_name: parent?.customer_name || "",
    comments: "",
    payment_to_collect: "",
    payment_to_send: "",
    net_value: "",
    pickup_point_name: "",
  }), [parent]);

  const [form, setForm] = useState(initialForm);

  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [selectedPickup, setSelectedPickup] = useState<{ id: number; name: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedUser, setAssignedUser] = useState<{ id: number; name: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string } | null>(null);
  const [banks, setBanks] = useState<string[]>([]);
  const [fastagClass, setFastagClass] = useState<string>("class4");
  const [fastagSerialInput, setFastagSerialInput] = useState("");
  const [fastagOptions, setFastagOptions] = useState<any[]>([]);
  const [fastagOwner, setFastagOwner] = useState<string>("");
  const [commissionAmount, setCommissionAmount] = useState<string>("0");
  const [paymentReceived, setPaymentReceived] = useState<boolean>(false);
  const [deliveryDone, setDeliveryDone] = useState<boolean>(false);
  const [commissionDone, setCommissionDone] = useState<boolean>(false);
  const [selectedUserNotes, setSelectedUserNotes] = useState<string>("");
  const [pickupNotes, setPickupNotes] = useState<string>("");
  const [shopNotes, setShopNotes] = useState<string>("");
  const paidViaOptions = [
    'Pending',
    'Paytm QR',
    'GPay Box',
    'IDFC Box',
    'Cash',
    'Sriram Gpay',
    'Lakshman Gpay',
    'Arjunan Gpay',
    'Vishnu GPay',
    'Vimal GPay',
  ];
  const [paidVia, setPaidVia] = useState<string>('Pending');

  // Reset when modal opens (apply desired defaults)
  useEffect(() => {
    if (!open) return;
    // Try load draft first
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const data = JSON.parse(raw || '{}');
        setForm((prev) => ({ ...prev, ...(data.form || {}) }));
        if (data.selectedShop) setSelectedShop(data.selectedShop);
        if (data.selectedPickup) setSelectedPickup(data.selectedPickup);
        if (typeof data.fastagClass === 'string') setFastagClass(data.fastagClass);
        if (typeof data.fastagSerialInput === 'string') setFastagSerialInput(data.fastagSerialInput);
        if (typeof data.commissionAmount === 'string') setCommissionAmount(data.commissionAmount);
        if (typeof data.paidVia === 'string') setPaidVia(data.paidVia);
        if (typeof data.paymentReceived === 'boolean') setPaymentReceived(data.paymentReceived);
        if (typeof data.deliveryDone === 'boolean') setDeliveryDone(data.deliveryDone);
        if (typeof data.commissionDone === 'boolean') setCommissionDone(data.commissionDone);
        if (data.assignedUser) setAssignedUser(data.assignedUser);
        return; // loaded draft, skip defaults
      }
    } catch {}
    setForm({
      vehicle_reg_no: parent.vehicle_reg_no || "",
      phone: parent.phone || "",
      alt_phone: parent.alt_phone || "",
      subject: "ADD new fastag",
      details: "",
      status: "ACTIVATION PENDING",
      kyv_status: "pending",
      assigned_to: currentUser ? String(currentUser.id) : String(parent.assigned_to ?? ""),
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
  }, [open, parent, currentUser?.id, draftKey]);

  // Autosave draft (debounced)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      try {
        const snapshot = {
          form,
          selectedShop,
          selectedPickup,
          assignedUser,
          fastagClass,
          fastagSerialInput,
          commissionAmount,
          paidVia,
          paymentReceived,
          deliveryDone,
          commissionDone,
        };
        localStorage.setItem(draftKey, JSON.stringify(snapshot));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [open, form, selectedShop, selectedPickup, assignedUser, fastagClass, fastagSerialInput, commissionAmount, paidVia, paymentReceived, deliveryDone, commissionDone, draftKey]);

  // Show notes for assigned user
  useEffect(() => {
    if (!assignedUser?.id) { setSelectedUserNotes(""); return; }
    fetch(`/api/users?id=${assignedUser.id}`).then(r=>r.json()).then((row)=>{
      const arr = Array.isArray(row) ? row : (row ? [row] : []);
      setSelectedUserNotes(arr[0]?.notes || "");
    }).catch(()=> setSelectedUserNotes(""));
  }, [assignedUser?.id]);

  // Show notes for pickup point
  useEffect(() => {
    if (!selectedPickup?.id) { setPickupNotes(""); return; }
    fetch(`/api/users?id=${selectedPickup.id}`).then(r=>r.json()).then((row)=>{
      const arr = Array.isArray(row) ? row : (row ? [row] : []);
      setPickupNotes(arr[0]?.notes || "");
    }).catch(()=> setPickupNotes(""));
  }, [selectedPickup?.id]);

  // keep role user id in sync with selected shop
  useEffect(() => {
    setForm((f) => ({ ...f, role_user_id: selectedShop ? String(selectedShop.id) : "" }));
  }, [selectedShop?.id]);
  useEffect(() => {
    if (!selectedShop?.id) { setShopNotes(""); return; }
    fetch(`/api/users?id=${selectedShop.id}`).then(r=>r.json()).then((row)=>{
      const arr = Array.isArray(row) ? row : (row ? [row] : []);
      setShopNotes(arr[0]?.notes || "");
    }).catch(()=> setShopNotes(""));
  }, [selectedShop?.id]);

  // Default Assigned To = current user
  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const s = data?.session;
        if (s?.id) {
          const me = { id: Number(s.id), name: s.name || 'Me' };
          setCurrentUser(me);
          setAssignedUser(me);
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

  // Load banks list on mount
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
    // bank/class filters are optional for narrowing results
    // @ts-ignore - keep local filter only
    if ((form as any).bank_name) q.set('bank', (form as any).bank_name);
    if (fastagClass) q.set('class', fastagClass);
    fetch(`/api/fastags?${q.toString()}`)
      .then(r => r.json())
      .then(rows => setFastagOptions(Array.isArray(rows) ? rows : []))
      .catch(() => setFastagOptions([]));
  }, [fastagSerialInput, (form as any).bank_name, fastagClass]);

  // Auto-pick exact match to fill bank/class/owner when user types full barcode
  useEffect(() => {
    const exact = (fastagOptions || []).find((r: any) => String(r.tag_serial) === fastagSerialInput.trim());
    if (exact) {
      setFastagSerialInput(exact.tag_serial || "");
      setFastagOwner(exact.holder ? String(exact.holder) : (exact.assigned_to_name || ""));
      // @ts-ignore
      setForm((f) => ({ ...f, fastag_serial: exact.tag_serial || "", bank_name: exact.bank_name || (f as any).bank_name }));
      if (exact.fastag_class) setFastagClass(String(exact.fastag_class));
      setFastagOptions([]);
    }
  }, [fastagOptions, fastagSerialInput]);

  function pickFastag(row: any) {
    setFastagSerialInput(row.tag_serial || "");
    setFastagOwner(row.holder ? String(row.holder) : (row.assigned_to_name || ""));
    // @ts-ignore
    setForm((f) => ({ ...f, fastag_serial: row.tag_serial || "", bank_name: row.bank_name || (f as any).bank_name }));
    if (row.fastag_class) setFastagClass(String(row.fastag_class));
    setFastagOptions([]);
  }

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
    const main = parseIndianMobile(form.phone);
    if (!main.ok) { setError(main.error); return; }
    let altNorm: string | null = null;
    if ((form.alt_phone || "").trim() !== "") {
      const alt = parseIndianMobile(form.alt_phone);
      if (!alt.ok) { setError(alt.error); return; }
      altNorm = alt.value;
    }
    setSaving(true);
    setError(null);
    try {
      // If Shop selected, place its id in role_user_id for lead_by mapping
      const effectiveLeadBy =
        form.lead_received_from === "Shop"
          ? selectedShop?.id || form.lead_by || form.role_user_id || ""
          : form.lead_by || form.role_user_id || "";

      const payload: any = {
        vehicle_reg_no: form.vehicle_reg_no,
        phone: main.value,
        alt_phone: altNorm,
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
        paid_via: paidVia,
      };
      if (commissionAmount !== "") payload.commission_amount = Number(commissionAmount) || 0;
      // @ts-ignore
      if (form.fastag_serial) payload.fastag_serial = (form as any).fastag_serial;
      payload.payment_received = !!paymentReceived;
      payload.delivery_done = !!deliveryDone;
      payload.commission_done = !!commissionDone;

      // Use children endpoint to ensure parenting and inheritance behavior
      const res = await fetch(`/api/tickets/${parent.id}/children`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data?.duplicates) {
          const lines = (data.duplicates as any[]).map((d: any) => `#${d.id} (${d.ticket_no || '-'}) - ${d.status || ''}`).join("\n");
          throw new Error(`Duplicate found for phone + vehicle. Existing:\n${lines}`);
        }
        throw new Error(data?.error || "Failed to create sub-ticket");
      }

      onCreated?.({ id: data.id, ticket_no: data.ticket_no });
      try { localStorage.removeItem(draftKey); } catch {}
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
                  setAssignedUser(currentUser);
                  setForm((f) => ({ ...f, assigned_to: String(currentUser.id) }));
                }
              }}
            >
              Self
            </button>
          </div>
          {selectedUserNotes && (
            <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap border rounded p-2 bg-gray-50">{selectedUserNotes}</div>
          )}
        </div>

          <div>
            <label className="block font-semibold mb-1">Status</label>
            <AutocompleteInput
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              options={[
                "ACTIVATION PENDING",
                "ACTIVATED",
                "CUST CANCELLED",
                "CLOSED",
              ]}
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
            <label className="block font-semibold mb-1">Lead Received From (Shop/Agent)</label>
            <UsersAutocomplete
              value={selectedShop ? { id: (selectedShop as any).id, name: (selectedShop as any).name } as any : null}
              onSelect={(u) => { setSelectedShop(u as any); setForm((f)=> ({ ...f, role_user_id: u ? String((u as any).id) : '' })); }}
              placeholder="Type shop/agent name"
            />
            {selectedShop && (<div className="text-xs text-gray-600 mt-1">Selected: {(selectedShop as any).name}</div>)}
            {shopNotes && (<div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap border rounded p-2 bg-gray-50">{shopNotes}</div>)}
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

          {/* Commission + Paid via + Flags (single row) */}
          <div className="lg:col-span-4 md:col-span-2 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold mb-1">Commission Amount</label>
              <input type="number" step="0.01" value={commissionAmount} onChange={(e) => setCommissionAmount(e.target.value)} className="w-full border p-2 rounded" placeholder="0" />
              <div className="text-xs text-gray-500 mt-1">Defaults to 0 if no commission is due.</div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Paid via</label>
              <select className="w-full border rounded p-2" value={paidVia} onChange={(e)=> setPaidVia(e.target.value)}>
                {paidViaOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <div className="text-xs text-gray-500 mt-1">Defaults to Pending.</div>
            </div>
            <div className="md:col-span-2 lg:col-span-2 flex items-center gap-6 pt-6">
              <label className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
                <input type="checkbox" checked={paymentReceived} onChange={(e) => setPaymentReceived(e.target.checked)} />
                Payment Received
              </label>
              <label className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
                <input type="checkbox" checked={deliveryDone} onChange={(e) => setDeliveryDone(e.target.checked)} />
                Delivery Done
              </label>
              <label className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
                <input type="checkbox" checked={commissionDone} onChange={(e) => setCommissionDone(e.target.checked)} />
                Commission Done
              </label>
            </div>
          </div>
          {/* One row: Bank, Class, Barcode, Owner */}
          <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold mb-1">FASTag Bank</label>
              <select className="w-full border rounded p-2" value={(form as any).bank_name || ""} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value } as any))}>
                <option value="">Select bank</option>
                {banks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
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
            <div>
              <label className="block font-semibold mb-1">FASTag Barcode</label>
              <input value={fastagSerialInput} onChange={(e) => setFastagSerialInput(e.target.value)} className="w-full border p-2 rounded" placeholder="Type FASTag barcode" />
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
            </div>
          </div>

          {/* Pick-up Point (Shop/Agent with notes) */}
        <div className="lg:col-span-2">
          <label className="block font-semibold mb-1">Pick-up Point (Shop/Agent)</label>
          <UsersAutocomplete
            value={selectedPickup ? ({ id: (selectedPickup as any).id, name: (selectedPickup as any).name } as any) : null}
            onSelect={(u) => {
              setSelectedPickup(u as any);
              setForm((f) => ({ ...f, pickup_point_name: u ? (u as any).name : "" }));
            }}
            placeholder="Type shop/agent name"
          />
          {selectedPickup && (
            <div className="text-xs text-gray-600 mt-1">Selected: {(selectedPickup as any).name}</div>
          )}
          {pickupNotes && (
            <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap border rounded p-2 bg-gray-50">{pickupNotes}</div>
          )}
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
            {saving ? "Creating..." : "Create Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
