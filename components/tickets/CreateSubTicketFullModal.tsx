"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
    subject: "New Fastag",
    details: "",
    status: "Open",
    kyv_status: "KYV pending",
    npci_status: "Activation Pending",
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
  const [fastagClass, setFastagClass] = useState<string>("");
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
  const [pickupSameAsLead, setPickupSameAsLead] = useState<boolean>(false);
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
  // If payment is marked received, default away from 'Pending'
  useEffect(() => {
    if (paymentReceived && paidVia === 'Pending') setPaidVia('Cash');
  }, [paymentReceived]);

  async function uploadToServer(file: File): Promise<string> {
    const fd = new FormData();
    fd.set('file', file);
    try { fd.set('ticket', String((parent as any)?.ticket_no || (parent as any)?.id || 'sub')); } catch { fd.set('ticket', 'sub'); }
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    let data: any = null; let text: string | null = null;
    try {
      if (ct.includes('application/json')) data = await res.json();
      else { text = await res.text(); try { data = JSON.parse(text); } catch {} }
    } catch { try { text = await res.text(); } catch {} }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || text || `Upload failed (${res.status})`;
      throw new Error(typeof msg === 'string' ? msg : 'Upload failed');
    }
    const url = data?.url || data?.Location || data?.location || data?.fileUrl || null;
    if (!url) throw new Error('Upload failed: no URL returned by server');
    return String(url);
  }

  function UploadField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    async function handleFile(f: File | null | undefined) {
      if (!f) return;
      try { const url = await uploadToServer(f); onChange(url); }
      catch (err: any) { alert(err?.message || 'Upload failed'); }
    }
    function firstFileFromDataTransfer(dt: DataTransfer): File | null {
      if (dt.files && dt.files.length > 0) return dt.files[0];
      if (dt.items && dt.items.length > 0) {
        for (let i = 0; i < dt.items.length; i++) {
          const it = dt.items[i];
          if (it.kind === 'file') { const f = it.getAsFile(); if (f) return f; }
        }
      }
      return null;
    }

    return (
      <div>
        <label className="block font-semibold mb-1">{label}</label>
        <div className="flex items-center gap-2">
          <div
            className={`flex-1 border rounded p-2 text-xs text-gray-600 bg-white ${dragOver ? 'border-blue-500 ring-2 ring-blue-100' : 'border-dashed'} cursor-pointer`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={async (e) => { e.preventDefault(); setDragOver(false); const f = firstFileFromDataTransfer(e.dataTransfer); await handleFile(f); }}
            onPaste={async (e) => { const files = e.clipboardData?.files; if (files && files.length > 0) await handleFile(files[0]); }}
            onClick={() => { try { inputRef.current?.click(); } catch {} }}
          >
            <input type="file" className="hidden" ref={inputRef}
              onChange={async (e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; await handleFile(f || undefined); try { (e.currentTarget as any).value = ''; } catch {} }} />
            <span className="select-none">Drag & drop file here, paste, or click to choose</span>
          </div>
          {value && (<a href={value} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">View</a>)}
        </div>
      </div>
    );
  }

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
      status: "Open",
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
      // documents
      rc_front_url: "",
      rc_back_url: "",
      pan_url: "",
      aadhaar_front_url: "",
      aadhaar_back_url: "",
      vehicle_front_url: "",
      vehicle_side_url: "",
      sticker_pasted_url: "",
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

  // If checkbox is on, keep pickup same as lead selection
  useEffect(() => {
    if (pickupSameAsLead && selectedShop?.id) {
      const p = { id: Number(selectedShop.id), name: String((selectedShop as any).name || ''), type: 'user' } as any;
      setSelectedPickup(p);
      setForm((f) => ({ ...f, pickup_point_name: p.name }));
    }
  }, [pickupSameAsLead, selectedShop?.id, (selectedShop as any)?.name]);

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
  const [showFastagSuggestions, setShowFastagSuggestions] = useState(false);
  useEffect(() => {
    const term = fastagSerialInput.trim();
    if (term.length < 2 || !showFastagSuggestions) { setFastagOptions([]); return; }
    const q = new URLSearchParams();
    q.set('query', term);
    // Only include mapping-done tags in sub-ticket barcode suggestions
    q.set('mapping', 'done');
    // bank/class filters are optional for narrowing results
    // @ts-ignore - keep local filter only
    if ((form as any).bank_name) q.set('bank', (form as any).bank_name);
    if (fastagClass) q.set('class', fastagClass);
    fetch(`/api/fastags?${q.toString()}`)
      .then(r => r.json())
      .then(rows => setFastagOptions(Array.isArray(rows) ? rows : []))
      .catch(() => setFastagOptions([]));
  }, [fastagSerialInput, (form as any).bank_name, fastagClass, showFastagSuggestions]);

  // Auto-pick exact match to fill bank/class/owner when user types full barcode
  useEffect(() => {
    const exact = (fastagOptions || []).find((r: any) => String(r.tag_serial) === fastagSerialInput.trim());
    if (exact) {
      setFastagSerialInput(exact.tag_serial || "");
      setFastagOwner((exact as any).owner_name || (exact as any).assigned_to_name || (exact.holder ? String(exact.holder) : ""));
      // @ts-ignore
      setForm((f) => ({ ...f, fastag_serial: exact.tag_serial || "", bank_name: exact.bank_name || (f as any).bank_name }));
      if (exact.fastag_class) setFastagClass(String(exact.fastag_class));
      setFastagOptions([]);
    }
  }, [fastagOptions, fastagSerialInput]);

  function pickFastag(row: any) {
    setFastagSerialInput(row.tag_serial || "");
    const owner = String(((row as any).owner_name || row.assigned_to_name || (row.holder ? String(row.holder) : "")) || '').trim();
    const login = String(((row as any).bank_login_user_name || '')) .trim();
    setFastagOwner(owner && login ? `${owner} / ${login}` : owner || login || "");
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
    // Business rule: if payment is received, Paid via cannot be 'Pending'
    if (!(String(form.status || '').toLowerCase() === 'cancelled') && paymentReceived && String(paidVia).trim() === 'Pending') {
      setError("Paid via cannot be 'Pending' when Payment Received is checked.");
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

      // Gating similar to CreateTicket
      const kyvText = String(form.kyv_status || '').toLowerCase();
      const kyvOK = kyvText.includes('compliant') || kyvText === 'nil' || kyvText === 'kyv compliant';
      const paymentOK = !!paymentReceived || !!paymentNil;
      const leadOK = !!leadCommissionPaid || !!leadCommissionNil;
      const pickupOK = !!pickupCommissionPaid || !!pickupCommissionNil;
      const deliveryOK = !!deliveryDone || !!deliveryNil;
      const allOK = paymentOK && leadOK && pickupOK && kyvOK && deliveryOK;
      let chosenStatus = form.status;
      const statusLower = String(form.status || '').toLowerCase();
      if (statusLower === 'completed' && !allOK) {
        setError('Cannot mark ticket Completed until Payment, Lead Commission, Pickup Commission, KYV and Delivery conditions are satisfied.');
        setSaving(false);
        return;
      }
      if (!paymentOK && !leadOK && !pickupOK && !kyvOK && !deliveryOK) {
        chosenStatus = 'New Lead';
      }

      const payload: any = {
        vehicle_reg_no: form.vehicle_reg_no,
        phone: main.value,
        alt_phone: altNorm,
        subject: form.subject,
        details: form.details,
        status: chosenStatus,
        kyv_status: form.kyv_status || null,
        npci_status: (form as any).npci_status || null,
        assigned_to: normalizeAssignedTo(form.assigned_to),
        lead_received_from: form.lead_received_from,
        lead_by: effectiveLeadBy,
        customer_name: form.customer_name,
        pickup_point_name: form.pickup_point_name || null,
        payment_to_collect: form.payment_to_collect !== "" ? Number(form.payment_to_collect) : null,
        payment_to_send: form.payment_to_send !== "" ? Number(form.payment_to_send) : null,
        net_value: form.net_value !== "" ? Number(form.net_value) : null,
        paid_via: paidVia,
      };
      if (commissionAmount !== "") payload.commission_amount = Number(commissionAmount) || 0;
      // @ts-ignore
      if (form.fastag_serial) payload.fastag_serial = (form as any).fastag_serial;
      if ((form as any).bank_name) payload.fastag_bank = (form as any).bank_name;
      if (fastagClass) payload.fastag_class = fastagClass;
      if (fastagOwner) payload.fastag_owner = fastagOwner;
      payload.payment_received = !!paymentReceived;
      payload.payment_nil = !!paymentNil;
      payload.delivery_done = !!deliveryDone;
      payload.delivery_nil = !!deliveryNil;
      payload.commission_done = !!commissionDone;
      if (leadCommission !== "") payload.lead_commission = Number(leadCommission) || 0;
      payload.lead_commission_paid = !!leadCommissionPaid;
      payload.lead_commission_nil = !!leadCommissionNil;
      if (pickupCommission !== "") payload.pickup_commission = Number(pickupCommission) || 0;
      payload.pickup_commission_paid = !!pickupCommissionPaid;
      payload.pickup_commission_nil = !!pickupCommissionNil;

      // document urls
      payload.rc_front_url = (form as any).rc_front_url || null;
      payload.rc_back_url = (form as any).rc_back_url || null;
      payload.pan_url = (form as any).pan_url || null;
      payload.aadhaar_front_url = (form as any).aadhaar_front_url || null;
      payload.aadhaar_back_url = (form as any).aadhaar_back_url || null;
      payload.vehicle_front_url = (form as any).vehicle_front_url || null;
      payload.vehicle_side_url = (form as any).vehicle_side_url || null;
      payload.sticker_pasted_url = (form as any).sticker_pasted_url || null;

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block font-semibold mb-1">Subject *</label>
            <select className="w-full border rounded p-2" value={form.subject} onChange={(e)=> setForm(f=> ({...f, subject: e.target.value}))}>
              <option value="New Fastag">New Fastag</option>
              <option value="Add-on Tag">Add-on Tag</option>
              <option value="Replacement Tag">Replacement Tag</option>
              <option value="Hotlisted Case">Hotlisted Case</option>
              <option value="Annual Pass">Annual Pass</option>
              <option value="Phone Num Update">Phone Num Update</option>
              <option value="Tag Closing">Tag Closing</option>
              <option value="Chassis VRN Update">Chassis VRN Update</option>
              <option value="VRN Update">VRN Update</option>
              <option value="Low Balance Case">Low Balance Case</option>
              <option value="Only Recharge">Only Recharge</option>
              <option value="Holder">Holder</option>
              <option value="MinKYC Process">MinKYC Process</option>
              <option value="Full KYC Process">Full KYC Process</option>
            </select>
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
                roles={["admin","administrator","super","super-admin","super_admin","super admin","superadmin"]}
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
            <label className="block font-semibold mb-1">Ticket Status</label>
            <select
              className="w-full border rounded p-2"
              value={form.status}
              onChange={(e)=> {
                const next = e.target.value;
                // Prevent selecting Completed unless requirements are met
                const kyvText = String(form.kyv_status || '').toLowerCase();
                const kyvOK = kyvText.includes('compliant') || kyvText === 'nil' || kyvText === 'kyv compliant';
                const paymentOK = !!paymentReceived || !!paymentNil;
                const leadOK = !!leadCommissionPaid || !!leadCommissionNil;
                const pickupOK = !!pickupCommissionPaid || !!pickupCommissionNil;
                const deliveryOK = !!deliveryDone || !!deliveryNil;
                const paidViaOK = !paymentReceived || (paidVia !== '' && paidVia !== 'Pending');
                const allOK = paymentOK && leadOK && pickupOK && kyvOK && deliveryOK && paidViaOK;
                if (String(next).toLowerCase() === 'completed' && !allOK) {
                  alert('Cannot mark as Completed. Please ensure Payment (and Paid via), Lead Commission, Pickup Commission, Delivery and KYV are completed or marked Nil.');
                  return;
                }
                setForm(f=> ({...f, status: next}));
              }}
            >
              <option>Open</option>
              <option>Completed</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">KYV Status</label>
            <select className="w-full border rounded p-2" value={form.kyv_status} onChange={(e)=> setForm(f=> ({...f, kyv_status: e.target.value}))}>
              <option>KYV pending</option>
              <option>KYV submitted</option>
              <option>KYV compliant</option>
              <option>Nil</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">NPCI Status</label>
            <select className="w-full border rounded p-2" value={(form as any).npci_status || 'Activation Pending'} onChange={(e)=> setForm((f:any)=> ({...f, npci_status: e.target.value}))}>
              <option>Activation Pending</option>
              <option>Active</option>
              <option>Low Balance</option>
              <option>Hotlist</option>
              <option>Closed</option>
            </select>
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
            <div className="md:col-span-2 lg:col-span-2 flex flex-col gap-2 pt-6">
              <label className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
                <input type="checkbox" checked={paymentReceived} onChange={(e) => setPaymentReceived(e.target.checked)} />
                Payment Received
              </label>
              <label className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
                <input type="checkbox" checked={paymentNil} onChange={(e) => setPaymentNil(e.target.checked)} />
                Payment Nil
              </label>
              <label className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
                <input type="checkbox" checked={deliveryDone} onChange={(e) => setDeliveryDone(e.target.checked)} />
                Delivery Done
              </label>
              <label className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
                <input type="checkbox" checked={deliveryNil} onChange={(e) => setDeliveryNil(e.target.checked)} />
                Delivery Nil
              </label>
            </div>
          </div>
          <div className="lg:col-span-4 md:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold mb-1">Lead Commission to Give</label>
              <input type="number" step="0.01" value={leadCommission} onChange={(e)=> setLeadCommission(e.target.value)} className="w-full border p-2 rounded" placeholder="0" />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={leadCommissionPaid} onChange={(e)=> setLeadCommissionPaid(e.target.checked)} /> Commission Paid</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={leadCommissionNil} onChange={(e)=> setLeadCommissionNil(e.target.checked)} /> Commission Nil</label>
            </div>
            <div>
              <label className="block font-semibold mb-1">Pickup Commission to Give</label>
              <input type="number" step="0.01" value={pickupCommission} onChange={(e)=> setPickupCommission(e.target.value)} className="w-full border p-2 rounded" placeholder="0" />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={pickupCommissionPaid} onChange={(e)=> setPickupCommissionPaid(e.target.checked)} /> Commission Paid</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={pickupCommissionNil} onChange={(e)=> setPickupCommissionNil(e.target.checked)} /> Commission Nil</label>
            </div>
          </div>
          
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
              <label className="block font-semibold mb-1">VEHICLE CLASS</label>
              <select className="w-full border rounded p-2" value={fastagClass} onChange={(e) => setFastagClass(e.target.value)}>
                <option value="">Select Vehicle Class</option>
                <option>Class 4 (Car/Jeep/Van)</option>
                <option>Class 20 (TATA Ace/Dost/Pickup)</option>
                <option>Class 5/9 (LCV/Mini-Bus 2Axle)</option>
                <option>Class 6/8/11 (3Axle)</option>
                <option>Class 7/10 (Truck/Bus 2Axle)</option>
                <option>Class 12/13/14 (Axle4/5/6)</option>
                <option>Class 15 (Axle7&above)</option>
                <option>Class 16/17 (Earth-Moving-Heavy)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">FASTag Barcode</label>
              <input value={fastagSerialInput} onFocus={() => setShowFastagSuggestions(true)} onChange={(e) => { setFastagSerialInput(e.target.value); setShowFastagSuggestions(true); }} className="w-full border p-2 rounded" placeholder="Type FASTag barcode" />
              {showFastagSuggestions && fastagOptions.length > 0 && (
                <div className="mt-1 max-h-40 overflow-auto border rounded">
                  {fastagOptions.map((row) => (
                    <div key={row.id} className="px-3 py-2 cursor-pointer hover:bg-orange-50 border-b last:border-b-0" onMouseDown={() => pickFastag(row)}>
                      {row.tag_serial} - {row.bank_name} / {row.fastag_class}
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

          
        <div className="lg:col-span-2">
          <label className="block font-semibold mb-1">Pick-up Point (Shop/Agent)</label>
          <UsersAutocomplete
            value={selectedPickup ? ({ id: (selectedPickup as any).id, name: (selectedPickup as any).name } as any) : null}
            onSelect={(u) => {
              setSelectedPickup(u as any);
              setForm((f) => ({ ...f, pickup_point_name: u ? (u as any).name : "" }));
              if (pickupSameAsLead && (!u || (selectedShop && (u as any).id !== (selectedShop as any).id))) {
                setPickupSameAsLead(false);
              }
            }}
            placeholder="Type shop/agent name"
          />
          <label className="inline-flex items-center gap-2 text-xs mt-2">
            <input type="checkbox" checked={pickupSameAsLead} onChange={(e)=> {
              const v = e.target.checked;
              setPickupSameAsLead(v);
              if (v && selectedShop?.id) {
                const p = { id: Number(selectedShop.id), name: String((selectedShop as any).name || ''), type: 'user' } as any;
                setSelectedPickup(p);
                setForm((f) => ({ ...f, pickup_point_name: p.name }));
              }
            }} />
            <span>Same as Lead</span>
          </label>
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

          

          
          </div>
          </div>
          
          <div className="md:col-span-1">
            <h3 className="font-semibold mb-2">Documents</h3>
            <div className="grid grid-cols-2 gap-3">
              <UploadField label="RC Front" value={(form as any).rc_front_url || ''} onChange={(u)=> setForm(f => ({...(f as any), rc_front_url: u} as any))} />
              <UploadField label="RC Back" value={(form as any).rc_back_url || ''} onChange={(u)=> setForm(f => ({...(f as any), rc_back_url: u} as any))} />
              <UploadField label="PAN" value={(form as any).pan_url || ''} onChange={(u)=> setForm(f => ({...(f as any), pan_url: u} as any))} />
              <UploadField label="Aadhaar" value={(form as any).aadhaar_front_url || ''} onChange={(u)=> setForm(f => ({...(f as any), aadhaar_front_url: u} as any))} />
              <UploadField label="Aadhaar" value={(form as any).aadhaar_back_url || ''} onChange={(u)=> setForm(f => ({...(f as any), aadhaar_back_url: u} as any))} />
              <UploadField label="Vehicle Front" value={(form as any).vehicle_front_url || ''} onChange={(u)=> setForm(f => ({...(f as any), vehicle_front_url: u} as any))} />
              <UploadField label="Vehicle Side" value={(form as any).vehicle_side_url || ''} onChange={(u)=> setForm(f => ({...(f as any), vehicle_side_url: u} as any))} />
              <UploadField label="Sticker" value={(form as any).sticker_pasted_url || ''} onChange={(u)=> setForm(f => ({...(f as any), sticker_pasted_url: u} as any))} />
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





