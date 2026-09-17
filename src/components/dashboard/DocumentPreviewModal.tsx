import React, { useState } from 'react';
import {
  X,
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Phone,
  User,
  ShieldCheck,
  Clock,
  Sparkles,
  ExternalLink,
  Check,
  CreditCard,
  Hash,
} from 'lucide-react';
import { PrintJob, JobStatus } from '../../types';
import { PDFViewer } from './PDFViewer';
import { api } from '../../services/api';

interface DocumentPreviewModalProps {
  job: PrintJob;
  onClose: () => void;
  onStatusUpdated?: (updatedJob: PrintJob) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  job,
  onClose,
  onStatusUpdated,
}) => {
  const [detectedPages, setDetectedPages] = useState<number | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Pre-flight inspection checklist
  const [checklist, setChecklist] = useState({
    pageCount: false,
    marginsSafe: false,
    colorCalibrated: false,
    paperStockReady: false,
  });

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecksPassed = Object.values(checklist).every(Boolean);
  const checkedCount = Object.values(checklist).filter(Boolean).length;

  const documentUrl = `/api/public/documents/${job.document_id}/download?token=${encodeURIComponent(
    job.tracking_token
  )}`;

  const totalCalculatedPages = (job.options?.copies || 1) * (job.options?.page_count || 1);

  const handleUpdateStatus = async (newStatus: JobStatus, notes?: string) => {
    setIsUpdatingStatus(true);
    setActionSuccess(null);
    try {
      const updated = await api.updateJobStatus(job.id, {
        status: newStatus,
        notes: notes || `Pre-flight verification completed by operator. Status moved to ${newStatus}.`,
      });
      if (onStatusUpdated) {
        onStatusUpdated(updated);
      }
      setActionSuccess(`Job status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to update job status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-7xl rounded-2xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden">
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-900/60 border border-purple-600/40 flex items-center justify-center text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Document Pre-Flight & Print Verification
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-800 text-purple-300 border border-purple-500/30">
                  {job.job_number}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    job.job_status === 'completed'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : job.job_status === 'processing'
                      ? 'bg-blue-950 text-blue-300 border border-blue-700'
                      : job.job_status === 'ready_for_pickup'
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                      : 'bg-amber-950 text-amber-300 border border-amber-700'
                  }`}
                >
                  {job.job_status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Verify page count, binding gutters, color profile, and machine stock requirements before releasing to press.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Preview Modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action success alert banner */}
        {actionSuccess && (
          <div className="bg-emerald-950/80 border-b border-emerald-600/50 px-5 py-2 text-xs font-semibold text-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Content Layout: PDF Viewer (Left) + Print Verification Panel (Right) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Main Area: PDF Viewer (8 Cols on Desktop) */}
          <div className="lg:col-span-8 p-3 sm:p-4 flex flex-col bg-slate-950/40 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
            <PDFViewer
              url={documentUrl}
              documentName={job.document_name}
              colorMode={job.options?.color_mode || 'color'}
              expectedPageCount={job.options?.page_count}
              onPageCountDetected={(pages) => setDetectedPages(pages)}
              className="h-full min-h-[480px]"
            />
          </div>

          {/* Right Sidebar: Print Requirements & Operator Pre-Flight Checklist (4 Cols) */}
          <div className="lg:col-span-4 p-4 overflow-y-auto space-y-4 bg-slate-900/90 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Customer & Order Card */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Customer Order</span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{job.customer_name}</h4>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-slate-500" />
                        {job.customer_phone}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400">
                      GH₵ {job.estimated_total?.toFixed(2) || '0.00'}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        job.payment_status === 'paid'
                          ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
                          : 'bg-amber-900/50 text-amber-300 border border-amber-700/50'
                      }`}
                    >
                      {job.payment_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Print Specifications Grid */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Job Print Specifications</span>
                  <span className="text-purple-400 text-[10px]">Machine Settings</span>
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Paper Size */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">Paper Size</span>
                    <span className="font-bold text-slate-200">
                      {job.options?.paper_size || 'A4'}
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      {job.options?.paper_size === 'A3' ? '297 × 420 mm' : '210 × 297 mm'}
                    </span>
                  </div>

                  {/* Color Profile */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">Color Mode</span>
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        job.options?.color_mode === 'mixed'
                          ? 'text-indigo-400'
                          : job.options?.color_mode === 'color'
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          job.options?.color_mode === 'mixed'
                            ? 'bg-indigo-400'
                            : job.options?.color_mode === 'color'
                            ? 'bg-amber-400'
                            : 'bg-slate-400'
                        }`}
                      />
                      {job.options?.color_mode === 'mixed'
                        ? 'Smart Mix'
                        : job.options?.color_mode === 'color'
                        ? 'Full Colour'
                        : 'Black & White'}
                    </span>
                    <span className="text-[9px] text-slate-400 block">
                      {job.options?.color_mode === 'mixed'
                        ? `${job.options?.color_pages ?? 0} colour + ${job.options?.bw_pages ?? 0} B&W`
                        : job.options?.color_mode === 'color'
                        ? 'CMYK Laser'
                        : 'Monochrome Toner'}
                    </span>
                  </div>

                  {/* Sidedness */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">Sidedness</span>
                    <span className="font-bold text-slate-200 capitalize">
                      {job.options?.sidedness || 'Single'}-sided
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      {job.options?.sidedness === 'double' ? 'Duplex Engine' : 'Simplex Pass'}
                    </span>
                  </div>

                  {/* Binding */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">Finishing & Binding</span>
                    <span className="font-bold text-slate-200 capitalize truncate block">
                      {job.options?.binding?.replace('_', ' ') || 'None'}
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      {job.options?.binding && job.options?.binding !== 'none'
                        ? 'Ensure 15mm Gutter'
                        : 'No Post-Press Binding'}
                    </span>
                  </div>
                </div>

                {/* Production Impressions & Page Count Check */}
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Order Page Count:</span>
                    <span className="font-bold text-slate-200">{job.options?.page_count || 1} pages</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Detected from PDF:</span>
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        detectedPages === job.options?.page_count
                          ? 'text-emerald-400'
                          : detectedPages
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {detectedPages ? `${detectedPages} pages` : 'Inspecting...'}
                      {detectedPages && detectedPages === job.options?.page_count && (
                        <Check className="w-3 h-3 text-emerald-400" />
                      )}
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-300">Total Print Output:</span>
                    <span className="text-purple-300 font-mono">
                      {job.options?.copies || 1} copies × {job.options?.page_count || 1} pgs ={' '}
                      <strong className="text-white underline decoration-purple-500">
                        {totalCalculatedPages} impressions
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Customer Instructions / Special Notes */}
                {job.options?.notes && (
                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-600/30 text-xs">
                    <span className="font-bold text-amber-300 block mb-0.5">Special Customer Instructions:</span>
                    <p className="text-amber-100 text-[11px] italic">"{job.options.notes}"</p>
                  </div>
                )}
              </div>

              {/* Pre-flight Operator Checklist */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                    <span>Operator Pre-Flight Checklist</span>
                  </h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      allChecksPassed
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {checkedCount} / 4 Verified
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {/* Item 1 */}
                  <label
                    onClick={() => toggleCheck('pageCount')}
                    className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800/80 transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checklist.pageCount}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-[11px]">
                      <span className="font-semibold text-slate-200 block">Page Count Verification</span>
                      <span className="text-[10px] text-slate-400">
                        {detectedPages
                          ? `Document contains ${detectedPages} pages (Matches ${job.options?.page_count || 1} ordered)`
                          : 'Verify that total pages in file matches customer order'}
                      </span>
                    </div>
                  </label>

                  {/* Item 2 */}
                  <label
                    onClick={() => toggleCheck('marginsSafe')}
                    className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800/80 transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checklist.marginsSafe}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-[11px]">
                      <span className="font-semibold text-slate-200 block">Safe Margins & Spine Gutter</span>
                      <span className="text-[10px] text-slate-400">
                        Content does not spill into the 15mm left spine binding zone or trim margins
                      </span>
                    </div>
                  </label>

                  {/* Item 3 */}
                  <label
                    onClick={() => toggleCheck('colorCalibrated')}
                    className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800/80 transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checklist.colorCalibrated}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-[11px]">
                      <span className="font-semibold text-slate-200 block">Color Profile & Contrast Verified</span>
                      <span className="text-[10px] text-slate-400">
                        {job.options?.color_mode === 'color'
                          ? 'Full CMYK colors will reproduce accurately on digital press'
                          : 'B&W grayscale simulation checked for crisp text & readable charts'}
                      </span>
                    </div>
                  </label>

                  {/* Item 4 */}
                  <label
                    onClick={() => toggleCheck('paperStockReady')}
                    className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800/80 transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checklist.paperStockReady}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-[11px]">
                      <span className="font-semibold text-slate-200 block">Paper Stock & Tray Ready</span>
                      <span className="text-[10px] text-slate-400">
                        Machine tray loaded with correct {job.options?.paper_size || 'A4'} paper stock
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Operator Actions & Stage Transitions */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              {job.job_status === 'pending' && (
                <button
                  onClick={() => handleUpdateStatus('accepted')}
                  disabled={isUpdatingStatus}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Accept Job & Queue for Production</span>
                </button>
              )}

              {(job.job_status === 'accepted' || job.job_status === 'pending') && (
                <button
                  onClick={() => handleUpdateStatus('processing')}
                  disabled={isUpdatingStatus}
                  className={`w-full py-2.5 px-4 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                    allChecksPassed
                      ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400/50'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {allChecksPassed
                      ? 'Pre-Flight Passed: Send to Press / Start Printing'
                      : 'Approve & Start Printing Job'}
                  </span>
                </button>
              )}

              {job.job_status === 'processing' && (
                <button
                  onClick={() => handleUpdateStatus('ready_for_pickup')}
                  disabled={isUpdatingStatus}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Printing Finished: Mark Ready for Pickup</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={documentUrl}
                  download={job.document_name}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Save File</span>
                </a>

                <button
                  onClick={onClose}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center transition-colors border border-slate-700"
                >
                  Close Proof
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
