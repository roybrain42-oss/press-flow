import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Printer,
  Package,
  AlertTriangle,
  XCircle,
  Copy,
  ExternalLink,
  Phone,
  ArrowLeft,
  CreditCard,
  Download,
  Share2,
  MapPin,
  FileText,
  Eye,
  FileSearch,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api } from '../../services/api';
import { PrintJob, JobStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { DocumentThumbnail } from '../common/DocumentThumbnail';
import { JobTrackingPreviewModal } from './JobTrackingPreviewModal';

interface CustomerJobTrackingProps {
  jobNumber: string;
  token?: string;
  initialJob?: PrintJob | null;
  onBackToShop: () => void;
}

export const CustomerJobTracking: React.FC<CustomerJobTrackingProps> = ({
  jobNumber,
  token,
  initialJob,
  onBackToShop,
}) => {
  const { role } = useAuth();
  const isStaffOrOwner = role === 'staff' || role === 'owner' || role === 'super_admin';

  const [job, setJob] = useState<PrintJob | null>(initialJob || null);
  const [press, setPress] = useState<any>(
    initialJob ? { name: (initialJob as any).tenant_name, location: (initialJob as any).tenant_location } : null
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialJob);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

  const fetchJobStatus = async () => {
    if (!jobNumber) return;
    try {
      const activeToken = token || job?.tracking_token;
      const data = await api.trackJob(jobNumber, activeToken);
      setJob(data.job);
      if (data.press) setPress(data.press);
      setError(null);
    } catch (err: any) {
      if (!job) {
        setError(err.message || 'Unable to track job.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialJob) {
      setJob(initialJob);
      setIsLoading(false);
    }
    fetchJobStatus();
    // Poll every 8 seconds for real-time live status updates while viewing
    const interval = setInterval(fetchJobStatus, 8000);
    return () => clearInterval(interval);
  }, [jobNumber, token, initialJob?.id]);

  const copyTrackingLink = () => {
    const activeToken = token || job?.tracking_token;
    const trackingUrl = activeToken
      ? `${window.location.origin}/?track=${encodeURIComponent(jobNumber)}&token=${encodeURIComponent(activeToken)}`
      : `${window.location.origin}/?track=${encodeURIComponent(jobNumber)}`;
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulatePayment = async () => {
    if (!job) return;
    setIsPaying(true);
    try {
      const activeToken = token || job?.tracking_token;
      const res = await api.simulatePaystackPayment(job.id, activeToken || '', job.customer_email);
      setPaySuccess(`Payment of GH₵${res.amount.toFixed(2)} confirmed via Paystack (Ref: ${res.reference})`);
      fetchJobStatus();
    } catch (err: any) {
      alert(err.message || 'Payment simulation failed.');
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-semibold text-slate-600">Retrieving job #{jobNumber}...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Print Job Not Found</h2>
        <p className="text-xs text-slate-600 mb-6">{error || 'Please check your Job Number and Security Token.'}</p>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <button
            onClick={() => {
              setIsLoading(true);
              fetchJobStatus();
            }}
            className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Check Status Again
          </button>
          <button
            onClick={onBackToShop}
            className="w-full py-2.5 px-4 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
          >
            Return to Shop
          </button>
        </div>
      </div>
    );
  }

  // Determine active step index
  const statusSteps: Array<{ key: JobStatus; label: string; icon: any }> = [
    { key: 'pending', label: 'Submitted', icon: Clock },
    { key: 'accepted', label: 'Accepted', icon: CheckCircle2 },
    { key: 'processing', label: 'Printing', icon: Printer },
    { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: Package },
    { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  ];

  const currentStatusIndex = statusSteps.findIndex((s) => s.key === job.job_status);
  const isRejectedOrCancelled = job.job_status === 'rejected' || job.job_status === 'cancelled';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      {/* Top Controls */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBackToShop}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Printing Press</span>
        </button>

        <button
          onClick={copyTrackingLink}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>{copied ? 'Link Copied!' : 'Copy Tracking Link'}</span>
        </button>
      </div>

      {/* Main Job Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        {/* Header Ribbon */}
        <div className="bg-slate-900 text-white p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-0.5">
                Official Print Job Receipt
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                {job.job_number}
              </h1>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Estimated Amount</span>
              <span className="text-2xl font-black text-emerald-400">
                GH₵ {job.estimated_total.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-800 text-xs text-slate-300">
            <div>
              <span className="text-slate-400">Customer: </span>
              <strong className="text-white">{job.customer_name || 'Walk-in Guest'}</strong>
            </div>
            <div>
              <span className="text-slate-400">Collection: </span>
              <strong className="text-blue-300">
                {job.options.pickup_time || (job.options.fulfillment_type === 'pickup' ? 'Scheduled Pickup' : 'Instant Counter Print')}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Submitted: </span>
              <strong className="text-white">
                {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                {new Date(job.created_at).toLocaleDateString()}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Payment: </span>
              <span
                className={`font-bold uppercase px-2 py-0.5 rounded text-[10px] ${
                  job.payment_status === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {job.payment_status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Live Status Tracker Timeline */}
        <div className="p-6 sm:p-7 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">
            Live Production Status
          </h2>

          {isRejectedOrCancelled ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3">
              <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <p className="text-sm font-bold capitalize">Job {job.job_status}</p>
                <p className="text-xs text-rose-600">
                  {job.status_notes || 'This print job was not processed. Please contact the printing press.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Stepper Grid */}
              <div className="grid grid-cols-5 gap-2 text-center">
                {statusSteps.map((step, idx) => {
                  const isDone = currentStatusIndex >= idx;
                  const isCurrent = currentStatusIndex === idx;
                  const StepIcon = step.icon;

                  return (
                    <div key={step.key} className="flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 transition-all ${
                          isDone
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-400'
                        } ${isCurrent ? 'ring-4 ring-blue-100' : ''}`}
                      >
                        <StepIcon className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-[11px] leading-tight ${
                          isCurrent
                            ? 'font-bold text-blue-700'
                            : isDone
                            ? 'font-semibold text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Status Note Alert */}
              {job.status_notes && (
                <div className="mt-5 p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0"></div>
                  <div>
                    <span className="font-bold">Latest Update from Press: </span>
                    <span>{job.status_notes}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Print Specifications Details */}
        <div className="p-6 sm:p-7 space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Job Specifications
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Document</span>
              <strong className="text-slate-800 truncate block mt-0.5">{job.document_name}</strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Copies & Pages</span>
              <strong className="text-slate-800 block mt-0.5">
                {job.options.copies} {job.options.copies === 1 ? 'copy' : 'copies'} ({job.options.page_count} pgs
                {job.options.detected_pages && job.options.detected_pages !== job.options.page_count
                  ? ` of ${job.options.detected_pages} total`
                  : ''})
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Fulfillment / Pickup</span>
              <strong className="text-slate-800 block mt-0.5 truncate">
                {job.options.pickup_time || (job.options.fulfillment_type === 'pickup' ? 'In-Shop Pickup' : 'Instant Counter Print')}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Paper & Colour</span>
              <strong className="text-slate-800 block mt-0.5">
                {job.options.paper_size} • {job.options.color_mode === 'color' ? 'Full Colour' : 'B&W'}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Format</span>
              <strong className="text-slate-800 block mt-0.5 capitalize">
                {job.options.sidedness}-sided • {job.options.orientation}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Binding</span>
              <strong className="text-slate-800 block mt-0.5 capitalize">
                {job.options.binding && job.options.binding !== 'none' ? job.options.binding : 'None'}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Lamination</span>
              <strong className="text-slate-800 block mt-0.5 capitalize">
                {job.options.lamination && job.options.lamination !== 'none' ? job.options.lamination : 'None'}
              </strong>
            </div>
          </div>

          {job.options.additional_instructions && (
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900">
              <span className="font-bold">Your Instructions: </span>
              <span>{job.options.additional_instructions}</span>
            </div>
          )}

          {/* Document Verification & Pre-Press Proof Card */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSearch className="w-4 h-4 text-purple-600" />
                  <span>Document Proof & Inspection</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  Thumbnail Ready
                </span>
              </div>
              {isStaffOrOwner && (
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-blue-600" />
                  Staff Inspection Mode
                </span>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/70 via-slate-50 to-blue-50/50 border border-purple-100 flex flex-col sm:flex-row items-center gap-4">
              {/* Document Thumbnail Component */}
              <div className="w-36 shrink-0">
                <DocumentThumbnail
                  url={`/api/public/documents/${job.document_id}/download?token=${encodeURIComponent(token)}`}
                  documentName={job.document_name}
                  mimeType={job.document_mime}
                  colorMode={job.options?.color_mode || 'color'}
                  sizeBytes={job.document_size}
                  pageCount={job.options?.page_count}
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="w-full"
                />
              </div>

              {/* Information & Action Buttons */}
              <div className="flex-1 min-w-0 space-y-2.5 text-center sm:text-left">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 truncate" title={job.document_name}>
                    {job.document_name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {job.document_size
                      ? `${(job.document_size / (1024 * 1024)).toFixed(2)} MB • `
                      : ''}
                    {job.options?.paper_size || 'A4'} •{' '}
                    {job.options?.color_mode === 'color' ? 'Full Colour' : 'Black & White'} •{' '}
                    {job.options?.page_count || 1} {job.options?.page_count === 1 ? 'page' : 'pages'}
                  </p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {isStaffOrOwner
                    ? 'Verify page order, binding gutters, and laser toner density in the low-resolution proof before printing.'
                    : 'Inspect page boundaries, typography, and paper layout in the low-resolution proof before downloading or collecting.'}
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Document Proof</span>
                  </button>

                  <a
                    href={`/api/public/documents/${job.document_id}/download?token=${encodeURIComponent(token)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download Original File</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Online Payment CTA if pending */}
        {job.payment_status !== 'paid' && (
          <div className="p-6 bg-blue-50/50 border-t border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-900">Payment Status: {job.payment_status.replace('_', ' ')}</p>
              <p className="text-xs text-slate-600">
                You can pay at the counter upon pickup or settle online right now via Paystack Ghana.
              </p>
            </div>
            <button
              onClick={handleSimulatePayment}
              disabled={isPaying}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shrink-0 shadow-xs"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isPaying ? 'Verifying...' : `Pay Online (GH₵ ${job.estimated_total.toFixed(2)})`}</span>
            </button>
          </div>
        )}

        {paySuccess && (
          <div className="p-4 bg-emerald-50 border-t border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{paySuccess}</span>
          </div>
        )}
      </div>

      {/* Press Location & Pickup Directions */}
      {press && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Pickup Location
            </span>
            <p className="text-sm font-bold text-slate-900">{press.name}</p>
            <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{press.location} — {press.address}</span>
            </p>
          </div>
          {press.phone && (
            <a
              href={`tel:${press.phone.replace(/[^0-9+]/g, '')}`}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Shop</span>
            </a>
          )}
        </div>
      )}

      {/* Document Preview Modal for Users & Staff */}
      {isPreviewModalOpen && job && (
        <JobTrackingPreviewModal
          job={job}
          token={token}
          onClose={() => setIsPreviewModalOpen(false)}
          onJobUpdated={(updatedJob) => {
            setJob(updatedJob);
            fetchJobStatus();
          }}
        />
      )}
    </div>
  );
};
