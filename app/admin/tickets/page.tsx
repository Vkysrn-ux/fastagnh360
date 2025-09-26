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
import CreateTicketFullModal from "@/components/tickets/CreateTicketFullModal";
import UsersAutocomplete, { type UserOption } from "@/components/UsersAutocomplete";

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

      <div className="bg-white shadow overflow-hidden sm:rounded-lg border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Ticket No
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Customer
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Subject
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Vehicle
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Created
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickets.map((ticket) => (
                <React.Fragment key={String(ticket.id)}>
                <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(ticket)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {ticket.ticket_no}
                    {Number(ticket.subs_count || 0) > 0 && (
                      <span className="ml-2 text-xs text-gray-500">({ticket.subs_count} subs)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {ticket.customer_name}
                    </div>
                    {ticket.phone && (
                      <div className="text-sm text-gray-500">{ticket.phone}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{ticket.subject}</div>
                    {ticket.details && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {ticket.details}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ticket.vehicle_reg_no || ticket.vehicle_number || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={ticket.status || "open"} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ticket.created_at
                      ? new Date(ticket.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link href={`/admin/tickets/${ticket.id}`} className="text-blue-600 hover:text-blue-900 mr-4" onClick={(e) => e.stopPropagation()}>
                      View
                    </Link>
                    <button onClick={(e) => { e.stopPropagation(); setEditTicket(ticket); }} className="text-indigo-600 hover:text-indigo-900 mr-4">
                      Edit
                    </button>
                    <CreateSubTicketFullModal
                      parent={ticket as any}
                      onCreated={() => fetchTickets()}
                      asButtonClassName="text-green-600 hover:text-green-900"
                      label="Create Sub-ticket"
                    />
                  </td>
                </tr>
                {expanded[String(ticket.id)] && (
                  <tr>
                    <td colSpan={7} className="bg-gray-50 px-6 py-4">
                      {loadingChildFor === String(ticket.id) ? (
                        <div className="text-sm text-gray-500">Loading sub-tickets...</div>
                      ) : (childrenMap[String(ticket.id)] || []).length === 0 ? (
                        <div className="text-sm text-gray-500">No sub-tickets</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket No</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {(childrenMap[String(ticket.id)] || []).map((child) => (
                                <tr key={child.id}>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{child.ticket_no}</td>
                                  <td className="px-4 py-2 text-sm">{child.subject}</td>
                                  <td className="px-4 py-2 text-sm"><StatusBadge status={child.status || "open"} /></td>
                                  <td className="px-4 py-2 text-sm text-gray-500">{child.created_at ? new Date(child.created_at as any).toLocaleString() : '-'}</td>
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
                    className="px-6 py-4 text-center text-sm text-gray-500"
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
    phone: ticket?.phone || "",
    alt_phone: ticket?.alt_phone || "",
    subject: ticket?.subject || "",
    details: ticket?.details || "",
    status: ticket?.status || "open",
    kyv_status: ticket?.kyv_status || "",
    assigned_to: ticket?.assigned_to ? String(ticket.assigned_to) : "",
    lead_received_from: ticket?.lead_received_from || "",
    lead_by: ticket?.lead_by ? String(ticket.lead_by) : "",
    customer_name: ticket?.customer_name || "",
    comments: ticket?.comments || "",
    payment_to_collect: ticket?.payment_to_collect ?? "",
    payment_to_send: ticket?.payment_to_send ?? "",
    net_value: ticket?.net_value ?? "",
    pickup_point_name: ticket?.pickup_point_name || "",
  });
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

  async function save() {
    try {
      setSaving(true);
      setError(null);
      const payload: any = {
        id: Number(ticket.id),
        vehicle_reg_no: form.vehicle_reg_no,
        phone: form.phone,
        alt_phone: form.alt_phone,
        subject: form.subject,
        details: form.details,
        status: form.status,
        kyv_status: form.kyv_status || null,
        assigned_to: form.assigned_to === "" ? null : (isNaN(Number(form.assigned_to)) ? null : Number(form.assigned_to)),
        lead_received_from: form.lead_received_from,
        lead_by: form.lead_by === "" ? null : form.lead_by,
        customer_name: form.customer_name,
        comments: form.comments,
        pickup_point_name: form.pickup_point_name || null,
        payment_to_collect: form.payment_to_collect === "" ? null : Number(form.payment_to_collect),
        payment_to_send: form.payment_to_send === "" ? null : Number(form.payment_to_send),
        net_value: form.net_value === "" ? null : Number(form.net_value),
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
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Edit Ticket #{ticket?.ticket_no || ticket?.id}</DialogTitle>
        </DialogHeader>
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 py-2">
          <div>
            <label className="block text-sm font-medium mb-1">Vehicle Reg. No (VRN)</label>
            <Input value={form.vehicle_reg_no} disabled readOnly className="bg-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Customer Name</label>
            <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 py-2">
          <div>
            <label className="block text-sm font-medium mb-1">Alt Phone</label>
            <Input value={form.alt_phone} onChange={(e) => setForm({ ...form, alt_phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pick-up Point</label>
            <Input value={form.pickup_point_name} onChange={(e) => setForm({ ...form, pickup_point_name: e.target.value })} placeholder="e.g., Warehouse A" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <select className="w-full border rounded p-2" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
              <option value="">Select Subject</option>
              <option value="new_fastag">New FASTag</option>
              <option value="replacement_fastag">Replacement FASTag</option>
              <option value="hotlisted_fastag">Hotlisted FASTag</option>
              <option value="kyc_related">KYC Related</option>
              <option value="mobile_update">Mobile Number Updation</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        {/* Row 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 py-2">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="w-full border rounded p-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="open">Open</option>
              <option value="processing">Processing</option>
              <option value="kyc_pending">KYC Pending</option>
              <option value="done">Done</option>
              <option value="waiting">Waiting</option>
              <option value="closed">Closed</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">KYV Status</label>
            <select className="w-full border rounded p-2" value={form.kyv_status} onChange={(e) => setForm({ ...form, kyv_status: e.target.value })}>
              <option value="">Select KYV status</option>
              <option value="kyv_pending">KYV Pending</option>
              <option value="kyv_pending_approval">KYV Pending Approval</option>
              <option value="kyv_success">KYV Success</option>
              <option value="kyv_hotlisted">KYV Hotlisted</option>
            </select>
          </div>
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
            <label className="block text-sm font-medium mb-1">Lead Received From</label>
            <select className="w-full border rounded p-2" value={form.lead_received_from} onChange={(e) => setForm({ ...form, lead_received_from: e.target.value })}>
              <option value="">Select Source</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Facebook">Facebook</option>
              <option value="Social Media">Social Media</option>
              <option value="Google Map">Google Map</option>
              <option value="Other">Other</option>
              <option value="Toll-agent">Toll-agent</option>
              <option value="ASM">ASM</option>
              <option value="Shop">Shop</option>
              <option value="Showroom">Showroom</option>
              <option value="TL">TL</option>
              <option value="Manager">Manager</option>
            </select>
          </div>
        </div>
        {/* Row 4 */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 py-2">
          <div>
            <label className="block text-sm font-medium mb-1">Lead By (User/Shop ID)</label>
            <Input value={form.lead_by} onChange={(e) => setForm({ ...form, lead_by: e.target.value })} placeholder="e.g., 2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payment To Be Collected</label>
            <Input type="number" step="0.01" value={form.payment_to_collect as any} onChange={(e) => setForm({ ...form, payment_to_collect: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payment To Be Sent</label>
            <Input type="number" step="0.01" value={form.payment_to_send as any} onChange={(e) => setForm({ ...form, payment_to_send: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Net Value</label>
            <Input type="number" step="0.01" value={form.net_value as any} readOnly className="bg-gray-50" />
          </div>
        </div>
        <div className="py-2">
          <label className="block text-sm font-medium mb-1">Details</label>
          <textarea className="w-full border rounded p-2" rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        </div>
        <div className="py-2">
          <label className="block text-sm font-medium mb-1">Comments</label>
          <Input value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <DialogFooter>
          <button className="px-4 py-2 border rounded" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
