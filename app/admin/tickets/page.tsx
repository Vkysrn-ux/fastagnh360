"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import ShopAutocomplete from "@/components/ShopAutocomplete"; // adjust path if needed
import PickupPointAutocomplete from "@/components/PickupPointAutocomplete";
import AutocompleteInput from "@/components/AutocompleteInput";
import UsersAutocomplete from "@/components/UsersAutocomplete";
import CreateSubTicketFullModal from "@/components/tickets/CreateSubTicketFullModal";

// ---------- Small helpers ----------
function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      <div className="mt-1">{value ?? "-"}</div>
    </div>
  );
}
function Input(props: any) {
  const { label, ...rest } = props;
  return (
    <div className="mb-3">
      <label className="block font-semibold mb-1">{label}</label>
      <input className="border rounded w-full p-2" {...rest} />
    </div>
  );
}

// Payment badge UI
function PaymentBadge({ status, title }: { status: string; title?: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    not_paid: { text: "Not Paid", cls: "bg-red-100 text-red-700" },
    partial: { text: "Partially Paid", cls: "bg-amber-100 text-amber-700" },
    advance: { text: "Paid in Advance", cls: "bg-green-100 text-green-700" },
    paid: { text: "Paid", cls: "bg-green-100 text-green-700" }, // full payment (no explicit advance)
    unknown: { text: "—", cls: "bg-gray-100 text-gray-700" },
  };
  const v = map[status] || map["unknown"];
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}
    >
      {v.text}
    </span>
  );
}

// Derive payment status from available fields if no string provided
function derivePaymentStatus(t: any): { status: string; title: string } {
  const ps = (t.payment_status || t.payment?.status || "").toString().toLowerCase();
  if (ps) {
    if (["not_paid", "unpaid"].includes(ps)) return { status: "not_paid", title: "No payment received" };
    if (["partial", "partially_paid"].includes(ps)) return { status: "partial", title: "Payment received partially" };
    if (["advance", "paid_in_advance", "advance_paid"].includes(ps))
      return { status: "advance", title: "Payment received in advance" };
    if (["paid", "full", "fully_paid"].includes(ps)) return { status: "paid", title: "Fully paid" };
  }

  const total = Number(t.total_amount ?? t.amount_total ?? t.total ?? 0) || 0;
  const paid = Number(t.amount_paid ?? t.paid_amount ?? t.paid ?? 0) || 0;
  const advance = Number(t.advance_amount ?? t.advance_paid ?? 0) || 0;

  const due = Math.max(total - paid, 0);
  if (total === 0 && paid === 0 && advance === 0) {
    return { status: "unknown", title: "No payment info" };
  }
  if (paid <= 0) return { status: "not_paid", title: `Due ₹${due}` };
  if (paid > 0 && paid < total) return { status: "partial", title: `Paid ₹${paid} of ₹${total}` };
  if (paid >= total && advance > 0) return { status: "advance", title: `Advance ₹${advance}, Total ₹${total}` };
  return { status: "paid", title: `Paid ₹${paid} of ₹${total}` };
}

type Ticket = any;
type User = { id: number; name: string };

// Full sub-ticket row (like create-new)
type SubRow = {
  vehicle_reg_no: string;
  phone: string;
  alt_phone: string;
  subject: string;
  details: string;
  status: string;
  kyv_status?: string;
  assigned_to: string;
  lead_received_from: string;
  lead_by: string;
  customer_name: string;
  comments: string;
  selectedShop?: any | null;
  selectedPickup?: { id: number; name: string; type: string } | null;
  pickup_point_name?: string;
  payment_to_collect?: string;
  payment_to_send?: string;
  net_value?: string;
  users?: User[];
  loadingUsers?: boolean;
};

// For create modal extra issues
type SubIssue = {
  // same fields as creating a ticket (but will be created as a sub-ticket)
  vehicle_reg_no?: string;
  phone?: string;
  alt_phone?: string;
  subject: string;
  details: string;
  status?: string; // open, processing, etc.
  assigned_to?: string; // "self" | id as string | ""
  lead_received_from?: string;
  role_user_id?: string; // when ASM/TL/etc selected
  lead_by?: string; // free text or selected id; final payload uses role_user_id/selectedShop
  customer_name?: string;
  comments?: string;
  selectedShop?: any | null;
  users?: User[];
  loadingUsers?: boolean;
};

export default function TicketListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  // child counts map
  const [childCounts, setChildCounts] = useState<Record<number, number>>({});
  const [countsLoading, setCountsLoading] = useState(false);

  // Expand/collapse and children cache
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [childrenMap, setChildrenMap] = useState<Record<number, Ticket[]>>({});
  const [childrenLoading, setChildrenLoading] = useState<Record<number, boolean>>({});
  const [childrenError, setChildrenError] = useState<Record<number, string>>({});

  // View modal
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Edit modal (4 cols)
  const [editTicket, setEditTicket] = useState<Ticket | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Sub-ticket mgmt inside Edit modal
  const [childList, setChildList] = useState<any[]>([]);
  const [childLoading, setChildLoading] = useState(false);
  const [addingSubs, setAddingSubs] = useState(false);
  const [editSelectedShop, setEditSelectedShop] = useState<any>(null);
  const [editSelectedPickup, setEditSelectedPickup] = useState<{ id: number; name: string; type: string } | null>(null);
  const [subRows, setSubRows] = useState<SubRow[]>([
    {
      vehicle_reg_no: "",
      phone: "",
      alt_phone: "",
      subject: "",
      details: "",
      status: "open",
      kyv_status: "",
      assigned_to: "",
      lead_received_from: "",
      lead_by: "",
      customer_name: "",
      comments: "",
      selectedShop: null,
      selectedPickup: null,
      pickup_point_name: "",
      payment_to_collect: "",
      payment_to_send: "",
      net_value: "",
      users: [],
      loadingUsers: false,
    },
  ]);

  // Create Ticket (modal)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fcUsers, setFcUsers] = useState<User[]>([]);
  const [fcLoadingUsers, setFcLoadingUsers] = useState(false);
  const [fcSelectedShop, setFcSelectedShop] = useState<any>(null);
  const [fcSaving, setFcSaving] = useState(false);
  const [fcError, setFcError] = useState("");
  const [selectedPickup, setSelectedPickup] = useState<{ id: number; name: string; type: string } | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);

  // Options for simple autocompletes
  const SUBJECT_OPTIONS = [
    "New FASTag",
    "Replacement FASTag",
    "Hotlisted FASTag",
    "KYC Related",
    "Mobile Number Updation",
    "Other",
  ];
  const STATUS_OPTIONS = [
    "open",
    "processing",
    "kyc_pending",
    "done",
    "waiting",
    "closed",
    "completed",
  ];
  const LEAD_SOURCE_OPTIONS = [
    "WhatsApp",
    "Facebook",
    "Social Media",
    "Google Map",
    "Other",
    "Toll-agent",
    "ASM",
    "Shop",
    "Showroom",
    "TL",
    "Manager",
  ];

  const [fcForm, setFcForm] = useState({
    vehicle_reg_no: "",
    phone: "",
    alt_phone: "",
    subject: "",
    details: "",
    status: "open",
    kyv_status: "", // kyv_pending | kyv_pending_approval | kyv_success | kyv_hotlisted
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
  });

  // Auto-calc net_value = payment_to_collect + payment_to_send
  useEffect(() => {
    const a = parseFloat(fcForm.payment_to_collect || "");
    const b = parseFloat(fcForm.payment_to_send || "");
    const hasAny = (fcForm.payment_to_collect ?? "") !== "" || (fcForm.payment_to_send ?? "") !== "";
    let sumStr = "";
    if (hasAny) {
      const aNum = isNaN(a) ? 0 : a;
      const bNum = isNaN(b) ? 0 : b;
      sumStr = ((aNum + bNum).toFixed(2)).replace(/\.00$/, (aNum + bNum) % 1 === 0 ? "" : ".00");
    }
    setFcForm((f) => (f.net_value === sumStr ? f : { ...f, net_value: sumStr }));
  }, [fcForm.payment_to_collect, fcForm.payment_to_send]);
  const [fcSubIssues, setFcSubIssues] = useState<SubIssue[]>([
    {
      vehicle_reg_no: "",
      phone: "",
      alt_phone: "",
      subject: "",
      details: "",
      assigned_to: "self",
      status: "open",
      lead_received_from: "",
      role_user_id: "",
      lead_by: "",
      customer_name: "",
      comments: "",
      selectedShop: null,
      users: [],
      loadingUsers: false,
    },
  ]);

  // TODO: replace with real session user id
  const currentUserId = 1;

  // ---- Fetch tickets
  const fetchTickets = () => {
    fetch("/api/tickets")
      .then((res) => res.json())
      .then((data) => {
        // Ensure array to avoid runtime map() errors
        if (Array.isArray(data)) setTickets(data);
        else setTickets([]);
      })
      .catch(() => setTickets([]));
  };
  useEffect(() => {
    fetchTickets();
  }, []);

  // Keep form value in sync with selected pickup
  useEffect(() => {
    setFcForm((f) => ({ ...f, pickup_point_name: selectedPickup ? selectedPickup.name : "" }));
  }, [selectedPickup?.id]);

  // ---- Fetch child counts after tickets load
  useEffect(() => {
    if (!tickets.length) return;

    async function fetchCounts() {
      setCountsLoading(true);
      const entries: [number, number][] = await Promise.all(
        tickets.map(async (t) => {
          const id = t.id as number;
          try {
            const r1 = await fetch(`/api/tickets/${id}/children/count`);
            if (r1.ok) {
              const data = await r1.json();
              return [id, Number(data?.count ?? 0)];
            }
          } catch {}
          try {
            const r2 = await fetch(`/api/tickets/${id}/children`);
            if (r2.ok) {
              const list = await r2.json();
              return [id, Array.isArray(list) ? list.length : 0];
            }
          } catch {}
          if (typeof t.children_count === "number") return [id, t.children_count];
          return [id, 0];
        })
      );
      const map: Record<number, number> = {};
      entries.forEach(([id, count]) => (map[id] = count));
      setChildCounts(map);
      setCountsLoading(false);
    }
    fetchCounts();
  }, [tickets]);

  // ---- Expand/collapse handlers
  async function toggleExpand(parentId: number) {
    const isOpen = !!expanded[parentId];
    // collapse
    if (isOpen) {
      setExpanded((e) => ({ ...e, [parentId]: false }));
      return;
    }
    // open
    setExpanded((e) => ({ ...e, [parentId]: true }));

    // fetch children if not cached
    if (!childrenMap[parentId]) {
      setChildrenLoading((l) => ({ ...l, [parentId]: true }));
      setChildrenError((e) => ({ ...e, [parentId]: "" }));
      try {
        const res = await fetch(`/api/tickets/${parentId}/children`);
        const data = await res.json();
        if (!res.ok) {
          const msg = data?.error || `Failed to load children (${res.status})`;
          setChildrenError((e) => ({ ...e, [parentId]: String(msg) }));
          setChildrenMap((m) => ({ ...m, [parentId]: [] }));
        } else {
          setChildrenMap((m) => ({ ...m, [parentId]: Array.isArray(data) ? data : [] }));
        }
      } catch (err: any) {
        setChildrenMap((m) => ({ ...m, [parentId]: [] }));
        setChildrenError((e) => ({ ...e, [parentId]: err?.message || "Failed to load sub-tickets" }));
      } finally {
        setChildrenLoading((l) => ({ ...l, [parentId]: false }));
      }
    }
  }

  // ---- View modal handlers
  const handleView = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowModal(true);
    // load activity logs
    (async () => {
      try {
        setActivityLoading(true);
        const res = await fetch(`/api/tickets/${ticket.id}/logs`);
        const data = await res.json();
        setActivity(Array.isArray(data) ? data : []);
      } catch {
        setActivity([]);
      } finally {
        setActivityLoading(false);
      }
    })();
  };

  // Refresh children list and count after creating a sub-ticket from actions
  async function refreshChildren(parentId: number) {
    try {
      const list = await fetch(`/api/tickets/${parentId}/children`).then((r) => r.json());
      setChildrenMap((m) => ({ ...m, [parentId]: Array.isArray(list) ? list : [] }));
      setChildCounts((prev) => ({ ...prev, [parentId]: Array.isArray(list) ? list.length : 0 }));
    } catch {
      setChildrenMap((m) => ({ ...m, [parentId]: [] }));
    }
  }
  const handleClose = () => {
    setShowModal(false);
    setSelectedTicket(null);
  };

  // ---- Edit modal handlers
  const handleEdit = (ticket: Ticket) => {
    setEditTicket(ticket);
    setEditForm(ticket);
    // prefill pickup selection input if name exists
    if (ticket?.pickup_point_name) {
      setEditSelectedPickup({ id: 0, name: String(ticket.pickup_point_name), type: "" });
    } else {
      setEditSelectedPickup(null);
    }
    setShowModal(false);
  };
  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };
  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    // normalize fields
    let assigned_to_value: any = editForm.assigned_to;
    if (assigned_to_value === "" || assigned_to_value === "self") assigned_to_value = currentUserId;
    else if (!isNaN(Number(assigned_to_value))) assigned_to_value = parseInt(assigned_to_value as any, 10);
    else assigned_to_value = null;

    const effectiveLeadBy =
      editForm.lead_received_from === "Shop"
        ? (editSelectedShop?.id ?? editForm.lead_by ?? "")
        : editForm.lead_by ?? "";

    const payload: any = {
      id: editTicket?.id,
      customer_name: editForm.customer_name ?? null,
      phone: editForm.phone ?? null,
      alt_phone: editForm.alt_phone ?? null,
      subject: editForm.subject ?? null,
      status: editForm.status ?? null,
      kyv_status: editForm.kyv_status ?? null,
      assigned_to: assigned_to_value,
      lead_received_from: editForm.lead_received_from ?? null,
      lead_by: effectiveLeadBy,
      comments: editForm.comments ?? null,
      details: editForm.details ?? null,
      pickup_point_name: editForm.pickup_point_name ?? null,
      payment_to_collect:
        editForm.payment_to_collect !== undefined && editForm.payment_to_collect !== ""
          ? Number(editForm.payment_to_collect)
          : null,
      payment_to_send:
        editForm.payment_to_send !== undefined && editForm.payment_to_send !== ""
          ? Number(editForm.payment_to_send)
          : null,
      net_value: editForm.net_value !== undefined && editForm.net_value !== "" ? Number(editForm.net_value) : null,
    };

    await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setEditTicket(null);
    fetchTickets();
  };

  // ---- When Edit opens, load existing sub-tickets
  useEffect(() => {
    if (!editTicket?.id) return;
    setChildLoading(true);
    fetch(`/api/tickets/${editTicket.id}/children`)
      .then((r) => r.json())
      .then((list) => {
        setChildList(list || []);
        setChildCounts((prev) => ({ ...prev, [editTicket.id!]: Array.isArray(list) ? list.length : 0 }));
      })
      .catch(() => setChildList([]))
      .finally(() => setChildLoading(false));

    setSubRows([
      {
        vehicle_reg_no: editTicket.vehicle_reg_no || "",
        phone: editTicket.phone || "",
        alt_phone: editTicket.alt_phone || "",
        subject: "",
        details: "",
        status: "open",
        assigned_to: String(editTicket.assigned_to || ""),
        lead_received_from: editTicket.lead_received_from || "",
        lead_by: editTicket.lead_by || "",
        customer_name: editTicket.customer_name || "",
        comments: "",
        selectedShop: null,
        users: [],
        loadingUsers: false,
      },
    ]);
  }, [editTicket?.id]);

  // auto-calc parent net value in edit form
  useEffect(() => {
    const a = parseFloat(editForm?.payment_to_collect || "");
    const b = parseFloat(editForm?.payment_to_send || "");
    const hasAny = (editForm?.payment_to_collect ?? "") !== "" || (editForm?.payment_to_send ?? "") !== "";
    let sumStr = "";
    if (hasAny) {
      const aNum = isNaN(a) ? 0 : a;
      const bNum = isNaN(b) ? 0 : b;
      sumStr = (aNum + bNum).toFixed(2).replace(/\.00$/, (aNum + bNum) % 1 === 0 ? "" : ".00");
    }
    setEditForm((f: any) => (f?.net_value === sumStr ? f : { ...f, net_value: sumStr }));
  }, [editForm?.payment_to_collect, editForm?.payment_to_send]);

  // ---- Sub-ticket row helpers (Edit modal)
  function addSubRow() {
    setSubRows((prev) => [
      ...prev,
      {
        vehicle_reg_no: editTicket?.vehicle_reg_no || "",
        phone: editTicket?.phone || "",
        alt_phone: editTicket?.alt_phone || "",
        subject: "",
        details: "",
        status: "open",
        assigned_to: String(editTicket?.assigned_to || ""),
        lead_received_from: editTicket?.lead_received_from || "",
        lead_by: editTicket?.lead_by || "",
        customer_name: editTicket?.customer_name || "",
        comments: "",
        selectedShop: null,
        users: [],
        loadingUsers: false,
      },
    ]);
  }
  function removeSubRow(i: number) {
    setSubRows((s) => s.filter((_, idx) => idx !== i));
  }
  function updateSubRow(i: number, key: keyof SubRow, val: any) {
    setSubRows((s) => {
      const next = [...s];
      const row = { ...(next[i] as any) } as any;
      row[key] = val;
      if (key === "payment_to_collect" || key === "payment_to_send") {
        const a = parseFloat(row.payment_to_collect || "");
        const b = parseFloat(row.payment_to_send || "");
        const hasAny = (row.payment_to_collect ?? "") !== "" || (row.payment_to_send ?? "") !== "";
        let sumStr = "";
        if (hasAny) {
          const aNum = isNaN(a) ? 0 : a;
          const bNum = isNaN(b) ? 0 : b;
          sumStr = (aNum + bNum).toFixed(2).replace(/\.00$/, (aNum + bNum) % 1 === 0 ? "" : ".00");
        }
        row.net_value = sumStr;
      }
      next[i] = row;
      return next;
    });
  }
  async function handleRowSourceChange(i: number, src: string) {
    setSubRows((s) => {
      const next = [...s];
      next[i].lead_received_from = src;
      next[i].lead_by = "";
      next[i].selectedShop = null;
      next[i].users = [];
      next[i].loadingUsers = ["Toll-agent", "ASM", "TL", "Manager"].includes(src);
      return next;
    });

    if (["Toll-agent", "ASM", "TL", "Manager"].includes(src)) {
      try {
        const res = await fetch(`/api/users?role=${src.toLowerCase()}`);
        const data = (await res.json()) as User[];
        setSubRows((s) => {
          const next = [...s];
          next[i].users = data || [];
          next[i].loadingUsers = false;
          return next;
        });
      } catch {
        setSubRows((s) => {
          const next = [...s];
          next[i].users = [];
          next[i].loadingUsers = false;
          return next;
        });
      }
    }
  }
  function normalizeAssignedTo(val: string) {
    if (val === "" || val === "self") return String(currentUserId);
    if (!isNaN(Number(val))) return String(parseInt(val, 10));
    return "";
  }
  async function createNewSubTickets() {
    if (!editTicket?.id) return;
    const validRows = subRows.filter((r) => (r.subject || "").trim());
    if (validRows.length === 0) return;

    setAddingSubs(true);
    try {
      for (const row of validRows) {
        const payload = {
          vehicle_reg_no: row.vehicle_reg_no,
          phone: row.phone,
          alt_phone: row.alt_phone,
          subject: row.subject.trim(),
          details: (row.details || "").trim(),
          status: row.status || "open",
          kyv_status: row.kyv_status || null,
          assigned_to: normalizeAssignedTo(row.assigned_to),
          lead_received_from: row.lead_received_from,
          lead_by:
            row.lead_received_from === "Shop"
              ? (row.selectedShop?.id ?? row.lead_by ?? "")
              : row.lead_by,
          customer_name: row.customer_name,
          comments: row.comments,
          pickup_point_name: row.pickup_point_name || null,
          payment_to_collect:
            row.payment_to_collect !== undefined && row.payment_to_collect !== ""
              ? Number(row.payment_to_collect)
              : null,
          payment_to_send:
            row.payment_to_send !== undefined && row.payment_to_send !== ""
              ? Number(row.payment_to_send)
              : null,
          net_value: row.net_value !== undefined && row.net_value !== "" ? Number(row.net_value) : null,
        };
        await fetch(`/api/tickets/${editTicket.id}/children`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const list = await fetch(`/api/tickets/${editTicket.id}/children`).then((r) => r.json());
      setChildList(list || []);
      setChildCounts((prev) => ({ ...prev, [editTicket.id!]: Array.isArray(list) ? list.length : 0 }));
      setSubRows([
        {
          vehicle_reg_no: editTicket?.vehicle_reg_no || "",
          phone: editTicket?.phone || "",
          alt_phone: editTicket?.alt_phone || "",
          subject: "",
          details: "",
          status: "open",
          kyv_status: "",
          assigned_to: String(editTicket?.assigned_to || ""),
          lead_received_from: editTicket?.lead_received_from || "",
          lead_by: editTicket?.lead_by || "",
          customer_name: editTicket?.customer_name || "",
          comments: "",
          selectedShop: null,
          selectedPickup: null,
          pickup_point_name: "",
          payment_to_collect: "",
          payment_to_send: "",
          net_value: "",
          users: [],
          loadingUsers: false,
        },
      ]);
    } finally {
      setAddingSubs(false);
    }
  }

  // ---- Create Ticket (modal) — staff list when source is staff role
  useEffect(() => {
    const src = fcForm.lead_received_from;
    if (["Toll-agent", "ASM", "TL", "Manager"].includes(src)) {
      setFcLoadingUsers(true);
      fetch(`/api/users?role=${src.toLowerCase()}`)
        .then((res) => res.json())
        .then((data) => setFcUsers(data || []))
        .catch(() => setFcUsers([]))
        .finally(() => setFcLoadingUsers(false));
    } else {
      setFcUsers([]);
      setFcForm((f) => ({ ...f, role_user_id: "" }));
    }
  }, [fcForm.lead_received_from]);

  // keep role_user_id in sync with chosen shop
  useEffect(() => {
    setFcForm((f) => ({ ...f, role_user_id: fcSelectedShop ? fcSelectedShop.id : "" }));
  }, [fcSelectedShop]);

  const fcHandleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFcForm((f) => ({ ...f, [name]: value }));
  };
  function fcAddRow() {
    setFcSubIssues((s) => [
      ...s,
      {
        vehicle_reg_no: fcForm.vehicle_reg_no || "",
        phone: fcForm.phone || "",
        alt_phone: fcForm.alt_phone || "",
        subject: "",
        details: "",
        assigned_to: fcForm.assigned_to || "self",
        status: "open",
        lead_received_from: fcForm.lead_received_from || "",
        role_user_id: "",
        lead_by: "",
        customer_name: fcForm.customer_name || "",
        comments: "",
        selectedShop: null,
        users: [],
        loadingUsers: false,
      },
    ]);
  }
  function fcRemoveRow(i: number) {
    setFcSubIssues((s) => s.filter((_, idx) => idx !== i));
  }
  function fcUpdateRow(i: number, key: keyof SubIssue, val: any) {
    setFcSubIssues((s) => {
      const next = [...s];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
  }
  async function fcHandleRowSourceChange(i: number, src: string) {
    setFcSubIssues((s) => {
      const next = [...s];
      const row = { ...next[i] };
      row.lead_received_from = src;
      row.lead_by = "";
      row.role_user_id = "";
      row.selectedShop = null;
      row.users = [];
      row.loadingUsers = ["Toll-agent", "ASM", "TL", "Manager"].includes(src);
      next[i] = row;
      return next;
    });

    if (["Toll-agent", "ASM", "TL", "Manager"].includes(src)) {
      try {
        const res = await fetch(`/api/users?role=${src.toLowerCase()}`);
        const data = (await res.json()) as User[];
        setFcSubIssues((s) => {
          const next = [...s];
          next[i] = { ...next[i], users: data || [], loadingUsers: false };
          return next;
        });
      } catch {
        setFcSubIssues((s) => {
          const next = [...s];
          next[i] = { ...next[i], users: [], loadingUsers: false };
          return next;
        });
      }
    }
  }
  const submitFullCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFcError("");

    let assigned_to_value: any = fcForm.assigned_to;
    if (assigned_to_value === "" || assigned_to_value === "self") {
      assigned_to_value = currentUserId;
    } else if (!isNaN(Number(assigned_to_value))) {
      assigned_to_value = parseInt(assigned_to_value as unknown as string, 10);
    } else {
      assigned_to_value = null;
    }

    const payload = {
      vehicle_reg_no: fcForm.vehicle_reg_no,
      subject: fcForm.subject,
      details: fcForm.details,
      phone: fcForm.phone,
      alt_phone: fcForm.alt_phone,
      assigned_to: assigned_to_value,
      lead_received_from: fcForm.lead_received_from,
      lead_by: fcForm.lead_by || fcForm.role_user_id || "",
      status: fcForm.status,
      kyv_status: fcForm.kyv_status || null,
      customer_name: fcForm.customer_name,
      comments: fcForm.comments,
      pickup_point_name: fcForm.pickup_point_name || null,
      payment_to_collect: fcForm.payment_to_collect !== "" ? Number(fcForm.payment_to_collect) : null,
      payment_to_send: fcForm.payment_to_send !== "" ? Number(fcForm.payment_to_send) : null,
      net_value: fcForm.net_value !== "" ? Number(fcForm.net_value) : null,
      // No sub_issues from Create modal
      sub_issues: [],
    };

    try {
      setFcSaving(true);
      if (draftId) {
        // finalize draft -> patch with final fields (status might still be 'open')
        const res = await fetch("/api/tickets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: draftId, ...payload }),
        });
        if (!res.ok) throw new Error((await res.text()) || "Failed to update draft");
      } else {
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Failed to create ticket");
        }
      }
      setShowCreateModal(false);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setFcForm({
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
      });
      setFcSelectedShop(null);
      setDraftId(null);
      setFcUsers([]);
      setFcSubIssues([
        {
          vehicle_reg_no: "",
          phone: "",
          alt_phone: "",
          subject: "",
          details: "",
          assigned_to: "self",
          status: "open",
          lead_received_from: "",
          role_user_id: "",
          lead_by: "",
          customer_name: "",
          comments: "",
          selectedShop: null,
          users: [],
          loadingUsers: false,
        },
      ]);
      fetchTickets();
    } catch (err: any) {
      setFcError(err.message || "Something went wrong");
    } finally {
      setFcSaving(false);
    }
  };

  // Autosave draft locally while typing
  const DRAFT_KEY = "ticket_create_draft_v1";
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setFcForm((f) => ({ ...f, ...(parsed.form || {}) }));
          setFcSelectedShop(parsed.fcSelectedShop || null);
          setSelectedPickup(parsed.selectedPickup || null);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const h = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ form: fcForm, fcSelectedShop, selectedPickup })
        );
      } catch {}
    }, 500);
    return () => clearTimeout(h);
  }, [fcForm, fcSelectedShop, selectedPickup]);

  // Auto-save to server as draft while typing (debounced)
  useEffect(() => {
    if (!showCreateModal) return;
    const h = setTimeout(async () => {
      try {
        // only autosave if there's some data
        const hasAny = Object.values(fcForm).some((v) => String(v || "").trim() !== "");
        if (!hasAny) return;

        // Normalize assigned_to similar to submit
        let assigned_to_value: any = fcForm.assigned_to;
        if (assigned_to_value === "" || assigned_to_value === "self") {
          assigned_to_value = currentUserId;
        } else if (!isNaN(Number(assigned_to_value))) {
          assigned_to_value = parseInt(assigned_to_value as unknown as string, 10);
        } else {
          assigned_to_value = null;
        }

        const base = {
          vehicle_reg_no: fcForm.vehicle_reg_no,
          subject: fcForm.subject,
          details: fcForm.details,
          phone: fcForm.phone,
          alt_phone: fcForm.alt_phone,
          assigned_to: assigned_to_value,
          lead_received_from: fcForm.lead_received_from,
          lead_by: fcForm.lead_by || fcForm.role_user_id || "",
          status: fcForm.status || "draft",
          kyv_status: fcForm.kyv_status || null,
          customer_name: fcForm.customer_name,
          comments: fcForm.comments,
          pickup_point_name: fcForm.pickup_point_name || null,
          payment_to_collect: fcForm.payment_to_collect !== "" ? Number(fcForm.payment_to_collect) : null,
          payment_to_send: fcForm.payment_to_send !== "" ? Number(fcForm.payment_to_send) : null,
          net_value: fcForm.net_value !== "" ? Number(fcForm.net_value) : null,
          sub_issues: [],
        } as any;

        if (!draftId) {
          // create draft
          const res = await fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...base, status: "draft" }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.parent_id) setDraftId(Number(data.parent_id));
          }
        } else {
          // update draft
          await fetch("/api/tickets", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: draftId, ...base }),
          });
        }
      } catch {}
    }, 1200);
    return () => clearTimeout(h);
  }, [fcForm, selectedPickup, fcSelectedShop, showCreateModal, draftId]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">FASTag Ticket List</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white border border-orange-500 text-orange-600 px-4 py-2 rounded shadow hover:bg-orange-50 font-semibold"
            title="Open full create form here"
          >
            Create Ticket (Modal)
          </button>
          {/* Removed Create Ticket (Page) button as requested */}
        </div>
      </div>

      {/* Table */}
      <table className="min-w-full border mt-2">
        <thead>
          <tr>
            <th className="px-2 py-2 w-10"></th>{/* Arrow */}
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">Customer</th>
            <th className="px-4 py-2">Mobile</th>
            <th className="px-4 py-2">Vehicle</th>
            <th className="px-4 py-2">Source</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Payment</th>
            <th className="px-4 py-2">Subs</th>
            <th className="px-4 py-2">Created</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(tickets) ? tickets : []).map((t) => {
            const { status, title } = derivePaymentStatus(t);
            const count = typeof t.children_count === "number" ? t.children_count : childCounts[t.id] ?? 0;
            const isOpen = !!expanded[t.id];
            const isLoadingChildren = !!childrenLoading[t.id];
            const children = childrenMap[t.id] || [];

            return (
              <Fragment key={t.id}>
                <tr className="border-b">
                  <td className="border px-2 py-2 text-center align-middle">
                    <button
                      className={`inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 ${
                        count === 0 ? "opacity-40 cursor-default" : "cursor-pointer"
                      }`}
                      disabled={count === 0}
                      onClick={() => toggleExpand(t.id)}
                      title={count > 0 ? (isOpen ? "Collapse" : "Expand") : "No sub-tickets"}
                      aria-label={isOpen ? "Collapse sub-tickets" : "Expand sub-tickets"}
                    >
                      <span className="text-sm">{isOpen ? "▼" : "▶"}</span>
                    </button>
                  </td>
                  <td className="border px-4 py-2">{t.id}</td>
                  <td className="border px-4 py-2">{t.customer_name}</td>
                  <td className="border px-4 py-2">{t.phone}</td>
                  <td className="border px-4 py-2">{t.vehicle_reg_no}</td>
                  <td className="border px-4 py-2">
                    {t.lead_received_from_sub
                      ? `${t.lead_received_from} → ${t.lead_received_from_sub}`
                      : t.lead_received_from}
                  </td>
                  <td className="border px-4 py-2">{t.status}</td>
                  <td className="border px-4 py-2">
                    <PaymentBadge status={status} title={title} />
                  </td>
                  <td className="border px-4 py-2">
                    <span
                      className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700"
                      title={countsLoading ? "Loading…" : `${count} sub-ticket(s)`}
                    >
                      {countsLoading && !(t.children_count >= 0) && childCounts[t.id] === undefined ? "…" : count}
                    </span>
                  </td>
                  <td className="border px-4 py-2">
                    {t.created_at ? new Date(t.created_at).toLocaleString() : ""}
                  </td>
                  <td className="border px-4 py-2">
                    <button className="text-orange-500 hover:underline mr-2" onClick={() => handleView(t)}>
                      View
                    </button>
                    <button className="text-blue-500 hover:underline mr-2" onClick={() => handleEdit(t)}>
                      Edit
                    </button>
                    <CreateSubTicketFullModal
                      parent={t}
                      label="Create Sub Ticket"
                      asButtonClassName="text-green-600 hover:underline"
                      onCreated={() => {
                        refreshChildren(t.id);
                        // open row if not open to show newly added
                        setExpanded((e) => ({ ...e, [t.id]: true }));
                      }}
                    />
                  </td>
                </tr>

                {/* Inline expanded children row */}
                {isOpen && (
                  <tr className="bg-gray-50">
                    <td className="border px-2 py-2"></td>
                    <td className="border px-4 py-2" colSpan={10}>
                      {isLoadingChildren ? (
                        <div className="text-sm text-gray-600">Loading sub-tickets…</div>
                      ) : children.length === 0 ? (
                        <div className="text-sm text-gray-500">No sub-tickets</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-600">
                              <th className="text-left py-2">ID</th>
                              <th className="text-left py-2">Subject</th>
                              <th className="text-left py-2">Status</th>
                              <th className="text-left py-2">Ticket No</th>
                              <th className="text-left py-2">Created</th>
                              <th className="text-left py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {children.map((c) => (
                              <tr key={c.id} className="border-t">
                                <td className="py-2 pr-4">#{c.id}</td>
                                <td className="py-2 pr-4">{c.subject || "-"}</td>
                                <td className="py-2 pr-4">{c.status || "-"}</td>
                                <td className="py-2 pr-4">{c.ticket_no || "-"}</td>
                                <td className="py-2 pr-4">
                                  {c.created_at ? new Date(c.created_at).toLocaleString() : "-"}
                                </td>
                                <td className="py-2 whitespace-nowrap">
                                  <button
                                    className="text-orange-600 hover:underline mr-3"
                                    onClick={() => handleView(c)}
                                  >
                                    View
                                  </button>
                                  <button
                                    className="text-blue-600 hover:underline mr-3"
                                    onClick={() => handleEdit(c)}
                                  >
                                    Edit
                                  </button>
                                  <a className="text-gray-600 hover:underline" href={`/admin/tickets/${c.id}`}>
                                    Open
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {/* View Modal (vertical) */}
      {showModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-2xl relative overflow-y-auto max-h-[90vh]">
            <button
              className="absolute top-4 right-4 text-gray-600 hover:text-red-500 text-2xl font-bold"
              onClick={handleClose}
              aria-label="Close"
            >
              ×
            </button>

            <h2 className="text-xl font-bold mb-4">Ticket Details</h2>

            <div className="flex flex-col">
              <Detail label="Ticket No" value={selectedTicket.ticket_no} />
              <Detail label="Customer" value={selectedTicket.customer_name} />
              <Detail label="Mobile" value={selectedTicket.phone} />
              <Detail label="Vehicle" value={selectedTicket.vehicle_reg_no} />
              <Detail
                label="Source"
                value={
                  selectedTicket.lead_received_from_sub
                    ? `${selectedTicket.lead_received_from} → ${selectedTicket.lead_received_from_sub}`
                    : selectedTicket.lead_received_from
                }
              />
              <Detail label="Status" value={selectedTicket.status} />
              <Detail
                label="Created"
                value={selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : ""}
              />
              <Detail label="Subject" value={selectedTicket.subject} />
              <Detail label="Assigned To" value={selectedTicket.assigned_to} />
              <Detail label="Alt Phone" value={selectedTicket.alt_phone} />
              <Detail label="Lead By" value={selectedTicket.lead_by} />
              <Detail label="Comments" value={selectedTicket.comments} />
            </div>

            <div className="mt-4">
              <div className="block font-semibold mb-1">Details</div>
              <div className="whitespace-pre-line border rounded p-2 bg-gray-50">{selectedTicket.details}</div>
            </div>

            {/* Activity timeline */}
            <div className="mt-6">
              <div className="text-lg font-semibold mb-2">Activity</div>
              {activityLoading ? (
                <div className="text-sm text-gray-500">Loading activity…</div>
              ) : activity.length === 0 ? (
                <div className="text-sm text-gray-500">No activity yet.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {activity.map((ev: any) => {
                    let meta: any = {};
                    try { meta = ev.meta ? JSON.parse(ev.meta) : {}; } catch {}
                    const when = ev.created_at ? new Date(ev.created_at).toLocaleString() : "";
                    const who = ev.actor_name || (ev.actor_id ? `User #${ev.actor_id}` : "-");
                    return (
                      <li key={ev.id} className="border rounded p-2 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{ev.action.replace(/_/g, ' ')}</div>
                          <div className="text-gray-500">{when}</div>
                        </div>
                        <div className="text-gray-700 mt-1">
                          <span className="font-semibold">By:</span> {who}
                        </div>
                        {meta && Object.keys(meta).length > 0 && (
                          <pre className="mt-1 bg-gray-50 rounded p-2 overflow-x-auto text-xs">{JSON.stringify(meta, null, 2)}</pre>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal — 4 columns + FULL sub-ticket creation rows */}
      {editTicket && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8 w-full max-w-6xl relative mx-2 overflow-y-auto max-h-[95vh]">
            <button
              className="absolute top-3 right-3 text-gray-600 hover:text-red-500 text-2xl font-bold"
              onClick={() => setEditTicket(null)}
              aria-label="Close"
            >
              ×
            </button>

            <h2 className="text-xl font-bold mb-4">Edit Ticket</h2>

            {/* Parent fields — 4 columns */}
            <form onSubmit={submitEdit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-semibold mb-1">Customer Name</label>
                <input
                  className="border rounded w-full p-2"
                  name="customer_name"
                  value={editForm.customer_name || ""}
                  onChange={handleEditChange}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Mobile</label>
                <input
                  className="border rounded w-full p-2"
                  name="phone"
                  value={editForm.phone || ""}
                  onChange={handleEditChange}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Vehicle No</label>
                <input
                  className="border rounded w-full p-2 bg-gray-100 text-gray-600"
                  value={editTicket.vehicle_reg_no || "-"}
                  disabled
                  readOnly
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Status</label>
                <AutocompleteInput
                  value={editForm.status || ""}
                  onChange={(v) => setEditForm((f: any) => ({ ...f, status: v }))}
                  options={STATUS_OPTIONS}
                  placeholder="Type status"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Subject</label>
                <AutocompleteInput
                  value={editForm.subject || ""}
                  onChange={(v) => setEditForm((f: any) => ({ ...f, subject: v }))}
                  options={SUBJECT_OPTIONS}
                  placeholder="Type subject"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Assigned To</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <UsersAutocomplete
                      value={editForm.assigned_to ? { id: Number(editForm.assigned_to), name: "" } : null}
                      onSelect={(u) => setEditForm((f: any) => ({ ...f, assigned_to: u ? String(u.id) : "" }))}
                      placeholder="Type user name"
                    />
                  </div>
                  <button type="button" className="px-3 py-2 border rounded" onClick={() => setEditForm((f: any) => ({ ...f, assigned_to: String(currentUserId) }))}>Self</button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Alt Phone</label>
                <input
                  className="border rounded w-full p-2"
                  name="alt_phone"
                  value={editForm.alt_phone || ""}
                  onChange={handleEditChange}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Lead By</label>
                <input
                  className="border rounded w-full p-2"
                  name="lead_by"
                  value={editForm.lead_by || ""}
                  onChange={handleEditChange}
                />
              </div>

              <div className="lg:col-span-4">
                <label className="block font-semibold mb-1">Source</label>
                <AutocompleteInput
                  value={editForm.lead_received_from || ""}
                  onChange={(v) => setEditForm((f: any) => ({ ...f, lead_received_from: v }))}
                  options={LEAD_SOURCE_OPTIONS}
                  placeholder="Type source"
                />
              </div>

              {editForm.lead_received_from === "Shop" && (
                <div className="lg:col-span-4">
                  <label className="block font-semibold mb-1">Shop Name</label>
                  <ShopAutocomplete
                    value={editSelectedShop}
                    onSelect={(shop) => {
                      setEditSelectedShop(shop);
                      setEditForm((f: any) => ({ ...f, lead_by: shop ? String(shop.id) : "" }));
                    }}
                  />
                </div>
              )}
              {["Toll-agent", "ASM", "TL", "Manager"].includes(editForm.lead_received_from || "") && (
                <div className="lg:col-span-4">
                  <label className="block font-semibold mb-1">User Name</label>
                  <UsersAutocomplete
                    role={editForm.lead_received_from}
                    value={editForm.lead_by ? { id: Number(editForm.lead_by), name: "" } : null}
                    onSelect={(u) => setEditForm((f: any) => ({ ...f, lead_by: u ? String(u.id) : "" }))}
                    placeholder={`Type ${editForm.lead_received_from} name`}
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">KYV Status</label>
                <AutocompleteInput
                  value={editForm.kyv_status || ""}
                  onChange={(v) => setEditForm((f: any) => ({ ...f, kyv_status: v }))}
                  options={["kyv_pending","kyv_pending_approval","kyv_success","kyv_hotlisted"]}
                  placeholder="Type KYV status"
                />
              </div>

              {/* Payment fields */}
              <div>
                <label className="block font-semibold mb-1">Payment To Be Collected</label>
                <input
                  name="payment_to_collect"
                  type="number"
                  step="0.01"
                  value={editForm.payment_to_collect || ""}
                  onChange={handleEditChange}
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
                  value={editForm.payment_to_send || ""}
                  onChange={handleEditChange}
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
                  value={editForm.net_value || ""}
                  onChange={handleEditChange}
                  readOnly
                  className="w-full border p-2 rounded bg-gray-50"
                  placeholder="0.00"
                />
              </div>

              {/* Pickup Point */}
              <div className="lg:col-span-2">
                <label className="block font-semibold mb-1">Pick-up Point</label>
                <PickupPointAutocomplete
                  value={editSelectedPickup}
                  onSelect={(p) => {
                    setEditSelectedPickup(p);
                    setEditForm((f: any) => ({ ...f, pickup_point_name: p ? p.name : "" }));
                  }}
                />
                <div className="text-xs text-gray-500 mt-1">Type to search (Agent, Shop, Warehouse)</div>
              </div>

              <div className="lg:col-span-4">
                <label className="block font-semibold mb-1">Comments</label>
                <input
                  className="border rounded w-full p-2"
                  name="comments"
                  value={editForm.comments || ""}
                  onChange={handleEditChange}
                />
              </div>

              <div className="lg:col-span-4">
                <label className="block font-semibold mb-1">Details</label>
                <textarea
                  className="border rounded w-full p-2"
                  name="details"
                  value={editForm.details || ""}
                  onChange={handleEditChange}
                  rows={4}
                />
              </div>

              {/* Parent actions */}
              <div className="lg:col-span-4 flex gap-2 justify-end">
                <button type="button" onClick={() => setEditTicket(null)} className="px-4 py-2 rounded border">
                  Cancel
                </button>
                <button className="bg-blue-500 text-white px-4 py-2 rounded" type="submit">
                  Save
                </button>
              </div>
            </form>

            <hr className="my-6" />

            {/* Sub-tickets area */}
            <div>
              <h3 className="text-lg font-bold mb-3">Sub-tickets</h3>

              {/* Existing children list */}
              <div className="mb-4">
                {childLoading ? (
                  <div className="text-gray-500">Loading sub-tickets…</div>
                ) : childList.length === 0 ? (
                  <div className="text-gray-500">No sub-tickets yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {childList.map((c) => (
                      <li key={c.id} className="border rounded p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">#{c.id} — {c.subject}</div>
                            <div className="text-sm text-gray-600">
                              {c.status} {c.ticket_no ? `• ${c.ticket_no}` : ""}
                            </div>
                          </div>
                          <a className="text-orange-600 underline" href={`/admin/tickets/${c.id}`}>
                            Open
                          </a>
                        </div>
                        {c.details ? <div className="mt-1 text-sm">{c.details}</div> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Add sub-tickets dynamically — FULL fieldset like create */}
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">Add Sub-tickets</div>
                <button type="button" onClick={addSubRow} className="text-orange-600 font-semibold">
                  + Add Row
                </button>
              </div>

              <div className="space-y-4">
                {subRows.map((row, i) => (
                  <div key={i} className="border rounded p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Vehicle Reg. No (VRN)</label>
                        <input
                          value={row.vehicle_reg_no}
                          onChange={(e) => updateSubRow(i, "vehicle_reg_no", e.target.value)}
                          className="w-full border p-2 rounded"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Phone</label>
                        <input
                          value={row.phone}
                          onChange={(e) => updateSubRow(i, "phone", e.target.value)}
                          className="w-full border p-2 rounded"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Alt Phone</label>
                        <input
                          value={row.alt_phone}
                          onChange={(e) => updateSubRow(i, "alt_phone", e.target.value)}
                          className="w-full border p-2 rounded"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Subject</label>
                        <AutocompleteInput
                          value={row.subject}
                          onChange={(v) => updateSubRow(i, "subject", v)}
                          options={SUBJECT_OPTIONS}
                          placeholder="Type subject"
                        />
                      </div>

                      {/* Payment & Pickup for sub-rows */}
                      <div>
                        <label className="block font-semibold mb-1">Payment To Be Collected</label>
                        <input
                          value={row.payment_to_collect || ""}
                          onChange={(e) => updateSubRow(i, "payment_to_collect", e.target.value)}
                          type="number"
                          step="0.01"
                          className="w-full border p-2 rounded"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Payment To Be Sent</label>
                        <input
                          value={row.payment_to_send || ""}
                          onChange={(e) => updateSubRow(i, "payment_to_send", e.target.value)}
                          type="number"
                          step="0.01"
                          className="w-full border p-2 rounded"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Net Value</label>
                        <input
                          value={row.net_value || ""}
                          onChange={(e) => updateSubRow(i, "net_value", e.target.value)}
                          type="number"
                          step="0.01"
                          readOnly
                          className="w-full border p-2 rounded bg-gray-50"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Pick-up Point</label>
                        <PickupPointAutocomplete
                          value={row.selectedPickup || null}
                          onSelect={(p) => {
                            updateSubRow(i, "selectedPickup", p);
                            updateSubRow(i, "pickup_point_name", p ? p.name : "");
                          }}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Assigned To</label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <UsersAutocomplete
                              value={row.assigned_to ? { id: Number(row.assigned_to), name: "" } : null}
                              onSelect={(u) => updateSubRow(i, "assigned_to", u ? String(u.id) : "")}
                              placeholder="Type user name"
                            />
                          </div>
                          <button type="button" className="px-3 py-2 border rounded" onClick={() => updateSubRow(i, "assigned_to", String(currentUserId))}>Self</button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Status</label>
                        <AutocompleteInput
                          value={row.status}
                          onChange={(v) => updateSubRow(i, "status", v)}
                          options={STATUS_OPTIONS}
                          placeholder="Type status"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">KYV Status</label>
                        <AutocompleteInput
                          value={row.kyv_status || ""}
                          onChange={(v) => updateSubRow(i, "kyv_status", v)}
                          options={["kyv_pending","kyv_pending_approval","kyv_success","kyv_hotlisted"]}
                          placeholder="Type KYV status"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Lead Received From</label>
                        <AutocompleteInput
                          value={row.lead_received_from}
                          onChange={(v) => { updateSubRow(i, "lead_received_from", v); handleRowSourceChange(i, v); }}
                          options={LEAD_SOURCE_OPTIONS}
                          placeholder="Type source"
                        />

                        {row.lead_received_from === "Shop" && (
                          <div className="mt-2">
                            <ShopAutocomplete
                              value={row.selectedShop || null}
                              onSelect={(shop) => {
                                updateSubRow(i, "selectedShop", shop);
                                updateSubRow(i, "lead_by", shop ? String(shop.id) : "");
                              }}
                            />
                          </div>
                        )}

                        {["Toll-agent", "ASM", "TL", "Manager"].includes(row.lead_received_from) && (
                          <div className="mt-2">
                            <UsersAutocomplete
                              role={row.lead_received_from}
                              value={row.lead_by ? { id: Number(row.lead_by), name: "" } : null}
                              onSelect={(u) => updateSubRow(i, "lead_by", u ? String(u.id) : "")}
                              placeholder={`Type ${row.lead_received_from} name`}
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Customer Name</label>
                        <input
                          value={row.customer_name}
                          onChange={(e) => updateSubRow(i, "customer_name", e.target.value)}
                          className="w-full border p-2 rounded"
                        />
                      </div>

                      <div className="lg:col-span-4">
                        <label className="block font-semibold mb-1">Details</label>
                        <textarea
                          value={row.details}
                          onChange={(e) => updateSubRow(i, "details", e.target.value)}
                          className="w-full border p-2 rounded"
                          rows={3}
                        />
                      </div>

                      <div className="lg:col-span-4">
                        <label className="block font-semibold mb-1">Comments</label>
                        <input
                          value={row.comments}
                          onChange={(e) => updateSubRow(i, "comments", e.target.value)}
                          className="w-full border p-2 rounded"
                        />
                      </div>

                      <div className="lg:col-span-4 text-right">
                        <button type="button" onClick={() => removeSubRow(i)} className="text-red-600 hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={createNewSubTickets}
                  disabled={addingSubs || subRows.every((r) => !r.subject.trim())}
                  className="bg-orange-500 text-white px-4 py-2 rounded disabled:opacity-60"
                >
                  {addingSubs ? "Adding…" : `Create ${subRows.filter((r) => r.subject.trim()).length || ""} Sub-ticket(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket (Modal) — same as create-new page */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8 w-full max-w-5xl relative mx-2 overflow-y-auto max-h-[95vh]">
            <button
              className="absolute top-3 right-3 text-gray-600 hover:text-red-500 text-2xl font-bold"
              onClick={() => setShowCreateModal(false)}
              aria-label="Close"
            >
              ×
            </button>

            <h2 className="text-xl font-bold mb-4">Create Ticket</h2>

            <form onSubmit={submitFullCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-semibold mb-1">Vehicle Reg. No (VRN)</label>
                <input
                  name="vehicle_reg_no"
                  required
                  value={fcForm.vehicle_reg_no}
                  onChange={fcHandleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Phone</label>
                <input
                  name="phone"
                  required
                  value={fcForm.phone}
                  onChange={fcHandleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Alt Phone</label>
                <input
                  name="alt_phone"
                  value={fcForm.alt_phone}
                  onChange={fcHandleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Subject</label>
                <AutocompleteInput
                  value={fcForm.subject}
                  onChange={(v) => setFcForm((f) => ({ ...f, subject: v }))}
                  options={SUBJECT_OPTIONS}
                  placeholder="Type subject"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Assigned To</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <UsersAutocomplete
                      value={fcForm.assigned_to ? { id: Number(fcForm.assigned_to), name: "" } : null}
                      onSelect={(u) => setFcForm((f) => ({ ...f, assigned_to: u ? String(u.id) : "" }))}
                      placeholder="Type user name"
                    />
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 border rounded"
                    onClick={() => setFcForm((f) => ({ ...f, assigned_to: String(currentUserId) }))}
                    title="Assign to self"
                  >
                    Self
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Status</label>
                <AutocompleteInput
                  value={fcForm.status}
                  onChange={(v) => setFcForm((f) => ({ ...f, status: v }))}
                  options={STATUS_OPTIONS}
                  placeholder="Type status"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">KYV Status</label>
                <AutocompleteInput
                  value={fcForm.kyv_status}
                  onChange={(v) => setFcForm((f) => ({ ...f, kyv_status: v }))}
                  options={[
                    "kyv_pending",
                    "kyv_pending_approval",
                    "kyv_success",
                    "kyv_hotlisted",
                  ]}
                  placeholder="Type KYV status"
                />
              </div>

              {/* Payment fields */}
              <div>
                <label className="block font-semibold mb-1">Payment To Be Collected</label>
                <input
                  name="payment_to_collect"
                  type="number"
                  step="0.01"
                  value={fcForm.payment_to_collect}
                  onChange={fcHandleChange}
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
                  value={fcForm.payment_to_send}
                  onChange={fcHandleChange}
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
                  value={fcForm.net_value}
                  onChange={fcHandleChange}
                  readOnly
                  className="w-full border p-2 rounded bg-gray-50"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Lead Received From</label>
                <AutocompleteInput
                  value={fcForm.lead_received_from}
                  onChange={(v) => setFcForm((f) => ({ ...f, lead_received_from: v }))}
                  options={LEAD_SOURCE_OPTIONS}
                  placeholder="Type source"
                />

                {fcForm.lead_received_from === "Shop" && (
                  <div className="mt-2">
                    <ShopAutocomplete
                      value={fcSelectedShop}
                      onSelect={(shop) => {
                        setFcSelectedShop(shop);
                        setFcForm((f) => ({ ...f, role_user_id: shop ? shop.id : "" }));
                      }}
                    />
                  </div>
                )}

                {["Toll-agent", "ASM", "TL", "Manager"].includes(fcForm.lead_received_from) && (
                  <div className="mt-2">
                    <UsersAutocomplete
                      role={fcForm.lead_received_from}
                      value={fcForm.role_user_id ? { id: Number(fcForm.role_user_id), name: "" } : null}
                      onSelect={(u) => setFcForm((f) => ({ ...f, role_user_id: u ? String(u.id) : "" }))}
                      placeholder={`Type ${fcForm.lead_received_from} name`}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1">Customer Name</label>
                <input
                  name="customer_name"
                  value={fcForm.customer_name}
                  onChange={fcHandleChange}
                  className="w-full border p-2 rounded"
                />
              </div>

              {/* Pickup Point (search with suggestions) */}
              <div className="lg:col-span-2">
                <label className="block font-semibold mb-1">Pick-up Point</label>
                <PickupPointAutocomplete
                  value={selectedPickup}
                  onSelect={(p) => setSelectedPickup(p)}
                />
                <div className="text-xs text-gray-500 mt-1">Type to search (Agent, Shop, Warehouse)</div>
              </div>

              <div className="lg:col-span-4 md:col-span-2">
                <label className="block font-semibold mb-1">Details</label>
                <textarea
                  name="details"
                  value={fcForm.details}
                  onChange={fcHandleChange}
                  className="w-full border p-2 rounded"
                  rows={3}
                />
              </div>

              <div className="lg:col-span-4 md:col-span-2">
                <label className="block font-semibold mb-1">Comments</label>
                <input
                  name="comments"
                  value={fcForm.comments}
                  onChange={fcHandleChange}
                  className="w-full border p-2 rounded"
                />
              </div>

              {/* Sub-issues rows removed in Create Ticket modal as requested */}

              {/* Actions */}
              <div className="lg:col-span-4 md:col-span-2 flex gap-2 justify-end">
                {fcError && <div className="text-red-600 mr-auto">{fcError}</div>}
                <button type="button" className="px-4 py-2 rounded border" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fcSaving}
                  className="bg-orange-500 text-white px-6 py-2 rounded shadow hover:bg-orange-600 disabled:opacity-60"
                >
                  {fcSaving ? "Saving..." : "Create Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
