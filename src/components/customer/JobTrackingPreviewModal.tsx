import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  Eye,
  Maximize2,
  Minimize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Sliders,
  Check,
  AlertTriangle,
  Phone,
  MessageSquare,
  Sparkles,
  Layers,
  FileCheck,
} from 'lucide-react';
import { PrintJob, JobStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PDFViewer } from '../dashboard/PDFViewer';

interface JobTrackingPreviewModalProps {
  job: PrintJob;
  token: string;
  onClose: () => void;
  onJobUpdated?: (updatedJob: PrintJob) => void;
}

export const JobTrackingPreviewModal: React.FC<JobTrackingPreviewModalProps> = ({
  job,
  token,
  onClose,
  onJobUpdated,
}) => {
  const { user, role } = useAuth();
  const isStaffOrOwner = role === 'staff' || role === 'owner' || role === 'super_admin';

  const [detectedPages, setDetectedPages] = useState<number | null>(
    job.options?.detected_pages || job.options?.page_count || null
  );
  const [colorSimulationMode, setColorSimulationMode] = useState<'color' | 'bw'>(
    job.options?.color_mode || 'color'
  );
  const [showSpineGutter, setShowSpineGutter] = useState<boolean>(
    Boolean(job.options?.binding && job.options?.binding !== 'none')
  );
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Staff checklist state
  const [checklist, setChecklist] = useState({
    pageCount: false,
    marginsSafe: false,
    colorCalibrated: false,
    paperStockReady: false,
  });

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const documentUrl = `/api/public/documents/${job.document_id}/download?token=${encodeURIComponent(
    token || job.tracking_token
  )}`;

  const isPdf =
    job.document_mime === 'application/pdf' ||
    job.document_name.toLowerCase().endsWith('.pdf');

  const isImage =
    job.document_mime?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(job.document_name);

  const fileExt = job.document_name.split('.').pop()?.toUpperCase() || (isPdf ? 'PDF' : 'DOC');

  const totalCalculatedImpressions =
    (job.options?.copies || 1) * (detectedPages || job.options?.page_count || 1);

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecksPassed = Object.values(checklist).every(Boolean);
  const checkedCount = Object.values(checklist).filter(Boolean).length;

  const handleUpdateStatus = async (nextStatus: JobStatus) => {
    if (!isStaffOrOwner) return;
    setIsUpdatingStatus(true);
    setActionSuccess(null);
    try {
      const updated = await api.updateJobStatus(job.id, {
        status: nextStatus,
        notes: `Status advanced to ${nextStatus.replace('_', ' ')} during pre-flight inspection.`,
      });
      if (onJobUpdated) onJobUpdated(updated);
      setActionSuccess(`Job status successfully advanced to ${nextStatus.replace('_', ' ')}!`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update job status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-slate-900 text-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-950 px-4 sm:px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 text-purple-400 border border-purple-500/40 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate max-w-xs sm:max-w-md">
                  {job.document_name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-700">
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
                {isStaffOrOwner && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-900/60 text-blue-200 border border-blue-700/60 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-blue-300" />
                    Operator Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                <span>Pre-Press Proofing Mode: Inspect low-resolution proof before downloading master files</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={documentUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>Download Original</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action success alert banner */}
        {actionSuccess && (
          <div className="bg-emerald-950/80 border-b border-emerald-600/50 px-5 py-2 text-xs font-semibold text-emerald-200 flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Content Layout: Viewer (Left) + Specifications & Pre-Flight Panel (Right) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          {/* Main Stage Area: Document Proof Viewer (8 Cols on Desktop) */}
          <div className="lg:col-span-8 p-3 sm:p-4 flex flex-col bg-slate-950/50 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
            {isPdf ? (
              /* PDF Viewer with low-res proofing */
              <div className="h-full flex flex-col relative overflow-hidden">
                {/* Low-Res Proof Watermark Banner */}
                <div className="bg-purple-950/60 border border-purple-800/60 rounded-lg px-3 py-1.5 mb-2 text-xs flex items-center justify-between gap-2 text-purple-200 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                    <span className="font-semibold text-[11px]">Low-Resolution Proof Active</span>
                    <span className="text-[10px] text-purple-300/80 hidden sm:inline">
                      • Simulated ink & paper rasterization
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">Simulation:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setColorSimulationMode((prev) => (prev === 'color' ? 'bw' : 'color'))
                      }
                      className="px-2 py-0.5 rounded bg-purple-900/80 hover:bg-purple-800 border border-purple-600 text-purple-100 font-bold transition-colors"
                    >
                      {colorSimulationMode === 'color' ? 'Full CMYK Colour' : 'B&W Monochrome'}
                    </button>
                  </div>
                </div>

                <PDFViewer
                  url={documentUrl}
                  documentName={job.document_name}
                  colorMode={colorSimulationMode}
                  expectedPageCount={job.options?.page_count}
                  onPageCountDetected={(pages) => setDetectedPages(pages)}
                  className="flex-1 min-h-[460px]"
                />
              </div>
            ) : isImage ? (
              /* High-Fidelity Image Proof Viewer */
              <div className="h-full flex flex-col bg-slate-900 rounded-xl border border-slate-750 overflow-hidden min-h-[460px]">
                {/* Image Toolbar */}
                <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Graphic Artwork Proof
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px]">
                      {fileExt} Image
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Zoom In / Out */}
                    <button
                      onClick={() => setImageZoom((prev) => Math.min(prev + 0.25, 3))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono px-1">
                      {Math.round(imageZoom * 100)}%
                    </span>
                    <button
                      onClick={() => setImageZoom((prev) => Math.max(prev - 0.25, 0.5))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setImageZoom(1);
                        setImageRotation(0);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                    >
                      Reset
                    </button>

                    {/* Rotate */}
                    <button
                      onClick={() => setImageRotation((prev) => (prev + 90) % 360)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                      title="Rotate 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    {/* Color simulation toggle */}
                    <button
                      onClick={() =>
                        setColorSimulationMode((prev) => (prev === 'color' ? 'bw' : 'color'))
                      }
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        colorSimulationMode === 'bw'
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                      title="Simulate Black & White laser print"
                    >
                      {colorSimulationMode === 'bw' ? 'B&W Simulation ON' : 'Simulate B&W'}
                    </button>

                    {/* Spine gutter toggle */}
                    <button
                      onClick={() => setShowSpineGutter((prev) => !prev)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        showSpineGutter
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                      title="Toggle 15mm binding safe spine margin"
                    >
                      Binding Gutter Guide
                    </button>
                  </div>
                </div>

                {/* Stage Body */}
                <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-slate-950/70">
                  <div
                    className="relative max-w-full max-h-full transition-transform duration-150"
                    style={{
                      transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                      filter: colorSimulationMode === 'bw' ? 'grayscale(100%)' : 'none',
                    }}
                  >
                    <img
                      src={documentUrl}
                      alt={job.document_name}
                      referrerPolicy="no-referrer"
                      className="max-h-[500px] max-w-full rounded shadow-xl object-contain border border-slate-700 bg-white"
                    />

                    {/* Safe spine gutter overlay guide */}
                    {showSpineGutter && (
                      <div className="absolute top-0 bottom-0 left-0 w-8 bg-indigo-500/25 border-r-2 border-dashed border-indigo-400 flex items-center justify-center pointer-events-none">
                        <span className="text-[9px] font-bold text-indigo-200 tracking-wider rotate-90 whitespace-nowrap select-none drop-shadow-sm">
                          Safe Binding Gutter (15mm)
                        </span>
                      </div>
                    )}

                    {/* Diagonal Watermark */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-30 select-none">
                      <span className="text-xl sm:text-2xl font-black tracking-widest text-slate-900 uppercase rotate-[-30deg] border-2 border-slate-900/40 px-6 py-2 rounded-xl bg-white/20 backdrop-blur-xs">
                        PRINTFLOW LOW-RES PROOF
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Office Document / Fallback Proof View */
              <div className="h-full flex flex-col items-center justify-center bg-slate-900 rounded-xl border border-slate-750 p-8 text-center min-h-[460px] space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-lg">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{job.document_name}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Format: {fileExt} • Size:{' '}
                    {(job.document_size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                <div className="max-w-md p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-left space-y-2 text-slate-300">
                  <span className="font-bold text-slate-200 block">Pre-Print Production Verification</span>
                  <p>
                    This file is ready for transmission to the digital laser press. To review full layout vectors and styling in high resolution, you can download the master file directly.
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-purple-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>File integrity verified & scanned for production release</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <a
                    href={documentUrl}
                    download={job.document_name}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors shadow-md flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Master Document ({fileExt})</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Specifications & Pre-Flight Checklist (4 Cols) */}
          <div className="lg:col-span-4 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-900/95 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Order & Customer Summary Card */}
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Print Job Order</span>
                  <span className="font-mono text-[11px] text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{job.customer_name}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {job.job_number}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400">
                      GH₵ {job.estimated_total?.toFixed(2) || '0.00'}
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        job.payment_status === 'paid'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {job.payment_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Print Specifications Grid */}
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Print Specifications</span>
                  <span className="text-purple-400 text-[10px]">Proof Config</span>
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Paper Size */}
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Paper Size</span>
                    <strong className="font-bold text-slate-200">
                      {job.options?.paper_size || 'A4'}
                    </strong>
                    <span className="text-[9px] text-slate-500 block">
                      {job.options?.paper_size === 'A3' ? '297 × 420 mm' : '210 × 297 mm'}
                    </span>
                  </div>

                  {/* Color Mode */}
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Color Profile</span>
                    <strong
                      className={`font-bold flex items-center gap-1 ${
                        job.options?.color_mode === 'color' ? 'text-amber-400' : 'text-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          job.options?.color_mode === 'color' ? 'bg-amber-400' : 'bg-slate-400'
                        }`}
                      />
                      {job.options?.color_mode === 'color' ? 'Full Colour' : 'Black & White'}
                    </strong>
                    <span className="text-[9px] text-slate-500 block">
                      {job.options?.color_mode === 'color' ? 'CMYK Laser' : 'Monochrome Toner'}
                    </span>
                  </div>

                  {/* Sidedness */}
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Sidedness</span>
                    <strong className="font-bold text-slate-200 capitalize">
                      {job.options?.sidedness || 'single'}-sided
                    </strong>
                    <span className="text-[9px] text-slate-500 block">
                      {job.options?.sidedness === 'double' ? 'Duplex Engine' : 'Simplex Pass'}
                    </span>
                  </div>

                  {/* Finishing / Binding */}
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Finishing & Binding</span>
                    <strong className="font-bold text-slate-200 capitalize truncate block">
                      {job.options?.binding && job.options?.binding !== 'none'
                        ? job.options.binding
                        : 'None'}
                    </strong>
                    <span className="text-[9px] text-slate-500 block">
                      {job.options?.binding && job.options?.binding !== 'none'
                        ? 'Ensure 15mm Gutter'
                        : 'No Post-Press'}
                    </span>
                  </div>
                </div>

                {/* Production Impressions & Page Count Check */}
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Order Page Count:</span>
                    <span className="font-bold text-slate-200">{job.options?.page_count || 1} pages</span>
                  </div>

                  {detectedPages && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Detected in Proof:</span>
                      <span
                        className={`font-bold flex items-center gap-1 ${
                          detectedPages === job.options?.page_count
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {detectedPages} pages
                        {detectedPages === job.options?.page_count && (
                          <Check className="w-3 h-3 text-emerald-400" />
                        )}
                      </span>
                    </div>
                  )}

                  <div className="pt-1 border-t border-slate-800 flex items-center justify-between font-semibold">
                    <span className="text-slate-300">Total Output:</span>
                    <span className="text-purple-300 font-mono">
                      {job.options?.copies || 1} copies × {detectedPages || job.options?.page_count || 1} pgs ={' '}
                      <strong className="text-white">
                        {totalCalculatedImpressions} impressions
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Additional Customer Instructions */}
                {job.options?.additional_instructions && (
                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-600/30 text-xs">
                    <span className="font-bold text-amber-300 block mb-0.5">Special Instructions:</span>
                    <p className="text-amber-100 text-[11px] italic">
                      "{job.options.additional_instructions}"
                    </p>
                  </div>
                )}
              </div>

              {/* Conditional Panel: Staff Operator Checklist VS Customer Proof Guidance */}
              {isStaffOrOwner ? (
                /* Operator Pre-Flight Checklist for Staff */
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
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
                    <label
                      onClick={() => toggleCheck('pageCount')}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800 transition-colors select-none"
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
                            ? `File has ${detectedPages} pages (Matches ${job.options?.page_count || 1} ordered)`
                            : 'Verify total pages match order count'}
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => toggleCheck('marginsSafe')}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800 transition-colors select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checklist.marginsSafe}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="text-[11px]">
                        <span className="font-semibold text-slate-200 block">Safe Spine & Binding Gutter</span>
                        <span className="text-[10px] text-slate-400">
                          Artwork does not bleed into the 15mm left spine binding clearance
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => toggleCheck('colorCalibrated')}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800 transition-colors select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checklist.colorCalibrated}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="text-[11px]">
                        <span className="font-semibold text-slate-200 block">Color Mode & Contrast</span>
                        <span className="text-[10px] text-slate-400">
                          {job.options?.color_mode === 'color'
                            ? 'Full CMYK colors will reproduce accurately on digital press'
                            : 'B&W grayscale simulation checked for crisp text & readable graphics'}
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => toggleCheck('paperStockReady')}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800 transition-colors select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checklist.paperStockReady}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="text-[11px]">
                        <span className="font-semibold text-slate-200 block">Paper Stock Loaded</span>
                        <span className="text-[10px] text-slate-400">
                          Laser machine loaded with correct {job.options?.paper_size || 'A4'} stock
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                /* Customer Proofing Instructions */
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Customer Proof Verification</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    This thumbnail proof allows you to inspect page order, typography, and paper layout. Your print shop will use this verified file to produce your finished order.
                  </p>
                  <div className="pt-1 text-[11px] text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Single or duplex orientation verified</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Ready for counter pickup or courier dispatch</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Operator Actions (Staff) or Customer Actions */}
            <div className="pt-3 border-t border-slate-800 space-y-2 shrink-0">
              {isStaffOrOwner && (
                <>
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

                  {job.job_status === 'ready_for_pickup' && (
                    <button
                      onClick={() => handleUpdateStatus('completed')}
                      disabled={isUpdatingStatus}
                      className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Handed Over: Mark Completed</span>
                    </button>
                  )}
                </>
              )}

              {/* Direct Download & Close Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={documentUrl}
                  download={job.document_name}
                  className="py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Master</span>
                </a>

                <button
                  onClick={onClose}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-colors border border-slate-700"
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
