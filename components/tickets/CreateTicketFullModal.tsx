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
    subject: "New Fastag",
    details: "",
    status: "Open",
    kyv_status: "KYV pending",
    npci_status: "Activation Pending",
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
  // Store human-readable vehicle class label; map to API classes for search when needed
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

  // Helpers to normalize/validate close-like statuses
  function normalizeStatusClient(v: any): string {
    const s = String(v ?? '').toLowerCase().trim();
    const map: Record<string, string> = {
      'open': 'open',
      'pending': 'open',
      'activation pending': 'open',
      'kyc pending': 'open',
      'waiting': 'open',
      'new lead': 'open',
      'in progress': 'in_progress',
      'in_progress': 'in_progress',
      'working': 'in_progress',
      'completed': 'completed',
      'done': 'completed',
      'activated': 'completed',
      'resolved': 'completed',
      'closed': 'closed',
      'cancelled': 'cancelled',
      'cust cancelled': 'closed',
    };
    return map[s] || s || 'open';
  }
  function isCloseLikeStatus(v: any): boolean {
    const n = normalizeStatusClient(v);
    return n === 'closed' || n === 'completed';
  }

  // Reset when modal opens
  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
    setSelectedShop(null);
    setSelectedPickup(null);
    setPickupSameAsLead(false);
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

  // If checkbox is on, keep pickup in sync with lead selection
  useEffect(() => {
    if (pickupSameAsLead && selectedShop?.id) {
      const p = { id: Number(selectedShop.id), name: String(selectedShop.name || ''), type: 'user' } as any;
      setSelectedPickup(p);
      setForm((f) => ({ ...f, pickup_point_name: p.name }));
    }
  }, [selectedShop?.id, selectedShop?.name, pickupSameAsLead]);

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
    // Keep any dynamic banks if API provides, but UI will show predefined list per requirements
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
    // Map human label to API class code for search
    const labelToCode: Record<string, string> = {
      'Class 4 (Car/Jeep/Van)': 'class4',
      'Class 5/9 (LCV/Mini-Bus 2Axle)': 'class5',
      'Class 6/8/11 (3Axle)': 'class6',
      'Class 7/10 (Truck/Bus 2Axle)': 'class7',
      'Class 12/13/14 (Axle4/5/6)': 'class12',
      // Others intentionally not mapped to avoid filtering incorrectly
    };
    const apiClass = labelToCode[fastagClass];
    if (apiClass) q.set('class', apiClass);
    fetch(`/api/fastags?${q.toString()}`)
      .then(r => r.json())
      .then(rows => setFastagOptions(Array.isArray(rows) ? rows : []))
      .catch(() => setFastagOptions([]));
  }, [fastagSerialInput, form.bank_name, fastagClass]);

  function pickFastag(row: any) {
    setFastagSerialInput(row.tag_serial || "");
    setFastagOwner(row.assigned_to_name || (row.holder ? String(row.holder) : ""));
    setForm((f) => ({ ...f, fastag_serial: row.tag_serial || "", bank_name: row.bank_name || f.bank_name }));
    if (row.fastag_class) {
      const code = String(row.fastag_class).toLowerCase();
      const codeToLabel: Record<string, string> = {
        'class4': 'Class 4 (Car/Jeep/Van)',
        'class5': 'Class 5/9 (LCV/Mini-Bus 2Axle)',
        'class6': 'Class 6/8/11 (3Axle)',
        'class7': 'Class 7/10 (Truck/Bus 2Axle)',
        'class12': 'Class 12/13/14 (Axle4/5/6)'
      };
      setFastagClass(codeToLabel[code] || fastagClass);
    }
    setFastagOptions([]);
  }

  async function uploadToServer(file: File): Promise<string> {
    const fd = new FormData();
    fd.set('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    let data: any = null;
    let text: string | null = null;
    try {
      if (ct.includes('application/json')) {
        data = await res.json();
      } else {
        text = await res.text();
        try { data = JSON.parse(text); } catch {}
      }
    } catch {
      try { text = await res.text(); } catch {}
    }
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

    async function handleFile(f: File | null | undefined) {
      if (!f) return;
      try {
        const url = await uploadToServer(f);
        onChange(url);
      } catch (err: any) {
        alert(err?.message || 'Upload failed');
      }
    }

    function firstFileFromDataTransfer(dt: DataTransfer): File | null {
      if (dt.files && dt.files.length > 0) return dt.files[0];
      if (dt.items && dt.items.length > 0) {
        for (let i = 0; i < dt.items.length; i++) {
          const it = dt.items[i];
          if (it.kind === 'file') {
            const f = it.getAsFile();
            if (f) return f;
          }
        }
      }
      return null;
    }

    const inputRef = useRef<HTMLInputElement | null>(null);
    return (
      <div>
        <label className="block font-semibold mb-1">{label}</label>
        <div className="flex items-center gap-2">
          <div
            className={`flex-1 border rounded p-2 text-xs text-gray-600 bg-white ${dragOver ? 'border-blue-500 ring-2 ring-blue-100' : 'border-dashed'} cursor-pointer`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragOver(false);
              const file = firstFileFromDataTransfer(e.dataTransfer);
              await handleFile(file);
            }}
            onPaste={async (e) => {
              const files = e.clipboardData?.files;
              if (files && files.length > 0) {
                await handleFile(files[0]);
              }
            }}
            onClick={() => { try { inputRef.current?.click(); } catch {} }}
          >
            <input
              type="file"
              className="hidden"
              ref={inputRef}
              onChange={async (e) => {
                const inputEl = e.currentTarget as HTMLInputElement;
                const f = inputEl.files?.[0];
                await handleFile(f || undefined);
                try { inputEl.value = ''; } catch {}
              }}
            />
            <span className="select-none">Drag & drop file here, paste, or click to choose</span>
          </div>
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
      // Guard: determine if ticket can be closed/completed based on checklists
      const paymentOK = !!paymentReceived || !!paymentNil;
      const leadOK = !!leadCommissionPaid || !!leadCommissionNil;
      const pickupOK = !!pickupCommissionPaid || !!pickupCommissionNil;
      const kyvText = String(form.kyv_status || '').toLowerCase();
      const kyvOK = kyvText.includes('compliant') || kyvText === 'nil' || kyvText === 'kyv compliant';
      const deliveryOK = !!deliveryDone || !!deliveryNil;
      const allOK = paymentOK && leadOK && pickupOK && kyvOK && deliveryOK;

      let chosenStatus = form.status;
      const statusLower = String(form.status || '').toLowerCase();
      // If cancelling: require details but skip other close checks\n      // If cancelling: skip other close checks; details optional\n      }
      if (statusLower === 'completed' && !allOK) {
        setError('Cannot mark ticket Completed until Payment, Lead Commission, Pickup Commission, KYV and Delivery conditions are satisfied.');
        setSaving(false);
        return;
      }
      if (!paymentOK && !leadOK && !pickupOK && !kyvOK && !deliveryOK) {
        // If nothing is marked, default status to Pending/New Lead as per requirement
        chosenStatus = 'New Lead';
      }
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
      payload.payment_received = !!paymentReceived;
      payload.payment_nil = !!paymentNil;
      payload.delivery_done = !!deliveryDone;
      payload.delivery_nil = !!deliveryNil;
      payload.commission_done = !!commissionDone;
      if (form.fastag_serial) payload.fastag_serial = form.fastag_serial;
      if (form.bank_name) payload.fastag_bank = form.bank_name;
      if (fastagClass) payload.fastag_class = fastagClass; // store human label on ticket
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
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block font-semibold mb-1">Subject *</label>
                <select className="w-full border rounded p-2" value={form.subject} onChange={(e)=> setForm((f)=> ({...f, subject: e.target.value}))}>
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
                <label className="block font-semibold mb-1">Vehicle Reg. No (VRN)</label>
                <input name="vehicle_reg_no" value={form.vehicle_reg_no} onChange={handleChange} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Mobile</label>
                <input name="phone" value={form.phone} onChange={handleChange} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Alt Reg Number</label>
                <input name="alt_vehicle_reg_no" value={form.alt_vehicle_reg_no} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Optional" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Customer Name</label>
                <input name="customer_name" value={form.customer_name} onChange={handleChange} className="w-full border p-2 rounded" />
              </div>
            </div>

            {/* Row 2 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-semibold mb-1">Lead Received From (Shop/Agent)</label>
                <UsersAutocomplete value={selectedShop ? { id: selectedShop.id, name: selectedShop.name } as any : null}
                  onSelect={(u) => {
                    setSelectedShop(u as any);
                    setForm((f) => ({ ...f, role_user_id: u ? String((u as any).id) : "", lead_received_from: u ? String((u as any).name) : f.lead_received_from }));
                    if (pickupSameAsLead && u) {
                      const p = { id: Number((u as any).id), name: String((u as any).name || ''), type: 'user' } as any;
                      setSelectedPickup(p);
                      setForm((f) => ({ ...f, pickup_point_name: p.name }));
                    }
                  }}
                  placeholder="Type shop/agent name" />
                {selectedShop && (<div className="text-xs text-gray-600 mt-1">Selected: {(selectedShop as any).name}</div>)}
                {shopNotes && (<div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap border rounded p-2 bg-gray-50">{shopNotes}</div>)}
              </div>
              <div>
                <label className="block font-semibold mb-1">Pick-up Point</label>
                <PickupPointAutocomplete value={selectedPickup} onSelect={(p) => {
                  setSelectedPickup(p);
                  setForm((f) => ({ ...f, pickup_point_name: p ? p.name : "" }));
                  if (pickupSameAsLead && (!p || (selectedShop && p.id !== selectedShop.id))) {
                    setPickupSameAsLead(false);
                  }
                }} />
                <div className="text-xs text-gray-500 mt-1">Type to search (Agent, Shop, Warehouse)</div>
                <label className="inline-flex items-center gap-2 text-xs mt-2">
                  <input type="checkbox" checked={pickupSameAsLead} onChange={(e)=> {
                    const v = e.target.checked;
                    setPickupSameAsLead(v);
                    if (v && selectedShop?.id) {
                      const p = { id: Number(selectedShop.id), name: String(selectedShop.name || ''), type: 'user' } as any;
                      setSelectedPickup(p);
                      setForm((f) => ({ ...f, pickup_point_name: p.name }));
                    }
                  }} />
                  <span>Same as Lead</span>
                </label>
                {pickupNotes && (<div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap border rounded p-2 bg-gray-50">{pickupNotes}</div>)}
              </div>
              <div>
                <label className="block font-semibold mb-1">Bank</label>
                <select className="w-full border rounded p-2" value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}>
                  <option value="">Select Bank</option>
                  {['SBI','IDFC','ICICI','EQUITAS','INDUSIND','QUIKWALLET','Bajaj','Axis','HDFC','KVB','KOTAK'].map((b) => (
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
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">FASTag Barcode</label>
                <input value={fastagSerialInput} onChange={(e) => setFastagSerialInput(e.target.value)} className="w-full border p-2 rounded" placeholder="Type FASTag barcode" />
                {fastagOptions.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-auto border rounded">
                    {fastagOptions.map((row) => (
                      <div key={row.id} className="px-3 py-2 cursor-pointer hover:bg-orange-50 border-b last:border-b-0" onMouseDown={() => pickFastag(row)}>
                        {row.tag_serial} â€” {row.bank_name} / {row.fastag_class}
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

            {/* Row 3 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                <label className="block font-semibold mb-1">Paid via</label>
                <select className="w-full border rounded p-2" value={paidVia} onChange={(e)=> setPaidVia(e.target.value)}>
                  {paidViaOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
              </div>
              <div className="flex flex-col justify-end gap-2">
                <CheckboxItem label="Payment Received" checked={paymentReceived} onChange={setPaymentReceived} />
                <CheckboxItem label="Payment Nil" checked={paymentNil} onChange={setPaymentNil} />
              </div>
            </div>

            {/* Row 4 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-semibold mb-1">Lead Commission to Give</label>
                <input type="number" step="0.01" value={leadCommission} onChange={(e)=> setLeadCommission(e.target.value)} className="w-full border p-2 rounded" placeholder="0" />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <CheckboxItem label="Commission Paid" checked={leadCommissionPaid} onChange={setLeadCommissionPaid} className="text-xs" />
                <CheckboxItem label="Commission Nil" checked={leadCommissionNil} onChange={setLeadCommissionNil} className="text-xs" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Pickup Commission to Give</label>
                <input type="number" step="0.01" value={pickupCommission} onChange={(e)=> setPickupCommission(e.target.value)} className="w-full border p-2 rounded" placeholder="0" />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <CheckboxItem label="Commission Paid" checked={pickupCommissionPaid} onChange={setPickupCommissionPaid} className="text-xs" />
                <CheckboxItem label="Commission Nil" checked={pickupCommissionNil} onChange={setPickupCommissionNil} className="text-xs" />
              </div>
            </div>

            {/* Row 5 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold mb-1">Assigned To</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <UsersAutocomplete value={assignedUser} onSelect={(u) => { setAssignedUser(u as any); setForm((f) => ({ ...f, assigned_to: u ? String(u.id) : "" })); }} placeholder="Type user name" />
                  </div>
                  <button type="button" className="px-3 py-2 border rounded" onClick={() => { if (currentUser) { setAssignedUser(currentUser); setForm((f) => ({ ...f, assigned_to: String(currentUser.id) })); } }}>Self</button>
                </div>
                {selectedUserNotes && (<div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap border rounded p-2 bg-gray-50">{selectedUserNotes}</div>)}
              </div>
              <div>
                <label className="block font-semibold mb-1">NPCI Status</label>
                <select className="w-full border rounded p-2" value={(form as any).npci_status || "Activation Pending"} onChange={(e)=> setForm((f:any)=> ({...f, npci_status: e.target.value}))}>
                  <option>Activation Pending</option>
                  <option>Active</option>
                  <option>Low Balance</option>
                  <option>Hotlist</option>
                  <option>Closed</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Ticket Status</label>
                <select
                  className="w-full border rounded p-2"
                  value={form.status}
                  onChange={(e)=> {
                    const next = e.target.value;
                    // Only enforce checklist when moving to Completed; allow Closed/Cancelled
                    if (next === 'Completed') {
                      const kyvText = String(form.kyv_status || '').toLowerCase();
                      const paymentOK = !!paymentReceived || !!paymentNil;
                      const leadOK = !!leadCommissionPaid || !!leadCommissionNil;
                      const pickupOK = !!pickupCommissionPaid || !!pickupCommissionNil;
                      const deliveryOK = !!deliveryDone || !!deliveryNil;
                      const kyvOK = kyvText.includes('compliant') || kyvText === 'nil' || kyvText === 'kyv compliant';
                      const paidViaOK = !paymentReceived || (paidVia !== '' && paidVia !== 'Pending');
                      const allOK = paymentOK && leadOK && pickupOK && kyvOK && deliveryOK && paidViaOK;
                      if (!allOK) {
                        alert('Cannot mark as Completed. Please ensure Payment (and Paid via), Lead Commission, Pickup Commission, Delivery and KYV are completed or marked Nil.');
                        return;
                      }
                    }
                    setForm((f)=> ({...f, status: next}));
                  }}
                >
                  <option>Open</option>
                  <option>Completed</option>
                  <option>Closed</option>
                  <option>Cancelled</option>
                </select>
              </div>
            </div>

            {/* Row 6 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">KYV Status</label>
                <select className="w-full border rounded p-2" value={form.kyv_status} onChange={(e)=> setForm((f)=> ({...f, kyv_status: e.target.value}))}>
                  <option>KYV pending</option>
                  <option>KYV submitted</option>
                  <option>KYV compliant</option>
                  <option>Nil</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Details</label>
                <textarea name="details" value={form.details} onChange={handleChange} className="w-full border p-2 rounded" rows={3} />
              </div>
            </div>

            {/* Row 7: Delivery flags */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
              <CheckboxItem label="Delivery / Pickup Completed" checked={deliveryDone} onChange={setDeliveryDone} />
              <CheckboxItem label="Delivery / Pickup Nil" checked={deliveryNil} onChange={setDeliveryNil} />
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


