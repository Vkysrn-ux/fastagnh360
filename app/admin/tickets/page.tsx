"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import CreateSubTicketFullModal from "@/components/tickets/CreateSubTicketFullModal";
import { formatERPDate } from "@/lib/date-format";
import CreateTicketFullModal from "@/components/tickets/CreateTicketFullModal";
import UsersAutocomplete, { type UserOption } from "@/components/UsersAutocomplete";
import PickupPointAutocomplete, { type PickupPoint } from "@/components/PickupPointAutocomplete";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Ticket {
  id: string;
  ticket_no: string;
  customer_name: string;
  phone?: string;
  subject: string;
  details?: string;
  status: string;
  vehicle_reg_no?: string;
  vehicle_number?: string;
  created_at?: string;
  subs_count?: number;
}

function StatusBadge({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "open":
        return "bg-yellow-100 text-yellow-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <span
      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
        status
      )}`}
    >
      {status.replace("_", " ").charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function TicketListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]); // for stats across parents + subs
  const [loading, setLoading] = useState(true);
  const [editTicket, setEditTicket] = useState<Ticket | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [childrenMap, setChildrenMap] = useState<Record<string, Ticket[]>>({});
  const [loadingChildFor, setLoadingChildFor] = useState<string | null>(null);
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<UserOption | null>(null);
  const ymd = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
  const [fromDate, setFromDate] = useState<string>(() => ymd(startOfMonth()));
  const [toDate, setToDate] = useState<string>(() => ymd(endOfMonth()));
  const [paidViaFilter, setPaidViaFilter] = useState<string>("all");
  const [paymentReceivedFilter, setPaymentReceivedFilter] = useState<string>("all");
  // More filters
  const [leadFromFilter, setLeadFromFilter] = useState<string>("all");
  const [kyvStatusFilter, setKyvStatusFilter] = useState<string>("all");
  const [npciStatusFilter, setNpciStatusFilter] = useState<string>("all");
  const [commissionFilter, setCommissionFilter] = useState<string>("all"); // all|done|pending
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all"); // all|done|nil|pending
  const [paymentNilFilter, setPaymentNilFilter] = useState<string>("all"); // all|yes|no
  const [createdByFilter, setCreatedByFilter] = useState<UserOption | null>(null);
  const [fastagBankFilter, setFastagBankFilter] = useState<string>("all");
  const [fastagClassFilter, setFastagClassFilter] = useState<string>("all");
  const [fastagOwnerFilter, setFastagOwnerFilter] = useState<string>("all"); // all|Admin|Agent|User
  const [bankLoginUserFilter, setBankLoginUserFilter] = useState<string>("all"); // by name
  const [hasFastagFilter, setHasFastagFilter] = useState<string>("all"); // all|yes|no
  const [hasSubsFilter, setHasSubsFilter] = useState<string>("all"); // all|yes|no (parents only)
  // Filters layout
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(false);
  // Role
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [sessionUserId, setSessionUserId] = useState<number | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tickets");
      if (!response.ok) throw new Error("Failed to fetch tickets");
      const data = await response.json();
      setTickets(data);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async (parentId: string) => {
    setLoadingChildFor(parentId);
    try {
      const res = await fetch(`/api/tickets?parent_id=${parentId}`);
      const data = await res.json();
      setChildrenMap((prev) => ({ ...prev, [parentId]: Array.isArray(data) ? data : [] }));
    } catch (e) {
      setChildrenMap((prev) => ({ ...prev, [parentId]: [] }));
    } finally {
      setLoadingChildFor(null);
    }
  };

  const toggleExpand = (t: Ticket) => {
    const pid = String(t.id);
    setExpanded((prev) => ({ ...prev, [pid]: !prev[pid] }));
    if (!childrenMap[pid]) {
      fetchChildren(pid);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Load session (cached) to decide if stats should show and who the user is
  useEffect(() => {
    (async () => {
      try {
        const { getAuthSessionCached } = await import('@/lib/client/cache');
        const data: any = await getAuthSessionCached();
        const session = (data && (data.session || data)) as any;
        const display = String(session?.displayRole || '').toLowerCase();
        setIsSuperAdmin(display === 'super admin');
        setIsAdmin(display === 'admin');
        const uid = Number(session?.id || 0);
        setSessionUserId(Number.isFinite(uid) && uid > 0 ? uid : null);
      } catch {
        setIsSuperAdmin(false);
        setIsAdmin(false);
        setSessionUserId(null);
      }
    })();
  }, []);

  // Fetch all tickets (parents + subs) for accurate dashboard stats
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/tickets?scope=all');
        const data = await res.json();
        setAllTickets(Array.isArray(data) ? data : []);
      } catch {
        setAllTickets([]);
      }
    })();
  }, []);

  // Dashboard-style counts
  const stats = React.useMemo(() => {
    const toLower = (s: any) => String(s || '').toLowerCase();
    const isClosedLike = (t: Ticket) => {
      const st = toLower(t.status);
      return st === 'closed' || st === 'completed';
    };
    // Always use the full dataset for global stats; personalize only "My Tickets" below
    const baseAll = (allTickets && allTickets.length > 0) ? allTickets : tickets;
    const base = baseAll;
    const total = base.length;
    const pending = base.filter((t) => toLower(t.status) === 'open').length;
    const closed = base.filter((t) => isClosedLike(t)).length;
    const cancelled = base.filter((t) => toLower(t.status) === 'cancelled').length;
    const fastagSold = base.filter((t: any) => !!t.fastag_serial && isClosedLike(t)).length;
    const fastagUsedNotClosed = base.filter((t: any) => !!t.fastag_serial && !isClosedLike(t)).length;
    const active = base.filter((t) => {
      const st = toLower(t.status);
      return !isClosedLike(t) && st !== 'cancelled';
    }).length;
    const fastagUsedAll = (() => {
      const set = new Set<string>();
      for (const t of base as any[]) {
        const s = String(t.fastag_serial || '').trim();
        if (s) set.add(s.toLowerCase());
      }
      return set.size;
    })();
    // "My Tickets": open tickets created by OR assigned to the logged-in user
    const myActive = (sessionUserId
      ? (baseAll as any[]).filter((t: any) => {
          const st = toLower(t.status);
          if (st !== 'open') return false;
          const a = Number(t?.assigned_to || 0);
          const c = Number(t?.created_by || 0);
          return a === sessionUserId || c === sessionUserId;
        }).length
      : 0);

    const activationPending = (base as any[]).filter((t: any) => toLower(t.npci_status || '') === 'activation pending').length;
    const kyvPending = (base as any[]).filter((t: any) => {
      const s = toLower(t.kyv_status || '');
      return s === 'kyv pending' || s === 'pending' || s.includes('pending');
    }).length;
    const hotlisted = (base as any[]).filter((t: any) => {
      const s = toLower(t.npci_status || t.status || '');
      return s.includes('hotlist');
    }).length;
    const paymentPending = (base as any[]).filter((t: any) => {
      const received = t.payment_received === 1 || t.payment_received === true || t.payment_received === '1';
      const isNil = !!t.payment_nil;
      return !received && !isNil;
    }).length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateOnly = (d: any) => {
      try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; }
    };
    const todayCancelled = (base as any[]).filter((t: any) => toLower(t.status || '') === 'cancelled' && dateOnly(t.created_at) === todayStr).length;
    const deliveryPickupPending = (base as any[]).filter((t: any) => {
      const done = !!t.delivery_done;
      const nil = !!t.delivery_nil;
      return !done && !nil; // treat as pending
    }).length;

    return {
      total,
      pending,
      closed,
      cancelled,
      fastagSold,
      fastagUsedNotClosed,
      fastagUsedAll,
      active,
      // extra stats
      myActive,
      activationPending,
      kyvPending,
      hotlisted,
      paymentPending,
      todayCancelled,
      deliveryPickupPending,
    };
  }, [tickets, allTickets, isSuperAdmin, isAdmin, sessionUserId]);

  // Build dynamic options from current list for certain filters
  const filterOptions = React.useMemo(() => {
    const uniq = (arr: any[]) => Array.from(new Set(arr.filter((v) => String(v ?? '').trim() !== '')));
    const leadFrom = uniq(tickets.map((t: any) => t.lead_received_from));
    const kyv = uniq(tickets.map((t: any) => t.kyv_status));
    const npci = uniq(tickets.map((t: any) => t.npci_status));
    const fBank = uniq(tickets.map((t: any) => t.fastag_bank || t.bank_name));
    const fClass = uniq(tickets.map((t: any) => t.fastag_class));
    const fOwner = uniq(tickets.map((t: any) => t.fastag_owner));
    const bankLoginUsers = uniq(tickets.map((t: any) => t.fastag_bank_login_user_name));
    return {
      leadFrom: leadFrom.sort(),
      kyv: kyv.sort(),
      npci: npci.sort(),
      fBank: fBank.sort(),
      fClass: fClass.sort(),
      fOwner: fOwner.sort(),
      bankLoginUsers: bankLoginUsers.sort(),
    };
  }, [tickets]);

  const filteredTickets = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
    return tickets.filter((t) => {
      // search match
      const inSearch =
        q === "" ||
        String(t.ticket_no || "").toLowerCase().includes(q) ||
        String(t.customer_name || "").toLowerCase().includes(q) ||
        String(t.phone || "").toLowerCase().includes(q) ||
        String(t.vehicle_reg_no || t.vehicle_number || "").toLowerCase().includes(q) ||
        String(t.subject || "").toLowerCase().includes(q) ||
        // allow searching by FASTag barcode if present on ticket
        String((t as any).fastag_serial || "").toLowerCase().includes(q);

      // status match
      const st = String(t.status || "").toLowerCase();
      const statusOk = filterStatus === "all" || st === filterStatus.toLowerCase();

      // assigned match (we only have id in dataset when navigating to ticket detail; keep basic for now)
      const assignedOk = !assignedFilter || String((t as any).assigned_to || "") === String(assignedFilter.id);

      // date range (created_at is ISO or string)
      let dateOk = true;
      if (from || to) {
        const created = t.created_at ? new Date(t.created_at) : null;
        if (!created) dateOk = false;
        if (from && created && created < from) dateOk = false;
        if (to && created && created > to) dateOk = false;
      }
      // paid via filter
      const paidVia = String((t as any).paid_via ?? '').trim();
      const paidViaOk = paidViaFilter === 'all' || paidVia === paidViaFilter;

      // payment received filter
      const pr = (t as any).payment_received;
      const prBool = pr === 1 || pr === true || pr === '1';
      const prOk = paymentReceivedFilter === 'all' || (paymentReceivedFilter === 'yes' ? prBool : !prBool);

      // lead from filter
      const leadFrom = String((t as any).lead_received_from ?? '').trim();
      const leadFromOk = leadFromFilter === 'all' || leadFrom === leadFromFilter;

      // kyv status filter
      const kyv = String((t as any).kyv_status ?? '').trim();
      const kyvOk = kyvStatusFilter === 'all' || kyv === kyvStatusFilter;

      // npci status filter
      const npci = String((t as any).npci_status ?? '').trim();
      const npciOk = npciStatusFilter === 'all' || npci === npciStatusFilter;

      // commission filter
      const commissionDone = !!((t as any).commission_done);
      const commissionOk =
        commissionFilter === 'all' ||
        (commissionFilter === 'done' ? commissionDone : !commissionDone);

      // delivery filter
      const deliveryDone = !!((t as any).delivery_done);
      const deliveryNil = !!((t as any).delivery_nil);
      const deliveryOk =
        deliveryFilter === 'all' ||
        (deliveryFilter === 'done' && deliveryDone) ||
        (deliveryFilter === 'nil' && deliveryNil) ||
        (deliveryFilter === 'pending' && !deliveryDone && !deliveryNil);

      // payment nil filter
      const paymentNil = !!((t as any).payment_nil);
      const paymentNilOk =
        paymentNilFilter === 'all' ||
        (paymentNilFilter === 'yes' && paymentNil) ||
        (paymentNilFilter === 'no' && !paymentNil);

      // created by filter (requires t.created_by presence when column exists)
      const createdById = (t as any).created_by;
      const createdByOk = !createdByFilter || String(createdById || '') === String(createdByFilter.id);

      // fastag specific filters
      const fBank = String(((t as any).fastag_bank || (t as any).bank_name) ?? '').trim();
      const fClass = String((t as any).fastag_class ?? '').trim();
      const fOwner = String((t as any).fastag_owner ?? '').trim();
      const fBankLoginUserName = String((t as any).fastag_bank_login_user_name ?? '').trim();
      const fSerial = String((t as any).fastag_serial ?? '').trim();

      const fBankOk = fastagBankFilter === 'all' || fBank === fastagBankFilter;
      const fClassOk = fastagClassFilter === 'all' || fClass === fastagClassFilter;
      const fOwnerOk = fastagOwnerFilter === 'all' || fOwner === fastagOwnerFilter;
      const fLoginUserOk = bankLoginUserFilter === 'all' || fBankLoginUserName === bankLoginUserFilter;
      const hasFastagOk =
        hasFastagFilter === 'all' ||
        (hasFastagFilter === 'yes' ? !!fSerial : !fSerial);

      // subs filter (only meaningful for parent rows which is what we list)
      const subsCount = Number((t as any).subs_count || 0);
      const subsOk =
        hasSubsFilter === 'all' ||
        (hasSubsFilter === 'yes' ? subsCount > 0 : subsCount === 0);

      return (
        inSearch &&
        statusOk &&
        assignedOk &&
        dateOk &&
        paidViaOk &&
        prOk &&
        leadFromOk &&
        kyvOk &&
        npciOk &&
        commissionOk &&
        deliveryOk &&
        paymentNilOk &&
        createdByOk &&
        fBankOk &&
        fClassOk &&
        fOwnerOk &&
        fLoginUserOk &&
        hasFastagOk &&
        subsOk
      );
    });
  }, [
    tickets,
    searchQuery,
    filterStatus,
    assignedFilter,
    fromDate,
    toDate,
    paidViaFilter,
    paymentReceivedFilter,
    leadFromFilter,
    kyvStatusFilter,
    npciStatusFilter,
    commissionFilter,
    deliveryFilter,
    paymentNilFilter,
    createdByFilter?.id,
    fastagBankFilter,
    fastagClassFilter,
    fastagOwnerFilter,
    bankLoginUserFilter,
    hasFastagFilter,
    hasSubsFilter,
  ]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
        <CreateTicketFullModal
          onCreated={() => fetchTickets()}
          asButtonClassName="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          label="Create New Ticket"
        />
      </div>

      {/* Quick stats
          - Super Admin: overall counts (parents + subs when available)
          - Admin: only their tickets (assigned_to or created_by)
       */}
      {/* Show stats for all roles; "My Tickets" is personalized */}
      <div className="flex flex-wrap gap-3 mb-4">
          {/* Open + My Tickets */}
          <div className="rounded border p-3 min-w-[190px]">
            <div className="text-sm">Open Tickets: {stats.pending}</div>
            <div className="text-sm">My Tickets: {stats.myActive}</div>
          </div>
          {/* Activation Pending */}
          <div className="rounded border p-3 min-w-[190px]">
            <div className="text-sm">Activation Pending: {stats.activationPending}</div>
          </div>
          {/* KYV Pending */}
          <div className="rounded border p-3 min-w-[190px]">
            <div className="text-sm">KYV Pending: {stats.kyvPending}</div>
          </div>
          {/* Hotlisted */}
          <div className="rounded border p-3 min-w-[150px]">
            <div className="text-sm">Hotlisted: {stats.hotlisted}</div>
          </div>
          {/* Payment Pending */}
          <div className="rounded border p-3 min-w-[190px]">
            <div className="text-sm">Payment Pending: {stats.paymentPending}</div>
          </div>
          {/* Today Cancelled */}
          <div className="rounded border p-3 min-w-[190px]">
            <div className="text-sm">Today Cancelled: {stats.todayCancelled}</div>
          </div>
          {/* Delivery/Pickup Pending */}
          <div className="rounded border p-3 min-w-[230px]">
            <div className="text-sm">Delivery/Pickup Pending: {stats.deliveryPickupPending}</div>
          </div>
        </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="text-sm font-medium text-gray-700">Filters</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFiltersExpanded(v => !v)}
              className="text-sm px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100"
            >
              {filtersExpanded ? 'Collapse' : 'Expand (show all)'}
            </button>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterStatus("all");
                setAssignedFilter(null);
                setFromDate(ymd(startOfMonth()));
                setToDate(ymd(endOfMonth()));
                setPaidViaFilter("all");
                setPaymentReceivedFilter("all");
                setLeadFromFilter("all");
                setKyvStatusFilter("all");
                setNpciStatusFilter("all");
                setCommissionFilter("all");
                setDeliveryFilter("all");
                setPaymentNilFilter("all");
                setCreatedByFilter(null);
                setFastagBankFilter("all");
                setFastagClassFilter("all");
                setFastagOwnerFilter("all");
                setBankLoginUserFilter("all");
                setHasFastagFilter("all");
                setHasSubsFilter("all");
              }}
              className="text-sm px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100"
            >
              Reset
            </button>
          </div>
        </div>
        <div className={`grid grid-cols-1 ${filtersExpanded ? 'md:grid-cols-7' : 'md:grid-cols-5'} gap-3`}>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <Input placeholder="Ticket no, customer, phone, vehicle, subject" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="kyc_pending">KYC Pending</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
            <UsersAutocomplete value={assignedFilter} onSelect={setAssignedFilter} placeholder="Type user name" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">KYV Status</label>
            <select className="w-full border rounded p-2" value={kyvStatusFilter} onChange={(e)=> setKyvStatusFilter(e.target.value)}>
              <option value="all">All</option>
              {filterOptions.kyv.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Payment Status</label>
            <select className="w-full border rounded p-2" value={paymentReceivedFilter} onChange={(e)=> setPaymentReceivedFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="yes">Received</option>
              <option value="no">Pending</option>
            </select>
          </div>
          {filtersExpanded && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </>
          )}
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Paid Via</label>
              <select className="w-full border rounded p-2" value={paidViaFilter} onChange={(e)=> setPaidViaFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="Pending">Pending</option>
                <option value="Paytm QR">Paytm QR</option>
                <option value="GPay Box">GPay Box</option>
                <option value="IDFC Box">IDFC Box</option>
                <option value="Cash">Cash</option>
                <option value="Sriram Gpay">Sriram Gpay</option>
                <option value="Lakshman Gpay">Lakshman Gpay</option>
                <option value="Arjunan Gpay">Arjunan Gpay</option>
                <option value="Vishnu GPay">Vishnu GPay</option>
                <option value="Vimal GPay">Vimal GPay</option>
              </select>
            </div>
          )}
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Lead From</label>
              <select className="w-full border rounded p-2" value={leadFromFilter} onChange={(e)=> setLeadFromFilter(e.target.value)}>
                <option value="all">All</option>
                {filterOptions.leadFrom.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}
          
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">NPCI Status</label>
              <select className="w-full border rounded p-2" value={npciStatusFilter} onChange={(e)=> setNpciStatusFilter(e.target.value)}>
                <option value="all">All</option>
                {filterOptions.npci.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Commission</label>
              <select className="w-full border rounded p-2" value={commissionFilter} onChange={(e)=> setCommissionFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="done">Done</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          )}
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery</label>
              <select className="w-full border rounded p-2" value={deliveryFilter} onChange={(e)=> setDeliveryFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="done">Done</option>
                <option value="nil">Nil</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          )}
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Payment Nil</label>
              <select className="w-full border rounded p-2" value={paymentNilFilter} onChange={(e)=> setPaymentNilFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          )}
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Created By</label>
              <UsersAutocomplete value={createdByFilter} onSelect={setCreatedByFilter} placeholder="Type user name" />
            </div>
          )}
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">FASTag Bank</label>
              <select className="w-full border rounded p-2" value={fastagBankFilter} onChange={(e)=> setFastagBankFilter(e.target.value)}>
                <option value="all">All</option>
                {filterOptions.fBank.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">FASTag Class</label>
              <select className="w-full border rounded p-2" value={fastagClassFilter} onChange={(e)=> setFastagClassFilter(e.target.value)}>
                <option value="all">All</option>
                {filterOptions.fClass.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">FASTag Owner</label>
              <select className="w-full border rounded p-2" value={fastagOwnerFilter} onChange={(e)=> setFastagOwnerFilter(e.target.value)}>
                <option value="all">All</option>
                {filterOptions.fOwner.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}
          {filtersExpanded && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bank Login User</label>
              <select className="w-full border rounded p-2" value={bankLoginUserFilter} onChange={(e)=> setBankLoginUserFilter(e.target.value)}>
                <option value="all">All</option>
                {filterOptions.bankLoginUsers.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}
          {filtersExpanded && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Has FASTag</label>
                <select className="w-full border rounded p-2" value={hasFastagFilter} onChange={(e)=> setHasFastagFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Has Sub-tickets</label>
                <select className="w-full border rounded p-2" value={hasSubsFilter} onChange={(e)=> setHasSubsFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="bg-gray-50">
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Ticket Number
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Customer
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Subject
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Vehicle Number
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Lead From
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Ticket Status
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Commission / Delivery
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  KYV Status
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Assigned To
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Created By
                </th>
                
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTickets.map((ticket) => (
                <React.Fragment key={String(ticket.id)}>
                <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(ticket)}>
                  <td className="px-3 py-3 whitespace-normal break-words text-sm font-medium text-gray-900">
                    <div className="flex flex-col">
                      <span>
                        {ticket.ticket_no || `TK-A${String(ticket.id).padStart(4,'0')}`}
                        {Number(ticket.subs_count || 0) > 0 && (
                          <span className="ml-2 text-xs text-gray-500">({ticket.subs_count} subs)</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        {ticket.created_at ? formatERPDate(ticket.created_at as any) : "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-normal break-words">
                    <div className="text-sm text-gray-900">
                      {ticket.customer_name}
                    </div>
                    {ticket.phone && (
                      <div className="text-sm text-gray-500">{ticket.phone}</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col">
                      <div className="text-sm text-gray-900">{ticket.subject}</div>
                      <div className="text-xs text-gray-500">{(ticket as any).fastag_bank || (ticket as any).bank_name || '-'}</div>
                      {ticket.details && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {ticket.details.length > 20 ? `${ticket.details.slice(0, 20)}...` : ticket.details}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-normal break-words text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span>{ticket.vehicle_reg_no || ticket.vehicle_number || "-"}</span>
                      <span className="text-xs text-gray-500">{(ticket as any).npci_status || '-'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-normal break-words text-sm text-gray-500">
                    {ticket.lead_received_from || '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-normal break-words">
                    <StatusBadge status={ticket.status || "open"} />
                  </td>
                  <td className="px-3 py-3 whitespace-normal break-words text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span>Commission: {((ticket as any).commission_done ? 'Done' : 'Pending')}</span>
                      <span>Delivery: {((ticket as any).delivery_done ? 'Done' : ((ticket as any).delivery_nil ? 'Nil' : 'Pending'))}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-normal break-words text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span>{ticket.kyv_status || '-'}</span>
                      <span className="text-xs text-gray-500">Payment: {((ticket as any).payment_received ? 'Received' : ((ticket as any).payment_nil ? 'Nil' : 'Pending'))}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-normal break-words text-sm text-gray-900">{(ticket as any).assigned_to_name || (ticket.assigned_to ? `#${ticket.assigned_to}` : '-')}</td>
                  <td className="px-3 py-3 whitespace-normal break-words text-sm text-gray-500">{(ticket as any).created_by_name || '-'} </td>
                  
                  <td className="px-3 py-3 whitespace-normal break-words text-sm font-medium">
                    <Link href={`/admin/tickets/${ticket.id}`} className="text-blue-600 hover:text-blue-900 mr-4" onClick={(e) => e.stopPropagation()}>
                      View
                    </Link>
                    <button onClick={(e) => { e.stopPropagation(); setEditTicket(ticket); }} className="text-indigo-600 hover:text-indigo-900 mr-4">
                      Edit
                    </button>
                    <CreateSubTicketFullModal
                      parent={ticket as any}
                      onCreated={() => {
                        // Refresh both the parent list (for subs_count) and the expanded children
                        fetchTickets();
                        fetchChildren(String(ticket.id));
                      }}
                      asButtonClassName="text-green-600 hover:text-green-900"
                      label="Create Sub-ticket"
                    />
                  </td>
                </tr>
                {expanded[String(ticket.id)] && (
                  <tr>
                    <td colSpan={11} className="bg-gray-50 px-3 py-3">
                      {loadingChildFor === String(ticket.id) ? (
                        <div className="text-sm text-gray-500">Loading sub-tickets...</div>
                      ) : (childrenMap[String(ticket.id)] || []).length === 0 ? (
                        <div className="text-sm text-gray-500">No sub-tickets</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 table-fixed">
                            <thead className="sticky top-0 z-10 bg-gray-100">
                              <tr className="bg-gray-100">
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket Number</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle Number</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead From</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission / Delivery</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KYV Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {(childrenMap[String(ticket.id)] || []).map((child: any) => (
                                <tr key={child.id}>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                    <div className="flex flex-col">
                                      <span>{child.ticket_no}</span>
                                      <span className="text-xs text-gray-500">{child.created_at ? formatERPDate(child.created_at as any) : '-'}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm">
                                    <div className="text-gray-900">{child.customer_name || '-'}</div>
                                    {child.phone && (<div className="text-gray-500 text-xs">{child.phone}</div>)}
                                  </td>
                                  <td className="px-4 py-2 text-sm">
                                    <div className="flex flex-col">
                                      <span>{child.subject || '-'}</span>
                                      <span className="text-xs text-gray-500">{child.fastag_bank || child.bank_name || '-'}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm">
                                    <div className="flex flex-col">
                                      <span>{child.vehicle_reg_no || child.vehicle_number || '-'}</span>
                                      <span className="text-xs text-gray-500">{child.npci_status || '-'}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-500">{child.lead_received_from || '-'}</td>
                                  <td className="px-4 py-2 text-sm"><StatusBadge status={child.status || 'open'} /></td>
                                  <td className="px-4 py-2 text-sm text-gray-500">
                                    <div className="flex flex-col">
                                      <span>Commission: {child.commission_done ? 'Done' : 'Pending'}</span>
                                      <span>Delivery: {child.delivery_done ? 'Done' : (child.delivery_nil ? 'Nil' : 'Pending')}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-500">
                                    <div className="flex flex-col">
                                      <span>{child.kyv_status || '-'}</span>
                                      <span className="text-xs text-gray-500">Payment: {child.payment_received ? 'Received' : (child.payment_nil ? 'Nil' : 'Pending')}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900">{child.assigned_to_name || (child.assigned_to ? `#${child.assigned_to}` : '-')}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500">{child.created_by_name || '-'}</td>
                                  <td className="px-4 py-2 text-sm">
                                    <Link
                                      href={`/admin/tickets/${child.id}`}
                                      className="text-blue-600 hover:text-blue-900 mr-4"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View
                                    </Link>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEditTicket(child as any); }}
                                      className="text-indigo-600 hover:text-indigo-900"
                                    >
                                      Edit
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-3 text-center text-sm text-gray-500"
                  >
                    No tickets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      
      {/* Range shortcuts */}
      <div className="mt-3 flex items-center justify-center gap-2">
        {(() => {
          const curStart = ymd(startOfMonth());
          const curEnd = ymd(endOfMonth());
          const isThisMonth = fromDate === curStart && toDate === curEnd;
          if (isThisMonth) {
            return (
              <>
                <button
                  className="text-sm px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100"
                  onClick={() => {
                    const prev = addMonths(new Date(), -1);
                    setFromDate(ymd(startOfMonth(prev)));
                    setToDate(ymd(endOfMonth()));
                  }}
                >
                  Load Previous Month
                </button>
                <button
                  className="text-sm px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100"
                  onClick={() => {
                    const start3 = addMonths(new Date(), -2);
                    setFromDate(ymd(startOfMonth(start3)));
                    setToDate(ymd(endOfMonth()));
                  }}
                >
                  Show Last 3 Months
                </button>
              </>
            );
          }
          return (
            <button
              className="text-sm px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100"
              onClick={() => {
                setFromDate(curStart);
                setToDate(curEnd);
              }}
            >
              Back to This Month
            </button>
          );
        })()}
      </div>
      
    </div>
    {editTicket && (
      <EditTicketModal
        ticket={editTicket}
        onClose={() => setEditTicket(null)}
        onSaved={() => {
          setEditTicket(null);
          fetchTickets();
        }}
      />
    )}
    </>
  );
}


  function EditTicketModal({ ticket, onClose, onSaved }: { ticket: any; onClose: () => void; onSaved: () => void }) {
  // Normalize KYV status values between DB and UI
  function canonicalizeKyv(val: any): string {
    const s = String(val ?? '').toLowerCase().trim();
    if (!s) return '';
    if (s === 'nil') return 'nil';
    if (s === 'kyv_success' || s.includes('compliant')) return 'compliant';
    if (s === 'kyv_pending_approval' || s.includes('submitted')) return 'submitted';
    if (s === 'kyv_pending' || s.includes('pending')) return 'pending';
    return s;
  }
  function kyvLabelFromCanonical(c: string): string {
    switch ((c || '').toLowerCase()) {
      case 'pending': return 'KYV pending';
      case 'submitted': return 'KYV submitted';
      case 'compliant': return 'KYV compliant';
      case 'nil': return 'Nil';
      default: return c || '';
    }
  }
  const originalKyvRef = React.useRef<string | null>(canonicalizeKyv((ticket as any)?.kyv_status ?? ''));
  const [form, setForm] = React.useState({
    vehicle_reg_no: ticket?.vehicle_reg_no || ticket?.vehicle_number || "",
    alt_vehicle_reg_no: (ticket as any)?.alt_vehicle_reg_no || "",
    phone: ticket?.phone || "",
    alt_phone: ticket?.alt_phone || "",
    subject: ticket?.subject || "",
    details: ticket?.details || "",
    status: ticket?.status || "open",
    kyv_status: canonicalizeKyv(ticket?.kyv_status || ""),
    npci_status: (ticket as any)?.npci_status || "Activation Pending",
    assigned_to: ticket?.assigned_to ? String(ticket.assigned_to) : "",
    lead_received_from: ticket?.lead_received_from || "",
    lead_by: ticket?.lead_by ? String(ticket.lead_by) : "",
    customer_name: ticket?.customer_name || "",
    payment_to_collect: ticket?.payment_to_collect ?? "",
    payment_to_send: ticket?.payment_to_send ?? "",
    net_value: ticket?.net_value ?? "",
    pickup_point_name: ticket?.pickup_point_name || "",
    commission_amount: (ticket as any)?.commission_amount ?? "",
    lead_commission: (ticket as any)?.lead_commission ?? "",
    pickup_commission: (ticket as any)?.pickup_commission ?? "",
    paid_via: (ticket as any)?.paid_via || 'Pending',
    payment_received: !!(ticket as any)?.payment_received,
    payment_nil: !!(ticket as any)?.payment_nil,
    delivery_done: !!(ticket as any)?.delivery_done,
    delivery_nil: !!(ticket as any)?.delivery_nil,
    commission_done: !!(ticket as any)?.commission_done,
    // commission flags
    lead_commission_paid: !!(ticket as any)?.lead_commission_paid,
    lead_commission_nil: !!(ticket as any)?.lead_commission_nil,
    pickup_commission_paid: !!(ticket as any)?.pickup_commission_paid,
    pickup_commission_nil: !!(ticket as any)?.pickup_commission_nil,
    fastag_serial: (ticket as any)?.fastag_serial || "",
    fastag_bank: (ticket as any)?.fastag_bank || "",
    fastag_class: (ticket as any)?.fastag_class || "",
    fastag_owner: (ticket as any)?.fastag_owner || "",
    fastag_bank_login_user_name: (ticket as any)?.fastag_bank_login_user_name || "",
    // documents
    rc_front_url: (ticket as any)?.rc_front_url || "",
    rc_back_url: (ticket as any)?.rc_back_url || "",
    pan_url: (ticket as any)?.pan_url || "",
    aadhaar_front_url: (ticket as any)?.aadhaar_front_url || "",
    aadhaar_back_url: (ticket as any)?.aadhaar_back_url || "",
    vehicle_front_url: (ticket as any)?.vehicle_front_url || "",
    vehicle_side_url: (ticket as any)?.vehicle_side_url || "",
    sticker_pasted_url: (ticket as any)?.sticker_pasted_url || "",
  });
  const [fastagQuery, setFastagQuery] = React.useState<string>(String((ticket as any)?.fastag_serial || ""));
  const [fastagOptions, setFastagOptions] = React.useState<any[]>([]);
  const [showFastagSuggestions, setShowFastagSuggestions] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Keep originalKyvRef in sync when opening a different ticket in the modal
  React.useEffect(() => {
    try { originalKyvRef.current = canonicalizeKyv((ticket as any)?.kyv_status ?? ''); } catch {}
  }, [ticket?.id]);
  // Auto-save state
  const autoSaveTimer = React.useRef<any>(null);
  const [autoSaving, setAutoSaving] = React.useState(false);
  const [autoSavedAt, setAutoSavedAt] = React.useState<number | null>(null);
  const [autoSaveError, setAutoSaveError] = React.useState<string | null>(null);
  // Notes state
  const [selectedUserNotes, setSelectedUserNotes] = React.useState<string>("");
  const [leadNotes, setLeadNotes] = React.useState<string>("");
  const [currentUser, setCurrentUser] = React.useState<{ id: number; name: string } | null>(null);
  const [assignedUser, setAssignedUser] = React.useState<UserOption | null>(() => {
    const idNum = Number(ticket?.assigned_to);
    if (!isNaN(idNum) && idNum > 0) {
      return { id: idNum, name: ticket?.assigned_to_name || `User #${idNum}` } as any;
    }
    return null;
  });
  const [leadUser, setLeadUser] = React.useState<UserOption | null>(() => {
    const idNum = Number((ticket as any)?.lead_by);
    if (!isNaN(idNum) && idNum > 0) {
      return { id: idNum, name: (ticket as any)?.lead_received_from || `User #${idNum}` } as any;
    }
    return null;
  });
  const [pickupSameAsLead, setPickupSameAsLead] = React.useState<boolean>(false);
  const [selectedPickup, setSelectedPickup] = React.useState<PickupPoint | null>(() => {
    const name = String((ticket as any)?.pickup_point_name || '').trim();
    return name ? ({ id: 0, name, type: 'user' } as PickupPoint) : null;
  });
  // Load FASTag suggestions for Edit modal when user types (>= 2 chars)
  React.useEffect(() => {
    const term = (fastagQuery || (form as any).fastag_serial || "").toString().trim();
    if (term.length < 2) { setFastagOptions([]); return; }
    const bank = String((form as any).fastag_bank || '').trim();
    const klass = String((form as any).fastag_class || '').trim();
    if (bank && klass) {
      const p = new URLSearchParams();
      p.set('bank', bank);
      p.set('class', klass);
      p.set('query', term);
      p.set('limit', '20');
      // Restrict to mapping-done when picking FASTag for ticket updates
      p.set('mapping', 'done');
      fetch(`/api/fastags/available?${p.toString()}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(rows => { const list = Array.isArray(rows) ? rows : []; setFastagOptions(list); if (list.length > 0) setShowFastagSuggestions(true); })
        .catch(() => setFastagOptions([]));
      return;
    }
    const params = new URLSearchParams();
    params.set('query', term);
    if (bank) params.set('bank', bank);
    // Restrict to mapping-done in generic search as well
    params.set('mapping', 'done');
    fetch(`/api/fastags?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(rows => { const list = Array.isArray(rows) ? rows : []; setFastagOptions(list); if (list.length > 0) setShowFastagSuggestions(true); })
      .catch(() => setFastagOptions([]));
  }, [fastagQuery, (form as any).fastag_bank, (form as any).fastag_class]);

  // Helpers to validate requirements when moving ticket to a closed/completed state
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
      'cancelled': 'closed',
      'cust cancelled': 'closed',
    };
    return map[s] || s || 'open';
  }

  function isCloseLikeStatus(v: any): boolean {
    const n = normalizeStatusClient(v);
    return n === 'closed' || n === 'completed';
  }

  function validateCloseRequirements(f: typeof form): { ok: boolean; message?: string } {
    // Payment: must be Received or Nil; and if Received, paid_via cannot be 'Pending'
    const paidVia = String((f as any).paid_via ?? '').trim();
    const paymentReceived = !!f.payment_received;
    const paymentNil = !!(f as any).payment_nil;
    const paymentOK = paymentReceived || paymentNil;
    const paidViaOK = !paymentReceived || (paidVia !== '' && paidVia !== 'Pending');

    // Delivery must be Done or Nil
    const deliveryOK = !!f.delivery_done || !!(f as any).delivery_nil;

    // Lead commission must be Paid or Nil
    const leadOK = !!(f as any).lead_commission_paid || !!(f as any).lead_commission_nil;

    // Pickup commission must be Paid or Nil
    const pickupOK = !!(f as any).pickup_commission_paid || !!(f as any).pickup_commission_nil;

    // KYV must be compliant or Nil
    const kyv = String(f.kyv_status ?? '').toLowerCase();
    const kyvOK = kyv.includes('compliant') || kyv === 'nil' || kyv === 'kyv compliant';

    const missing: string[] = [];
    if (!paymentOK) missing.push('Payment (Received or Nil)');
    if (paymentReceived && !paidViaOK) missing.push("Paid via (cannot be 'Pending')");
    if (!leadOK) missing.push('Lead Commission (Paid or Nil)');
    if (!pickupOK) missing.push('Pickup Commission (Paid or Nil)');
    if (!deliveryOK) missing.push('Delivery/Pickup (Done or Nil)');
    if (!kyvOK) missing.push('KYV (Compliant or Nil)');

    if (missing.length) {
      return {
        ok: false,
        message: `Cannot mark as Completed. Please complete: ${missing.join(', ')}.`,
      };
    }
    return { ok: true };
  }

  // Keep pickup point in sync with lead when checkbox is checked
  React.useEffect(() => {
    if (pickupSameAsLead) {
      setForm((f) => ({ ...f, pickup_point_name: f.lead_received_from }));
      setSelectedPickup({ id: 0, name: String((form as any).lead_received_from || ''), type: 'user' } as any);
    }
  }, [pickupSameAsLead, (form as any).lead_received_from]);

  // FASTag helpers: banks and class options
  const BANK_OPTIONS = ['SBI','IDFC','ICICI','EQUITAS','INDUSIND','QUIKWALLET','Bajaj','Axis','HDFC','KVB','KOTAK'];
  const VEHICLE_CLASS_OPTIONS = [
    { code: 'class4', label: 'Class 4 (Car/Jeep/Van)' },
    { code: 'class20', label: 'Class 20 (TATA Ace/Dost/Pickup)' },
    { code: 'class5', label: 'Class 5/9 (LCV/Mini-Bus 2Axle)' },
    { code: 'class6', label: 'Class 6/8/11 (3Axle)' },
    { code: 'class7', label: 'Class 7/10 (Truck/Bus 2Axle)' },
    { code: 'class12', label: 'Class 12/13/14 (Axle4/5/6)' },
    { code: 'class15', label: 'Class 15 (Axle7&above)' },
    { code: 'class16', label: 'Class 16/17 (Earth-Moving-Heavy)' },
  ];
  function normalizeFastagClass(val: any) {
    const v = String(val || '').trim();
    if (!v) return '';
    const byCode = VEHICLE_CLASS_OPTIONS.find(o => o.code.toLowerCase() === v.toLowerCase());
    if (byCode) return byCode.code;
    const byLabel = VEHICLE_CLASS_OPTIONS.find(o => o.label.toLowerCase() === v.toLowerCase());
    return byLabel ? byLabel.code : '';
  }

  async function uploadToServer(file: File): Promise<string> {
    const fd = new FormData();
    fd.set('file', file);
    try { fd.set('ticket', String(ticket?.ticket_no || ticket?.id || 'misc')); } catch {}
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    let data: any = null;
    let text: string | null = null;
    try {
      if (ct.includes('application/json')) {
        data = await res.json();
      } else {
        text = await res.text();
        try { data = JSON.parse(text); } catch { /* non-JSON HTML or plain text */ }
      }
    } catch {
      try { text = await res.text(); } catch {}
    }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || text || `Upload failed (${res.status})`;
      throw new Error(typeof msg === 'string' ? msg : 'Upload failed');
    }
    const url = data?.url || data?.Location || data?.location || data?.fileUrl || null;
    if (!url) {
      throw new Error('Upload failed: no URL returned by server');
    }
    return String(url);
  }

  function UploadField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
    const [dragOver, setDragOver] = React.useState(false);

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
      // Fallback via items
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

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    return (
      <div>
        <label className="block text-sm font-medium mb-1">{label}</label>
        <div
          className={`flex items-center gap-2`}
        >
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
          {value && (
            <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">View</a>
          )}
        </div>
      </div>
    );
  }

  React.useEffect(() => {
    // Load session for "Self" name/id (cached)
    import('@/lib/client/cache').then(({ getAuthSessionCached }) =>
      getAuthSessionCached()
        .then((data: any) => {
          const s = (data && (data.session || data)) as any;
          if (s?.id) setCurrentUser({ id: Number(s.id), name: s.name || 'Me' });
        })
        .catch(() => {})
    );
  }, []);

  // Fetch notes when Assigned user changes
  React.useEffect(() => {
    if (!assignedUser?.id) { setSelectedUserNotes(""); return; }
    import('@/lib/client/cache').then(({ getUserByIdCached }) =>
      getUserByIdCached(Number(assignedUser.id))
        .then((u) => setSelectedUserNotes(u?.notes || ""))
        .catch(() => setSelectedUserNotes(""))
    );
  }, [assignedUser?.id]);

  // Fetch notes when Lead user changes
  React.useEffect(() => {
    if (!leadUser?.id) { setLeadNotes(""); return; }
    import('@/lib/client/cache').then(({ getUserByIdCached }) =>
      getUserByIdCached(Number(leadUser.id))
        .then((u) => setLeadNotes(u?.notes || ""))
        .catch(() => setLeadNotes(""))
    );
  }, [leadUser?.id]);

  // Fallback: If ticket has only lead_received_from name (no id), try fetching by name to show notes
  React.useEffect(() => {
    if (leadUser?.id) return; // primary effect handles id case
    const name = String(form.lead_received_from || '').trim();
    if (!name) { setLeadNotes(''); return; }
    const ctrl = new AbortController();
    fetch(`/api/users?name=${encodeURIComponent(name)}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then((rows) => {
        const arr = Array.isArray(rows) ? rows : [];
        setLeadNotes(arr[0]?.notes || '');
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.lead_received_from]);

  // When payment is marked received, require explicit Paid via selection.
  // Do not auto-change from 'Pending'; validation handles prompting the user.
  React.useEffect(() => {
    // Intentionally no-op: keep user's current selection.
  }, [form.payment_received]);

  React.useEffect(() => {
    // auto-calc net value when payments change
    const a = parseFloat(String(form.payment_to_collect || ""));
    const b = parseFloat(String(form.payment_to_send || ""));
    const hasAny = String(form.payment_to_collect ?? "") !== "" || String(form.payment_to_send ?? "") !== "";
    let sumStr = "";
    if (hasAny) {
      const aNum = isNaN(a) ? 0 : a;
      const bNum = isNaN(b) ? 0 : b;
      const sum = aNum + bNum;
      sumStr = (Number.isInteger(sum) ? String(sum) : sum.toFixed(2));
    }
    if (form.net_value !== sumStr) setForm((f) => ({ ...f, net_value: sumStr }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.payment_to_collect, form.payment_to_send]);

  function canAutoSave(f: typeof form): { ok: boolean; reason?: string; phone?: string; alt?: string | null } {
    try {
      const phoneStr = String(f.phone || "");
      const altStr = String(f.alt_phone || "");
      const re = /^(?:\+?91[\-\s]?|0)?([6-9]\d{9})$/;
      const m = phoneStr.match(re);
      if (!m) return { ok: false, reason: 'invalid_phone' };
      let altNorm: string | null = null;
      if (altStr.trim() !== "") {
        const ma = altStr.match(re);
        if (!ma) return { ok: false, reason: 'invalid_alt' };
        altNorm = ma[1];
      }
      if (!(String(f.status || '').toLowerCase() === 'cancelled') && !!f.payment_received && String(((f as any).paid_via || '')).trim() === 'Pending') {
        return { ok: false, reason: 'paid_via_pending' };
      }
      // If cancelling: require details
      const statusLower = String(f.status || '').toLowerCase();
      if (statusLower === 'cancelled' && !String(f.details || '').trim()) {
        return { ok: false, reason: 'cancel_details_required' } as any;
      }
      // Only enforce for 'completed' now
      if (statusLower === 'completed') {
        const chk = validateCloseRequirements(f);
        if (!chk.ok) return { ok: false, reason: 'close_requirements' };
      }
      return { ok: true, phone: m[1], alt: altNorm };
    } catch {
      return { ok: false };
    }
  }

  async function autoSaveNow(valid: { phone: string; alt: string | null } | null = null) {
    try {
      setAutoSaving(true);
      setAutoSaveError(null);
      // Compute basics and reuse validation if not provided
      const v = valid || (canAutoSave(form).ok ? (canAutoSave(form) as any) : null);
      if (!v) { setAutoSaving(false); return; }
      const payload: any = {
        id: Number(ticket.id),
        vehicle_reg_no: form.vehicle_reg_no,
        alt_vehicle_reg_no: (form as any).alt_vehicle_reg_no || null,
        phone: v.phone,
        alt_phone: v.alt,
        subject: form.subject,
        details: form.details,
        status: form.status,
        npci_status: (form as any).npci_status || null,
        assigned_to: form.assigned_to === "" ? null : (isNaN(Number(form.assigned_to)) ? null : Number(form.assigned_to)),
        lead_received_from: form.lead_received_from,
        lead_by: form.lead_by === "" ? null : form.lead_by,
        customer_name: form.customer_name,
        pickup_point_name: form.pickup_point_name || null,
        payment_to_collect: form.payment_to_collect === "" ? null : Number(form.payment_to_collect),
        payment_to_send: form.payment_to_send === "" ? null : Number(form.payment_to_send),
        net_value: form.net_value === "" ? null : Number(form.net_value),
        commission_amount: form.commission_amount === "" ? null : Number(form.commission_amount),
        lead_commission: (form as any).lead_commission === "" ? null : Number((form as any).lead_commission),
        pickup_commission: (form as any).pickup_commission === "" ? null : Number((form as any).pickup_commission),
        fastag_serial: form.fastag_serial || null,
        fastag_bank: (form as any).fastag_bank || null,
        fastag_class: (form as any).fastag_class || null,
        fastag_owner: (form as any).fastag_owner || null,
        paid_via: (form as any).paid_via,
        payment_received: !!form.payment_received,
        payment_nil: !!(form as any).payment_nil,
        delivery_done: !!form.delivery_done,
        delivery_nil: !!(form as any).delivery_nil,
        commission_done: !!form.commission_done,
        // commissions flags
        lead_commission: (form as any).lead_commission === "" ? null : Number((form as any).lead_commission),
        lead_commission_paid: !!(form as any).lead_commission_paid,
        lead_commission_nil: !!(form as any).lead_commission_nil,
        pickup_commission: (form as any).pickup_commission === "" ? null : Number((form as any).pickup_commission),
        pickup_commission_paid: !!(form as any).pickup_commission_paid,
        pickup_commission_nil: !!(form as any).pickup_commission_nil,
        // documents
        rc_front_url: (form as any).rc_front_url || null,
        rc_back_url: (form as any).rc_back_url || null,
        pan_url: (form as any).pan_url || null,
        aadhaar_front_url: (form as any).aadhaar_front_url || null,
        aadhaar_back_url: (form as any).aadhaar_back_url || null,
        vehicle_front_url: (form as any).vehicle_front_url || null,
        vehicle_side_url: (form as any).vehicle_side_url || null,
        sticker_pasted_url: (form as any).sticker_pasted_url || null,
      };
      // Include kyv_status only if changed by user (send friendly label)
      try {
        const orig = canonicalizeKyv(originalKyvRef.current ?? '');
        const curr = canonicalizeKyv(form.kyv_status ?? '');
        if (orig !== curr) {
          payload.kyv_status = kyvLabelFromCanonical(curr) || null;
        }
      } catch {}
      const res = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update ticket");
      setAutoSavedAt(Date.now());
    } catch (e: any) {
      setAutoSaveError(e?.message || 'Auto-save failed');
    } finally {
      setAutoSaving(false);
    }
  }

  // Debounced auto-save on form changes
  React.useEffect(() => {
    // Only attempt autosave when data is valid enough and ticket exists
    if (!ticket) return;
    const v = canAutoSave(form);
    if (!v.ok) { return; }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSaveNow({ phone: v.phone as string, alt: (v as any).alt ?? null });
    }, 1200);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Reset suggestions visibility when ticket changes (modal opens)
  React.useEffect(() => {
    setShowFastagSuggestions(false);
  }, [ticket?.id]);

  // Load FASTag info from DB when user interacts with barcode field (>= 2 chars)
  React.useEffect(() => {
    const term = (fastagQuery || form.fastag_serial || "").toString().trim();
    if (term.length < 2 || !showFastagSuggestions) { setFastagOptions([]); return; }
    const bank = String((form as any).fastag_bank || '').trim();
    const klass = String((form as any).fastag_class || '').trim();
    // When both bank and class are known, use the lightweight availability endpoint
    if (bank && klass) {
      const p = new URLSearchParams();
      p.set('bank', bank);
      p.set('class', klass);
      p.set('query', term);
      p.set('limit', '20');
      // Restrict to mapping-done when picking FASTag (secondary Edit flow)
      p.set('mapping', 'done');
      fetch(`/api/fastags/available?${p.toString()}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(rows => setFastagOptions(Array.isArray(rows) ? rows : []))
        .catch(() => setFastagOptions([]));
      return;
    }
    // Fallback: generic search
    const params = new URLSearchParams();
    params.set('query', term);
    if (bank) params.set('bank', bank);
    // Restrict to mapping-done in fallback generic search
    params.set('mapping', 'done');
    fetch(`/api/fastags?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(rows => {
        const list = Array.isArray(rows) ? rows : [];
        setFastagOptions(list);
      })
      .catch(() => setFastagOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fastagQuery, showFastagSuggestions, (form as any).fastag_bank, (form as any).fastag_class]);

  async function save() {
    try {
      setSaving(true);
      setError(null);
      // Validate mobile numbers
      const phoneStr = String(form.phone || "");
      const altStr = String(form.alt_phone || "");
      const re = /^(?:\+?91[\-\s]?|0)?([6-9]\d{9})$/;
      const m = phoneStr.match(re);
      if (!m) { setError("Enter a valid 10-digit mobile (starts 6-9)"); setSaving(false); return; }
      let altNorm: string | null = null;
      if (altStr.trim() !== "") {
        const ma = altStr.match(re);
        if (!ma) { setError("Enter a valid 10-digit alt mobile (starts 6-9)"); setSaving(false); return; }
        altNorm = ma[1];
      }
      const statusLower = String(form.status || '').toLowerCase();
      // Business rule: if payment is received, Paid via cannot be 'Pending' (skip when cancelling)
      if (statusLower !== 'cancelled' && !!form.payment_received && String((form as any).paid_via || '').trim() === 'Pending') {
        setError("Paid via cannot be 'Pending' when Payment Received is checked.");
        setSaving(false);
        return;
      }
      // If cancelling: require details
      if (statusLower === 'cancelled' && !String(form.details || '').trim()) {
        setError('Please add details/reason before cancelling.');
        setSaving(false);
        return;
      }
      // Only enforce close requirements when marking Completed
      if (statusLower === 'completed') {
        const chk = validateCloseRequirements(form);
        if (!chk.ok) {
          setError(chk.message || 'Please complete required fields before closing.');
          setSaving(false);
          return;
        }
      }

      const payload: any = {
        id: Number(ticket.id),
        vehicle_reg_no: form.vehicle_reg_no,
        alt_vehicle_reg_no: (form as any).alt_vehicle_reg_no || null,
        phone: m[1],
        alt_phone: altNorm,
        subject: form.subject,
        details: form.details,
        status: form.status,
        npci_status: (form as any).npci_status || null,
        assigned_to: form.assigned_to === "" ? null : (isNaN(Number(form.assigned_to)) ? null : Number(form.assigned_to)),
        lead_received_from: form.lead_received_from,
        lead_by: form.lead_by === "" ? null : form.lead_by,
        customer_name: form.customer_name,
        
        pickup_point_name: form.pickup_point_name || null,
        payment_to_collect: form.payment_to_collect === "" ? null : Number(form.payment_to_collect),
        payment_to_send: form.payment_to_send === "" ? null : Number(form.payment_to_send),
        net_value: form.net_value === "" ? null : Number(form.net_value),
        commission_amount: form.commission_amount === "" ? null : Number(form.commission_amount),
        lead_commission: (form as any).lead_commission === "" ? null : Number((form as any).lead_commission),
        pickup_commission: (form as any).pickup_commission === "" ? null : Number((form as any).pickup_commission),
        fastag_serial: form.fastag_serial || null,
        fastag_bank: (form as any).fastag_bank || null,
        fastag_class: (form as any).fastag_class || null,
        fastag_owner: (form as any).fastag_owner || null,
        paid_via: (form as any).paid_via,
        payment_received: !!form.payment_received,
        payment_nil: !!(form as any).payment_nil,
        delivery_done: !!form.delivery_done,
        delivery_nil: !!(form as any).delivery_nil,
        commission_done: !!form.commission_done,
        // commissions flags
        lead_commission: (form as any).lead_commission === "" ? null : Number((form as any).lead_commission),
        lead_commission_paid: !!(form as any).lead_commission_paid,
        lead_commission_nil: !!(form as any).lead_commission_nil,
        pickup_commission: (form as any).pickup_commission === "" ? null : Number((form as any).pickup_commission),
        pickup_commission_paid: !!(form as any).pickup_commission_paid,
        pickup_commission_nil: !!(form as any).pickup_commission_nil,
        // documents
        rc_front_url: (form as any).rc_front_url || null,
        rc_back_url: (form as any).rc_back_url || null,
        pan_url: (form as any).pan_url || null,
        aadhaar_front_url: (form as any).aadhaar_front_url || null,
        aadhaar_back_url: (form as any).aadhaar_back_url || null,
        vehicle_front_url: (form as any).vehicle_front_url || null,
        vehicle_side_url: (form as any).vehicle_side_url || null,
        sticker_pasted_url: (form as any).sticker_pasted_url || null,
      };
      // Include kyv_status only if changed by user (send friendly label)
      try {
        const orig = canonicalizeKyv(originalKyvRef.current ?? '');
        const curr = canonicalizeKyv(form.kyv_status ?? '');
        if (orig !== curr) {
          payload.kyv_status = kyvLabelFromCanonical(curr) || null;
        }
      } catch {}
      const res = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update ticket");
      onSaved();
    } catch (e: any) {
      setError(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!ticket} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[95vw] md:max-w-5xl lg:max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Ticket #{ticket?.ticket_no || ticket?.id}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            {/* Row 1: Subject, VRN, Phone, Alt VRN, Customer */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 py-2">
              <div>
                <label className="block text-sm font-medium mb-1">Subject *</label>
                <select className="w-full border rounded p-2" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
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
                <label className="block text-sm font-medium mb-1">Vehicle Reg. No (VRN)</label>
                <Input value={form.vehicle_reg_no} onChange={(e) => setForm({ ...form, vehicle_reg_no: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mobile</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alt Reg Number</label>
                <Input value={(form as any).alt_vehicle_reg_no as any} onChange={(e) => setForm({ ...form, alt_vehicle_reg_no: e.target.value } as any)} placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Customer Name</label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              </div>
            </div>

            {/* Row 2: Lead From, Pickup, Bank, Vehicle Class */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
              <div>
                <label className="block text-sm font-medium mb-1">Lead Received From (Shop/Agent)</label>
                <UsersAutocomplete
                  value={leadUser}
                  onSelect={(u) => {
                    setLeadUser(u as any);
                    setForm((f) => ({
                      ...f,
                      lead_by: u ? String((u as any).id) : "",
                      lead_received_from: u ? String((u as any).name) : "",
                    } as any));
                    if (pickupSameAsLead && u) {
                      setForm((f) => ({ ...f, pickup_point_name: String((u as any).name) }));
                    }
                  }}
                  placeholder="Type shop/agent name"
                />
                {leadNotes && (
                  <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap border rounded p-2 bg-gray-50">{leadNotes}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pick-up Point</label>
                <div className={pickupSameAsLead ? 'opacity-60 pointer-events-none' : ''}>
                  <PickupPointAutocomplete
                    value={selectedPickup}
                    onSelect={(p) => {
                      setSelectedPickup(p);
                      setForm((f) => ({ ...f, pickup_point_name: p ? p.name : '' }));
                    }}
                    placeholder="Type pick-up point name"
                    minChars={1}
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs mt-2">
                  <input
                    type="checkbox"
                    checked={pickupSameAsLead}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setPickupSameAsLead(v);
                      if (v) {
                        setSelectedPickup({ id: 0, name: String((form as any).lead_received_from || ''), type: 'user' });
                        setForm((f) => ({ ...f, pickup_point_name: f.lead_received_from }));
                      } else {
                        // allow manual editing again; keep current text in field
                        setSelectedPickup((prev) => (prev ? { ...prev } : null));
                      }
                    }}
                  />
                  <span>Same as Lead</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bank</label>
                <select
                  className="w-full border rounded p-2"
                  value={((form as any).fastag_bank as any) || ''}
                  onChange={(e) => setForm({ ...form, fastag_bank: e.target.value } as any)}
                >
                  <option value="">Select Bank</option>
                  {BANK_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">VEHICLE CLASS</label>
                <select
                  className="w-full border rounded p-2"
                  value={normalizeFastagClass((form as any).fastag_class)}
                  onChange={(e) => setForm({ ...form, fastag_class: e.target.value } as any)}
                >
                  <option value="">Select Vehicle Class</option>
                  {VEHICLE_CLASS_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: FASTag Barcode + Owner */}
            <div className="mt-0 grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div>
                <label className="block text-sm font-medium mb-1">FASTag Barcode</label>
                <Input
                  value={form.fastag_serial as any}
                  onFocus={() => setShowFastagSuggestions(true)}
                  onChange={(e) => { setForm({ ...form, fastag_serial: e.target.value }); setFastagQuery(e.target.value); setShowFastagSuggestions(true); }}
                  placeholder="Type FASTag barcode"
                />
            {showFastagSuggestions && fastagOptions.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-auto border rounded">
                    {fastagOptions.map((row) => (
                      <div
                        key={row.id || row.tag_serial}
                        className="px-3 py-2 cursor-pointer hover:bg-orange-50 border-b last:border-b-0"
                        onMouseDown={() => {
                          setForm((f) => ({
                            ...f,
                            fastag_serial: row.tag_serial || (f as any).fastag_serial,
                            fastag_bank: row.bank_name || (f as any).fastag_bank,
                            fastag_class: row.fastag_class || (f as any).fastag_class,
                            fastag_bank_login_user_name: (row as any).bank_login_user_name || '',
                            fastag_owner: (() => {
                              const owner = String(((row as any).owner_name || row.assigned_to_name || (row.holder ? String(row.holder) : (f as any).fastag_owner || "")) || '').trim();
                              const login = String(((row as any).bank_login_user_name || '')).trim();
                              return owner && login ? `${owner} / ${login}` : owner || login || '';
                            })(),
                          } as any));
                          setFastagQuery(String(row.tag_serial || ""));
                          setFastagOptions([]);
                        }}
                      >
                        {row.tag_serial} - {row.bank_name} / {row.fastag_class}{row.assigned_to_name ? (' - ' + row.assigned_to_name) : (row.holder ? (' - ' + String(row.holder)) : '')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">FASTag Owner</label>
                <Input
                  value={(() => {
                    const owner = String(((form as any).fastag_owner || '')).trim();
                    const login = String(((form as any).fastag_bank_login_user_name || '')).trim();
                    return owner && login ? `${owner} / ${login}` : owner || login || '';
                  })() as any}
                  readOnly
                  className="bg-gray-50"
                  placeholder="Owner appears after picking"
                />
              </div>
            </div>

            {/* Row 4: Payments */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 py-2">
              <div>
                <label className="block text-sm font-medium mb-1">Payment To Be Collected</label>
                <Input type="number" step="0.01" value={form.payment_to_collect as any} onChange={(e) => setForm({ ...form, payment_to_collect: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment To Be Sent</label>
                <Input type="number" step="0.01" value={form.payment_to_send as any} onChange={(e) => setForm({ ...form, payment_to_send: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Net Value</label>
                <Input type="number" step="0.01" value={form.net_value as any} readOnly className="bg-gray-50" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Paid via</label>
                <select
                  className="w-full border rounded p-2"
                  value={(form as any).paid_via}
                  onChange={(e) => setForm({ ...form, paid_via: e.target.value } as any)}
                >
                  {['Pending','Paytm QR','GPay Box','IDFC Box','Cash','Sriram Gpay','Lakshman Gpay','Arjunan Gpay','Vishnu GPay','Vimal GPay'].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.payment_received} onChange={(e) => setForm({ ...form, payment_received: e.target.checked })} /> Payment Received</label>
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!(form as any).payment_nil} onChange={(e) => setForm({ ...form, payment_nil: e.target.checked } as any)} /> Payment Nil</label>
              </div>
            </div>

            {/* Row 5: Assigned + NPCI + Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
              <div>
                <label className="block text-sm font-medium mb-1">Assigned To</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <UsersAutocomplete 
                      roles={["admin","administrator","super","super-admin","super_admin","super admin","superadmin","employee"]}
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
                {selectedUserNotes && (
                  <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap border rounded p-2 bg-gray-50">{selectedUserNotes}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">NPCI Status</label>
                <select className="w-full border rounded p-2" value={(form as any).npci_status || 'Activation Pending'} onChange={(e)=> setForm({ ...form, npci_status: e.target.value } as any)}>
                  <option>Activation Pending</option>
                  <option>Active</option>
                  <option>Low Balance</option>
                  <option>Hotlist</option>
                  <option>Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ticket Status</label>
                <select
                  className="w-full border rounded p-2"
                  value={form.status}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === 'Cancelled') {
                      // Allow cancelling without checklist; details enforced on save
                      setForm({ ...form, status: next });
                      return;
                    }
                    if (next === 'Completed') {
                      const chk = validateCloseRequirements({ ...(form as any), status: next } as any);
                      if (!chk.ok) {
                        alert(chk.message || 'Cannot mark as Completed until requirements are met.');
                        return;
                      }
                    }
                    setForm({ ...form, status: next });
                  }}
                >
                  <option>Open</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </div>
            </div>

            {/* Row 6: KYV + Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div>
                <label className="block text-sm font-medium mb-1">KYV Status</label>
                <select
                  className="w-full border rounded p-2"
                  value={form.kyv_status}
                  onChange={(e) => setForm({ ...form, kyv_status: e.target.value })}
                >
                  <option value="pending">KYV pending</option>
                  <option value="submitted">KYV submitted</option>
                  <option value="compliant">KYV compliant</option>
                  <option value="nil">Nil</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Details</label>
                <textarea className="w-full border rounded p-2" rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
              </div>
            </div>

            {/* Row 7: Delivery + Commissions like create */}
            <div className="mt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
              <div>
                <label className="block text-sm font-medium mb-1">Lead Commission to Give</label>
                <Input type="number" step="0.01" value={(form as any).lead_commission as any} onChange={(e) => setForm({ ...(form as any), lead_commission: e.target.value } as any)} placeholder="0" />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={!!(form as any).lead_commission_paid} onChange={(e) => setForm({ ...form, lead_commission_paid: e.target.checked } as any)} /> Commission Paid</label>
                <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={!!(form as any).lead_commission_nil} onChange={(e) => setForm({ ...form, lead_commission_nil: e.target.checked } as any)} /> Commission Nil</label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pickup Commission to Give</label>
                <Input type="number" step="0.01" value={(form as any).pickup_commission as any} onChange={(e) => setForm({ ...(form as any), pickup_commission: e.target.value } as any)} placeholder="0" />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={!!(form as any).pickup_commission_paid} onChange={(e) => setForm({ ...form, pickup_commission_paid: e.target.checked } as any)} /> Commission Paid</label>
                <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={!!(form as any).pickup_commission_nil} onChange={(e) => setForm({ ...form, pickup_commission_nil: e.target.checked } as any)} /> Commission Nil</label>
              </div>
            </div>

            {/* Row 8: Delivery flags */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-2">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.delivery_done} onChange={(e) => setForm({ ...form, delivery_done: e.target.checked })} /> Delivery / Pickup Completed</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!(form as any).delivery_nil} onChange={(e) => setForm({ ...form, delivery_nil: e.target.checked } as any)} /> Delivery / Pickup Nil</label>
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
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
        <div className="text-xs mt-1">
          {autoSaving && <span className="text-gray-500">Auto-saving...</span>}
          {!autoSaving && autoSavedAt && !autoSaveError && (
            <span className="text-gray-500">Auto-saved at {new Date(autoSavedAt).toLocaleTimeString()}</span>
          )}
          {!autoSaving && autoSaveError && (
            <span className="text-red-600">{autoSaveError}</span>
          )}
        </div>
        <DialogFooter>
          <button className="px-4 py-2 border rounded" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
















