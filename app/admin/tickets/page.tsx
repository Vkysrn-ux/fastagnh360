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
  const [loading, setLoading] = useState(true);
  const [editTicket, setEditTicket] = useState<Ticket | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [childrenMap, setChildrenMap] = useState<Record<string, Ticket[]>>({});
  const [loadingChildFor, setLoadingChildFor] = useState<string | null>(null);
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<UserOption | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [paidViaFilter, setPaidViaFilter] = useState<string>("all");
  const [paymentReceivedFilter, setPaymentReceivedFilter] = useState<string>("all");

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

  const filteredTickets = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
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

      return inSearch && statusOk && assignedOk && dateOk && paidViaOk && prOk;
    });
  }, [tickets, searchQuery, filterStatus, assignedFilter, fromDate, toDate, paidViaFilter, paymentReceivedFilter]);

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

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
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
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
            <UsersAutocomplete value={assignedFilter} onSelect={setAssignedFilter} placeholder="Type user name" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Payment Received</label>
            <select className="w-full border rounded p-2" value={paymentReceivedFilter} onChange={(e)=> setPaymentReceivedFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
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
                          {ticket.details}
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
  const [form, setForm] = React.useState({
    vehicle_reg_no: ticket?.vehicle_reg_no || ticket?.vehicle_number || "",
    alt_vehicle_reg_no: (ticket as any)?.alt_vehicle_reg_no || "",
    phone: ticket?.phone || "",
    alt_phone: ticket?.alt_phone || "",
    subject: ticket?.subject || "",
    details: ticket?.details || "",
    status: ticket?.status || "open",
    kyv_status: ticket?.kyv_status || "",
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
    delivery_done: !!(ticket as any)?.delivery_done,
    commission_done: !!(ticket as any)?.commission_done,
    fastag_serial: (ticket as any)?.fastag_serial || "",
    fastag_bank: (ticket as any)?.fastag_bank || "",
    fastag_class: (ticket as any)?.fastag_class || "",
    fastag_owner: (ticket as any)?.fastag_owner || "",
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
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [currentUser, setCurrentUser] = React.useState<{ id: number; name: string } | null>(null);
  const [assignedUser, setAssignedUser] = React.useState<UserOption | null>(() => {
    const idNum = Number(ticket?.assigned_to);
    if (!isNaN(idNum) && idNum > 0) {
      return { id: idNum, name: ticket?.assigned_to_name || `User #${idNum}` } as any;
    }
    return null;
  });
  const [pickupSameAsLead, setPickupSameAsLead] = React.useState<boolean>(false);

  // Keep pickup point in sync with lead when checkbox is checked
  React.useEffect(() => {
    if (pickupSameAsLead) {
      setForm((f) => ({ ...f, pickup_point_name: f.lead_received_from }));
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
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    return String(data.url);
  }

  function UploadField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1">{label}</label>
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
          {value && (<a href={value} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">View</a>)}
        </div>
      </div>
    );
  }

  React.useEffect(() => {
    // Load session for "Self" name/id
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const s = data?.session;
        if (s?.id) setCurrentUser({ id: Number(s.id), name: s.name || 'Me' });
      })
      .catch(() => {});
  }, []);

  // If payment is marked received, default paid_via away from 'Pending'
  React.useEffect(() => {
    if (form.payment_received && String((form as any).paid_via || '').trim() === 'Pending') {
      setForm(f => ({ ...(f as any), paid_via: 'Cash' } as any));
    }
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

  // Load FASTag info from DB when user types a barcode (>= 2 chars) and fill bank/class/owner
  React.useEffect(() => {
    const term = (fastagQuery || form.fastag_serial || "").toString().trim();
    if (term.length < 2) { setFastagOptions([]); return; }
    const params = new URLSearchParams();
    params.set('query', term);
        if ((form as any).fastag_bank) params.set('bank', String((form as any).fastag_bank));
    fetch(`/api/fastags?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(rows => {
        const list = Array.isArray(rows) ? rows : [];
        setFastagOptions(list);
        const exact = list.find((r: any) => String(r.tag_serial) === term);
        if (exact) {
          setForm((f) => ({
            ...f,
            fastag_serial: exact.tag_serial || f.fastag_serial,
            fastag_bank: exact.bank_name || (f as any).fastag_bank,
            fastag_class: exact.fastag_class || (f as any).fastag_class,
            fastag_owner: (exact as any).assigned_to_name || (exact.holder ? String(exact.holder) : ((f as any).fastag_owner || "")),
          } as any));
        }
      })
      .catch(() => setFastagOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fastagQuery]);

  async function save() {
    try {
      setSaving(true);
      setError(null);
      // Validate mobile numbers
      const phoneStr = String(form.phone || "");
      const altStr = String(form.alt_phone || "");
      const re = /^(?:\+?91[\-\s]?|0)?([6-9]\d{9})$/;
      const m = phoneStr.match(re);
      if (!m) { setError("Enter a valid 10-digit mobile (starts 6–9)"); setSaving(false); return; }
      let altNorm: string | null = null;
      if (altStr.trim() !== "") {
        const ma = altStr.match(re);
        if (!ma) { setError("Enter a valid 10-digit alt mobile (starts 6–9)"); setSaving(false); return; }
        altNorm = ma[1];
      }
      // Business rule: if payment is received, Paid via cannot be 'Pending'
      if (!!form.payment_received && String((form as any).paid_via || '').trim() === 'Pending') {
        setError("Paid via cannot be 'Pending' when Payment Received is checked.");
        setSaving(false);
        return;
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
        kyv_status: form.kyv_status || null,
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
        delivery_done: !!form.delivery_done,
        commission_done: !!form.commission_done,
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
                <label className="block text-sm font-medium mb-1">Lead Received From</label>
                <Input value={form.lead_received_from} onChange={(e) => setForm({ ...form, lead_received_from: e.target.value })} placeholder="Type source or name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pick-up Point</label>
                <Input value={form.pickup_point_name} readOnly={pickupSameAsLead} onChange={(e) => setForm({ ...form, pickup_point_name: e.target.value })} placeholder="Type pick-up point" />
                <label className="inline-flex items-center gap-2 text-xs mt-2">
                  <input
                    type="checkbox"
                    checked={pickupSameAsLead}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setPickupSameAsLead(v);
                      if (v) setForm((f) => ({ ...f, pickup_point_name: f.lead_received_from }));
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
                <Input value={form.fastag_serial as any} onChange={(e) => { setForm({ ...form, fastag_serial: e.target.value }); setFastagQuery(e.target.value); }} placeholder="Type FASTag barcode" />
                {fastagOptions.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-auto border rounded">
                    {fastagOptions.map((row) => (
                      <div
                        key={row.id}
                        className="px-3 py-2 cursor-pointer hover:bg-orange-50 border-b last:border-b-0"
                        onMouseDown={() => {
                          setForm((f) => ({
                            ...f,
                            fastag_serial: row.tag_serial || (f as any).fastag_serial,
                            fastag_bank: row.bank_name || (f as any).fastag_bank,
                            fastag_class: row.fastag_class || (f as any).fastag_class,
                            fastag_owner: row.holder ? String(row.holder) : (row.assigned_to_name || (f as any).fastag_owner || ""),
                          } as any));
                          setFastagQuery(String(row.tag_serial || ""));
                          setFastagOptions([]);
                        }}
                      >
                        {row.tag_serial} — {row.bank_name} / {row.fastag_class}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">FASTag Owner</label>
                <Input value={(form as any).fastag_owner as any} readOnly className="bg-gray-50" placeholder="Owner appears after picking" />
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
                <select className="w-full border rounded p-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option>New Lead</option>
                  <option>Working</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </div>
            </div>

            {/* Row 6: KYV + Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div>
                <label className="block text-sm font-medium mb-1">KYV Status</label>
                <select className="w-full border rounded p-2" value={form.kyv_status} onChange={(e) => setForm({ ...form, kyv_status: e.target.value })}>
                  <option>KYV pending</option>
                  <option>KYV submitted</option>
                  <option>KYV compliant</option>
                  <option>Nil</option>
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
        <DialogFooter>
          <button className="px-4 py-2 border rounded" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}









