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
import { parseIndianMobile } from "@/lib/validators";

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
    alt_vehicle_reg_no: "",
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
    bank_name: "",
    fastag_serial: "",
    // documents
    rc_front_url: "",
    rc_back_url: "",
    pan_url: "",
    aadhaar_front_url: "",
    aadhaar_back_url: "",
    vehicle_front_url: "",
    vehicle_side_url: "",
    sticker_pasted_url: "",
  }), []);

  const [form, setForm] = useState(initialForm);
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [selectedPickup, setSelectedPickup] = useState<{ id: number; name: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string } | null>(null);
  const [assignedUser, setAssignedUser] = useState<{ id: number; name: string } | null>(null);
  const [banks, setBanks] = useState<string[]>([]);
  const [fastagClass, setFastagClass] = useState<string>("class4");
  const [fastagSerialInput, setFastagSerialInput] = useState("");
  const [fastagOptions, setFastagOptions] = useState<any[]>([]);
  const [fastagOwner, setFastagOwner] = useState<string>("");
  const [commissionAmount, setCommissionAmount] = useState<string>("0");
  const [paymentReceived, setPaymentReceived] = useState<boolean>(false);
  const [paymentNil, setPaymentNil] = useState<boolean>(false);
  const [deliveryDone, setDeliveryDone] = useState<boolean>(false);
  const [deliveryNil, setDeliveryNil] = useState<boolean>(false);
  const [commissionDone, setCommissionDone] = useState<boolean>(false);
  const [leadCommission, setLeadCommission] = useState<string>("");
  const [leadCommissionPaid, setLeadCommissionPaid] = useState<boolean>(false);
  const [leadCommissionNil, setLeadCommissionNil] = useState<boolean>(false);
  const [pickupCommission, setPickupCommission] = useState<string>("");
  const [pickupCommissionPaid, setPickupCommissionPaid] = useState<boolean>(false);
  const [pickupCommissionNil, setPickupCommissionNil] = useState<boolean>(false);
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
        if (s?.id) {
          const me = { id: Number(s.id), name: s.name || 'Me' };
          setCurrentUser(me);
          // default Assigned To = current user
          setAssignedUser(me as any);
          setForm((f) => ({ ...f, assigned_to: String(me.id) }));
        }
      })
      .catch(() => {});
  }, []);

  // keep role user id in sync with selected shop
  useEffect(() => {
    setForm((f) => ({ ...f, role_user_id: selectedShop ? String(selectedShop.id) : "" }));
  }, [selectedShop?.id]);

  // Shop notes display
  useEffect(() => {
    if (!selectedShop?.id) { setShopNotes(""); return; }
    fetch(`/api/users?id=${selectedShop.id}`).then(r=>r.json()).then((row)=>{
      const arr = Array.isArray(row) ? row : (row ? [row] : []);
      setShopNotes(arr[0]?.notes || "");
    }).catch(()=> setShopNotes(""));
  }, [selectedShop?.id]);

  // When Assigned user changes, fetch notes
  useEffect(() => {
    if (!assignedUser?.id) { setSelectedUserNotes(""); return; }
    fetch(`/api/users?id=${assignedUser.id}`).then(r=>r.json()).then((row)=>{
      const arr = Array.isArray(row) ? row : (row ? [row] : []);
      setSelectedUserNotes(arr[0]?.notes || "");
    }).catch(()=> setSelectedUserNotes(""));
  }, [assignedUser?.id]);

  // When pickup point changes, fetch notes (if it's a user-based pickup)
  useEffect(() => {
    if (!selectedPickup?.id) { setPickupNotes(""); return; }
    fetch(`/api/users?id=${selectedPickup.id}`).then(r=>r.json()).then((row)=>{
      const arr = Array.isArray(row) ? row : (row ? [row] : []);
      setPickupNotes(arr[0]?.notes || "");
    }).catch(()=> setPickupNotes(""));
  }, [selectedPickup?.id]);

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
    setForm((f) => ({ ...f, fastag_serial: row.tag_serial || "", bank_name: row.bank_name || f.bank_name }));
    if (row.fastag_class) setFastagClass(String(row.fastag_class));
    setFastagOptions([]);
  }

  async function uploadToServer(file: File): Promise<string> {
    const fd = new FormData();
    fd.set('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    return String(data.url);
  }

  function UploadField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
    return (
      <div>
        <label className="block font-semibold mb-1">{label}</label>
        <div className="flex items-center gap-2">
          <input type="file" onChange={async (e) => {
            const inputEl = e.currentTarget as HTMLInputElement;
            const f = inputEl.files?.[0];
            if (!f) return;
            try {
              const url = await uploadToServer(f);
              onChange(url);
            } catch (err: any) {
              alert(err?.message || 'Upload failed');
            } finally { try { inputEl.value = ''; } catch {} }
          }} />
          {value && (<a href={value} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">View</a>)}
        </div>
      </div>
    );
  }

  function CheckboxItem({ label, checked, onChange, className = "" }: { label: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
    return (
      <label className={`inline-flex items-center gap-2 text-sm leading-none ${className}`}>
        <input type="checkbox" className="h-4 w-4" checked={checked} onChange={(e)=> onChange(e.target.checked)} />
        <span className="select-none">{label}</span>
      </label>
    );
  }

  // If user types a full barcode that exactly matches, auto-pick to fill bank/class/owner
  useEffect(() => {
    const exact = (fastagOptions || []).find((r: any) => String(r.tag_serial) === fastagSerialInput.trim());
    if (exact) pickFastag(exact);
  }, [fastagOptions, fastagSerialInput]);

  function normalizeAssignedTo(val: string) {
    if (val === "" || val === "self") return currentUser ? String(currentUser.id) : "";
    if (!isNaN(Number(val))) return String(parseInt(val, 10));
    return "";
  }

  const canSubmit = useMemo(
    () => form.subject.trim().length > 0 && form.phone.trim().length > 0,
    [form.subject, form.phone]
  );

  async function submit() {
    if (!canSubmit) {
      setError("Please fill VRN, Phone and Subject");
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
      const effectiveLeadBy =
        form.lead_received_from === "Shop"
          ? selectedShop?.id || form.lead_by || form.role_user_id || ""
          : form.lead_by || form.role_user_id || "";

      const payload: any = {
        vehicle_reg_no: form.vehicle_reg_no || "",
        alt_vehicle_reg_no: form.alt_vehicle_reg_no || "",
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
      payload.payment_received = !!paymentReceived;
      payload.payment_nil = !!paymentNil;
      payload.delivery_done = !!deliveryDone;
      payload.delivery_nil = !!deliveryNil;
      payload.commission_done = !!commissionDone;
      if (form.fastag_serial) payload.fastag_serial = form.fastag_serial;
      if (form.bank_name) payload.fastag_bank = form.bank_name;
      if (fastagClass) payload.fastag_class = fastagClass;
      if (fastagOwner) payload.fastag_owner = fastagOwner;
      if (leadCommission !== "") payload.lead_commission = Number(leadCommission) || 0;
      payload.lead_commission_paid = !!leadCommissionPaid;
      payload.lead_commission_nil = !!leadCommissionNil;
      if (pickupCommission !== "") payload.pickup_commission = Number(pickupCommission) || 0;
      payload.pickup_commission_paid = !!pickupCommissionPaid;
      payload.pickup_commission_nil = !!pickupCommissionNil;
      // document urls
      payload.rc_front_url = form.rc_front_url || null;
      payload.rc_back_url = form.rc_back_url || null;
      payload.pan_url = form.pan_url || null;
      payload.aadhaar_front_url = form.aadhaar_front_url || null;
      payload.aadhaar_back_url = form.aadhaar_back_url || null;
      payload.vehicle_front_url = form.vehicle_front_url || null;
      payload.vehicle_side_url = form.vehicle_side_url || null;
      payload.sticker_pasted_url = form.sticker_pasted_url || null;

      const res = await fetch(`/api/tickets`, {
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
        throw new Error(data?.error || "Failed to create ticket");
      }
      const id = Number(data.parent_id || data.id || 0);
      const ticket_no = data.parent_ticket_no || data.ticket_no;
      onCreated?.({ id, ticket_no });
      setOpen(false);
    } catch (e: any) {
      setError(String(e?.message || e) as any);
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

        {/* Two-column layout: left main form, right documents */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left: main form */}
          <div className="md:col-span-2">
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
            <label className="block font-semibold mb-1">Vehicle Reg. No (VRN)</label>
            <input
              name="vehicle_reg_no"
              value={form.vehicle_reg_no}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Alt Reg Number</label>
            <input
              name="alt_vehicle_reg_no"
              value={form.alt_vehicle_reg_no}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              placeholder="Optional"
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
                  onSelect={(u) => { setAssignedUser(u as any); setForm((f) => ({ ...f, assigned_to: u ? String(u.id) : "" })); }}
                  placeholder="Type user name"
                />
              </div>
              <button type="button" className="px-3 py-2 border rounded" onClick={() => { if (currentUser) { setAssignedUser(currentUser); setForm((f) => ({ ...f, assigned_to: String(currentUser.id) })); } }}>Self</button>
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
            <label className="block font-semibold mb-1">Lead Received From (Shop/Agent)</label>
            <UsersAutocomplete
              value={selectedShop ? { id: selectedShop.id, name: selectedShop.name } as any : null}
              onSelect={(u) => {
                setSelectedShop(u as any);
                setForm((f) => ({
                  ...f,
                  role_user_id: u ? String((u as any).id) : "",
                  lead_received_from: u ? String((u as any).name) : f.lead_received_from,
                }));
              }}
              placeholder="Type shop/agent name"
            />
            {selectedShop && (
              <div className="text-xs text-gray-600 mt-1">Selected: {(selectedShop as any).name}</div>
            )}
            {shopNotes && (
              <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap border rounded p-2 bg-gray-50">{shopNotes}</div>
            )}
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
            {pickupNotes && (
              <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap border rounded p-2 bg-gray-50">{pickupNotes}</div>
            )}
          </div>
          <div>
            <label className="block font-semibold mb-1">Commission Amount</label>
            <input type="number" step="0.01" value={commissionAmount} onChange={(e) => setCommissionAmount(e.target.value)} className="w-full border p-2 rounded" placeholder="0" />
            <div className="text-xs text-gray-500 mt-1">Defaults to 0 if no commission is due.</div>
          </div>
          <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-1">
            <CheckboxItem label="Payment Received" checked={paymentReceived} onChange={setPaymentReceived} />
            <CheckboxItem label="Payment Nil" checked={paymentNil} onChange={setPaymentNil} />
            <CheckboxItem label="Delivery Done" checked={deliveryDone} onChange={setDeliveryDone} />
            <CheckboxItem label="Delivery Nil" checked={deliveryNil} onChange={setDeliveryNil} />
            <CheckboxItem label="Commission Done" checked={commissionDone} onChange={setCommissionDone} />
          </div>
          {/* Paid via */}
          <div className="lg:col-span-2">
            <label className="block font-semibold mb-1">Paid via</label>
            <select className="w-full border rounded p-2" value={paidVia} onChange={(e)=> setPaidVia(e.target.value)}>
              {paidViaOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="text-xs text-gray-500 mt-1">Defaults to Pending.</div>
          </div>
          {/* One row: Bank, Class, Barcode, Owner */}
          <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold mb-1">FASTag Bank</label>
              <select className="w-full border rounded p-2" value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}>
                <option value="">Select bank</option>
                {banks.map((b) => (<option key={b} value={b}>{b}</option>))}
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

          {/* Lead & Pickup Commissions */}
          <div>
            <label className="block font-semibold mb-1">Lead Commission to Give</label>
            <input type="number" step="0.01" value={leadCommission} onChange={(e)=> setLeadCommission(e.target.value)} className="w-full border p-2 rounded" placeholder="0" />
            <div className="grid grid-cols-2 gap-3 mt-2">
              <CheckboxItem label="Commission Paid" checked={leadCommissionPaid} onChange={setLeadCommissionPaid} className="text-xs" />
              <CheckboxItem label="Commission Nil" checked={leadCommissionNil} onChange={setLeadCommissionNil} className="text-xs" />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Pickup Commission to Give</label>
            <input type="number" step="0.01" value={pickupCommission} onChange={(e)=> setPickupCommission(e.target.value)} className="w-full border p-2 rounded" placeholder="0" />
            <div className="grid grid-cols-2 gap-3 mt-2">
              <CheckboxItem label="Commission Paid" checked={pickupCommissionPaid} onChange={setPickupCommissionPaid} className="text-xs" />
              <CheckboxItem label="Commission Nil" checked={pickupCommissionNil} onChange={setPickupCommissionNil} className="text-xs" />
            </div>
          </div>

          {/* Details full width */}
          <div className="lg:col-span-4 md:col-span-2">
            <label className="block font-semibold mb-1">Details</label>
            <textarea name="details" value={form.details} onChange={handleChange} className="w-full border p-2 rounded" rows={3} />
          </div>
            </div>
          </div>

          {/* Right: documents sidebar */}
          <div className="md:col-span-1">
            <h3 className="font-semibold mb-2">Documents</h3>
            <div className="grid grid-cols-2 gap-3">
              <UploadField label="RC Front" value={form.rc_front_url} onChange={(u)=> setForm(f => ({...f, rc_front_url: u}))} />
              <UploadField label="RC Back" value={form.rc_back_url} onChange={(u)=> setForm(f => ({...f, rc_back_url: u}))} />
              <UploadField label="PAN" value={form.pan_url} onChange={(u)=> setForm(f => ({...f, pan_url: u}))} />
              <UploadField label="Aadhaar" value={form.aadhaar_front_url} onChange={(u)=> setForm(f => ({...f, aadhaar_front_url: u}))} />
              <UploadField label="Aadhaar" value={form.aadhaar_back_url} onChange={(u)=> setForm(f => ({...f, aadhaar_back_url: u}))} />
              <UploadField label="Vehicle Front" value={form.vehicle_front_url} onChange={(u)=> setForm(f => ({...f, vehicle_front_url: u}))} />
              <UploadField label="Vehicle Side" value={form.vehicle_side_url} onChange={(u)=> setForm(f => ({...f, vehicle_side_url: u}))} />
              <UploadField label="Sticker" value={form.sticker_pasted_url} onChange={(u)=> setForm(f => ({...f, sticker_pasted_url: u}))} />
            </div>
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
