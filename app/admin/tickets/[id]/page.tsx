'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, MessageSquare, User, Truck, PhoneCall, Tag, FileText, AlertCircle, CheckCircle, Circle } from 'lucide-react';
import Link from 'next/link';
import { useCanAccessDashboardFeature } from '@/hooks/use-dashboard-permissions';

interface Ticket {
  id: number;
  ticket_no?: string;
  customer_name?: string;
  phone?: string;
  mobile?: string;
  vehicle_reg_no?: string;
  vehicle_number?: string;
  fastag_serial?: string;
  commission_amount?: number;
  lead_received_from?: string;
  source?: string;
  status?: string;
  created_at?: string;
  assigned_to?: string;
  alt_phone?: string;
  lead_by?: string;
  subject?: string;
  details?: string;
  comments?: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return <AlertCircle className="w-4 h-4" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'closed':
        return <Circle className="w-4 h-4" />;
      default:
        return <Circle className="w-4 h-4" />;
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${getStatusColor(status)}`}>
      {getStatusIcon(status)}
      <span className="font-medium capitalize">{status.replace('_', ' ')}</span>
    </div>
  );
};

export default function TicketDetailPage() {
  const { id } = useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const userRole = 'admin'; // Replace with actual user role fetching logic
  const canViewSales = useCanAccessDashboardFeature(userRole, 'viewDailySales');
  const canViewPending = useCanAccessDashboardFeature(userRole, 'viewDailyPendingAmount');

  useEffect(() => {
    fetch(`/api/tickets/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data?.error) setError(data.error);
        else setTicket(data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 text-gray-500">
          <div className="w-8 h-8 border-4 border-t-blue-500 border-r-blue-500 border-b-gray-200 border-l-gray-200 rounded-full animate-spin"></div>
          Loading ticket details...
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    </div>
  );

  if (!ticket) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/admin/tickets" 
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Tickets
            </Link>
            <h1 className="text-2xl font-bold">
              Ticket #{ticket.ticket_no || ticket.id}
            </h1>
          </div>
          <StatusBadge status={ticket.status || 'open'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Subject & Details */}
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
              <div>
                <h2 className="font-medium text-gray-500 mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Subject
                </h2>
                <p className="text-lg">{ticket.subject || 'No subject'}</p>
              </div>
              <div>
                <h2 className="font-medium text-gray-500 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Details
                </h2>
                <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-line">
                  {ticket.details || 'No details provided'}
                </div>
              </div>
              {ticket.comments && (
                <div>
                  <h2 className="font-medium text-gray-500 mb-2">Comments</h2>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {ticket.comments}
                  </div>
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Activity Timeline</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-none">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Ticket Created</p>
                    <p className="text-sm text-gray-500">
                      {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Customer Name</p>
                    <p className="font-medium">{ticket.customer_name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <PhoneCall className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Contact Numbers</p>
                    <p className="font-medium">{ticket.phone || ticket.mobile || '-'}</p>
                    {ticket.alt_phone && (
                      <p className="text-sm text-gray-500 mt-1">Alt: {ticket.alt_phone}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle & FASTag Info */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Vehicle & FASTag Details</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Vehicle Number</p>
                    <p className="font-medium">{ticket.vehicle_reg_no || ticket.vehicle_number || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Tag className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">FASTag Barcode</p>
                    <p className="font-medium">{ticket.fastag_serial || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Additional Details</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Assigned To</p>
                  <p className="font-medium">{ticket.assigned_to || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Source</p>
                  <p className="font-medium">{ticket.lead_received_from || ticket.source || '-'}</p>
                </div>
                {typeof ticket.commission_amount !== 'undefined' && (
                  <div>
                    <p className="text-sm text-gray-500">Commission Amount</p>
                    <p className="font-medium">₹{ticket.commission_amount}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Sales Component - Conditionally Rendered */}
        {canViewSales && (
          <div className="mt-8">
            {/* <DailySalesComponent /> */}
          </div>
        )}
        {canViewPending && (
          <div className="mt-8">
            {/* <PendingAmountSection /> */}
          </div>
        )}
      </div>
    </div>
  
      <style jsx global>{`
        @media print {
          @page { size: landscape; }
          html, body { width: 100%; height: auto; }
        }
      `}</style>
  );
}