import React, { useState } from 'react';
import {
  X,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  Printer,
  Package,
  XCircle,
  Phone,
  Mail,
  User,
  CreditCard,
  Layers,
  Calendar,
  FileSearch,
} from 'lucide-react';
import { PrintJob, JobStatus, PaymentStatus } from '../../types';
import { api } from '../../services/api';

interface JobDetailModalProps {
  job: PrintJob;
  onClose: () => void;
  onStatusUpdated: (updatedJob: PrintJob) => void;
  onOpenPreview?: (job: PrintJob) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onStatusUpdated,
  onOpenPreview,
}) => {
  const [currentStatus, setCurrentStatus] = useState<JobStatus>(job.job_status);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(job.payment_status);
  const [statusNotes, setStatusNotes] = useState<string>(job.status_notes || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleUpdate = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const updated = await api.updateJobStatus(job.id, {
        status: currentStatus,
        notes: statusNotes,
        payment_status: paymentStatus,
      });
      onStatusUpdated(updated);
      setSaveMessage('Status updated successfully!');
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to update job status.');
    } finally {
      setIsSaving(false);
    }
  };

  const statusOptions: Array<{ value: JobStatus; label: string }> = [
    { value: 'pending', label: 'Pending Approval' },
    { value: 'accepted', label: 'Accepted (Queue)' },
    { value: 'processing', label: 'Processing / Printing' },
    { value: 'ready_for_pickup', label: 'Ready for Pickup' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Print Job Inspection
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {job.job_status.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight mt-0.5">{job.job_number}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Document Section */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-slate-900 truncate">{job.document_name}</p>
                <p className="text-xs text-slate-500">
                  {(job.document_size / (1024 * 1024)).toFixed(2)} MB • {job.document_mime}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onOpenPreview && (
                <button
                  type="button"
                  onClick={() => onOpenPreview(job)}
                  className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <FileSearch className="w-3.5 h-3.5" />
                  <span>Preview & Verify PDF</span>
                </button>
              )}
              <a
                href={`/api/public/documents/${job.document_id}/download?token=${encodeURIComponent(job.tracking_token)}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Download</span>
              </a>
            </div>
          </div>

          {/* Customer & Order Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                Customer Information
              </span>
              <div className="flex items-center gap-2 text-slate-800">
                <User className="w-4 h-4 text-slate-400" />
                <strong className="text-sm font-bold">{job.customer_name || 'Walk-in Customer'}</strong>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-4 h-4 text-slate-400" />
                {job.customer_phone && job.customer_phone !== 'Walk-in' ? (
                  <a href={`tel:${job.customer_phone}`} className="hover:underline font-semibold text-blue-600">
                    {job.customer_phone}
                  </a>
                ) : (
                  <span className="text-slate-400 italic">No phone (Walk-in / Instant)</span>
                )}
              </div>
              {job.customer_email && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{job.customer_email}</span>
                </div>
              )}
              <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1.5 text-blue-700 font-semibold">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Fulfillment: {job.options.pickup_time || (job.options.fulfillment_type === 'pickup' ? 'Scheduled Pickup' : 'Instant Counter Print')}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                Order Details
              </span>
              <div className="flex items-center justify-between text-slate-700">
                <span>Total Payable:</span>
                <strong className="text-sm font-black text-blue-700">
                  GH₵ {job.estimated_total.toFixed(2)}
                </strong>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Payment Method:</span>
                <span className="font-semibold capitalize">{job.payment_method}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Submitted At:</span>
                <span>{new Date(job.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Print Specification Breakdown */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Print Specifications
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Copies</span>
                <strong className="text-slate-900 font-bold">{job.options.copies}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Paper Size</span>
                <strong className="text-slate-900 font-bold">{job.options.paper_size}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Colour Mode</span>
                <strong className="text-slate-900 font-bold">
                  {job.options.color_mode === 'mixed'
                    ? 'Smart Mix'
                    : job.options.color_mode === 'color'
                    ? 'Full Colour'
                    : 'Black & White'}
                </strong>
                {job.options.color_mode === 'mixed' && (
                  <span className="text-[10px] text-indigo-700 block font-semibold">
                    {job.options.color_pages || 0} Colour / {job.options.bw_pages || 0} B&W
                  </span>
                )}
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Sides</span>
                <strong className="text-slate-900 font-bold capitalize">{job.options.sidedness}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Print Pages</span>
                <strong className="text-slate-900 font-bold">
                  {job.options.page_count} pgs {job.options.detected_pages ? `(doc: ${job.options.detected_pages})` : ''}
                </strong>
                {(job.options.color_pages !== undefined || job.options.bw_pages !== undefined) && (
                  <span className="text-[10px] text-slate-500 block">
                    {job.options.color_pages ?? 0}c + {job.options.bw_pages ?? 0}bw
                  </span>
                )}
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Orientation</span>
                <strong className="text-slate-900 font-bold capitalize">{job.options.orientation}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Binding</span>
                <strong className="text-slate-900 font-bold capitalize">
                  {job.options.binding || 'None'}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Lamination</span>
                <strong className="text-slate-900 font-bold capitalize">
                  {job.options.lamination || 'None'}
                </strong>
              </div>
            </div>

            {job.options.additional_instructions && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <strong className="font-bold">Customer Instructions: </strong>
                <span>{job.options.additional_instructions}</span>
              </div>
            )}
          </div>

          {/* Operator Status Controls */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Update Job Status & Customer Feedback
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Production Status
                </label>
                <select
                  value={currentStatus}
                  onChange={(e) => setCurrentStatus(e.target.value as JobStatus)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="pending">Pending Payment</option>
                  <option value="pay_at_shop">Pay At Shop Counter</option>
                  <option value="paid">Paid & Verified</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status Notes / Customer Message (visible on customer tracking screen)
              </label>
              <input
                type="text"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="e.g. Document printed, currently in spiral binding queue. Ready by 2:30 PM."
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {saveMessage && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            onClick={handleUpdate}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            {isSaving ? 'Updating...' : 'Save Status Update'}
          </button>
        </div>
      </div>
    </div>
  );
};
