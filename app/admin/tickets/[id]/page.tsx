'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function TicketDetailPage() {
  const { id } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/tickets/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data?.error) setError(data.error);
        else setTicket(data);
      });
  }, [id]);

  if (error) return <div className="text-red-500 p-8">Ticket not found.</div>;
  if (!ticket) return <div>Loading...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6">
          Ticket #{ticket.id} {ticket.ticket_no ? <span className="text-gray-500 text-base">({ticket.ticket_no})</span> : null}
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <Detail label="Customer" value={ticket.customer_name} />
          <Detail label="Mobile" value={ticket.phone || ticket.mobile} />
          <Detail label="Vehicle Number" value={ticket.vehicle_reg_no || ticket.vehicle_number} />
          <Detail label="Source" value={ticket.lead_received_from || ticket.source} />
          <Detail label="Status" value={ticket.status} />
          <Detail label="Created At" value={ticket.created_at ? new Date(ticket.created_at).toLocaleString() : "-"} />
          <Detail label="Assigned To" value={ticket.assigned_to} />
          <Detail label="Alt Phone" value={ticket.alt_phone} />
          <Detail label="Lead By" value={ticket.lead_by} />
        </div>
        <div className="mt-6">
          <span className="font-semibold">Subject:</span> {ticket.subject}
        </div>
        <div className="mt-2">
          <span className="font-semibold">Details:</span>
          <div className="whitespace-pre-line border rounded p-3 bg-gray-50 mt-1">
            {ticket.details}
          </div>
        </div>
        {ticket.comments && (
          <div className="mt-4">
            <span className="font-semibold">Comments:</span>
            <div className="whitespace-pre-line border rounded p-3 bg-gray-100 mt-1">
              {ticket.comments}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <span className="font-semibold">{label}:</span> {value ?? "-"}
    </div>
  );
}
