import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Check,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Shield,
  Layers,
  FileCheck,
  Sparkles,
  Calculator,
  Store,
  Package,
  Calendar,
  Info,
  CheckCircle2,
  Palette,
} from 'lucide-react';
import { api } from '../../services/api';
import { Tenant, Service, PrintJobOption } from '../../types';
import { calculateDocumentPages, calculatePrintablePages } from '../../utils/documentPageCalculator';

interface CustomerUploadWizardProps {
  slug: string;
  onSuccess: (job: any) => void;
  onCancel: () => void;
}

export const CustomerUploadWizard: React.FC<CustomerUploadWizardProps> = ({
  slug,
  onSuccess,
  onCancel,
}) => {
  const [press, setPress] = useState<(Tenant & { services: Service[] }) | null>(null);
  const [isLoadingPress, setIsLoadingPress] = useState<boolean>(true);

  // Form State
  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Page Detection State
  const [isCalculatingPages, setIsCalculatingPages] = useState<boolean>(false);
  const [detectedPageCount, setDetectedPageCount] = useState<number | null>(null);
  const [detectedDocType, setDetectedDocType] = useState<string>('');

  // Colour and B&W detection
  const [detectedColorPages, setDetectedColorPages] = useState<number>(0);
  const [detectedBwPages, setDetectedBwPages] = useState<number>(1);
  const [customColorPages, setCustomColorPages] = useState<number>(0);
  const [customBwPages, setCustomBwPages] = useState<number>(1);

  // Options
  const [copies, setCopies] = useState<number>(1);
  const [paperSize, setPaperSize] = useState<'A4' | 'A3' | 'A5' | 'Letter'>('A4');
  const [colorMode, setColorMode] = useState<'bw' | 'color' | 'mixed'>('bw');
  const [sidedness, setSidedness] = useState<'single' | 'double'>('single');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pageCount, setPageCount] = useState<number>(1);
  const [pageRange, setPageRange] = useState<string>('All');
  const [binding, setBinding] = useState<'none' | 'spiral' | 'hardcover' | 'staple'>('none');
  const [lamination, setLamination] = useState<'none' | 'glossy' | 'matte'>('none');
  const [selectedFinishing, setSelectedFinishing] = useState<string[]>([]);
  const [instructions, setInstructions] = useState<string>('');

  // Fulfillment & Pickup State (Optional Pickup)
  const [fulfillmentType, setFulfillmentType] = useState<'instant_counter' | 'pickup'>('instant_counter');
  const [pickupTimeOption, setPickupTimeOption] = useState<string>('asap');
  const [customPickupNote, setCustomPickupNote] = useState<string>('');

  // Customer Contact (All Optional)
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'shop' | 'online'>('shop');

  // Pricing State
  const [priceEstimate, setPriceEstimate] = useState<{ total: number; breakdown: Array<{ item: string; amount: number }> }>({
    total: 0.5,
    breakdown: [],
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load press details
  useEffect(() => {
    setIsLoadingPress(true);
    api
      .getPublicPress(slug)
      .then((data) => setPress(data))
      .catch((err) => setSubmitError(err.message))
      .finally(() => setIsLoadingPress(false));
  }, [slug]);

  // Calculate effective printable pages based on page range
  const effectivePrintPages = calculatePrintablePages(pageCount, pageRange);

  // Recalculate price whenever options change
  useEffect(() => {
    if (!press) return;

    let computedColor = 0;
    let computedBw = effectivePrintPages;

    if (colorMode === 'color') {
      computedColor = effectivePrintPages;
      computedBw = 0;
    } else if (colorMode === 'bw') {
      computedColor = 0;
      computedBw = effectivePrintPages;
    } else {
      // Mixed mode
      computedColor = customColorPages;
      computedBw = customBwPages;
    }

    const optionsPayload = {
      copies,
      paper_size: paperSize,
      color_mode: colorMode,
      sidedness,
      orientation,
      page_count: effectivePrintPages,
      color_pages: computedColor,
      bw_pages: computedBw,
      binding,
      lamination,
      finishing_services: selectedFinishing,
    };

    api
      .calculatePriceEstimate(slug, optionsPayload)
      .then((res) => setPriceEstimate(res))
      .catch(console.error);
  }, [
    slug,
    press,
    copies,
    paperSize,
    colorMode,
    sidedness,
    orientation,
    effectivePrintPages,
    customColorPages,
    customBwPages,
    binding,
    lamination,
    selectedFinishing,
  ]);

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = async (uploadedFile: File) => {
    setFileError(null);
    const maxMb = press?.settings?.max_file_size_mb || 25;
    const maxBytes = maxMb * 1024 * 1024;

    if (uploadedFile.size > maxBytes) {
      setFileError(`File size (${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB) exceeds the maximum limit of ${maxMb} MB.`);
      return;
    }

    const validExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'];
    const ext = '.' + uploadedFile.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      setFileError(`File type "${ext}" is not supported. Please upload a PDF, Word, PowerPoint, or image file.`);
      return;
    }

    setFile(uploadedFile);
    setIsCalculatingPages(true);

    try {
      const calcResult = await calculateDocumentPages(uploadedFile);
      setPageCount(calcResult.pageCount);
      setDetectedPageCount(calcResult.pageCount);
      setDetectedDocType(calcResult.detectedType);
      setDetectedColorPages(calcResult.colorPages);
      setDetectedBwPages(calcResult.bwPages);
      setCustomColorPages(calcResult.colorPages);
      setCustomBwPages(calcResult.bwPages);

      // Auto set recommended color mode
      if (calcResult.colorPages > 0 && calcResult.bwPages > 0) {
        setColorMode('mixed');
      } else if (calcResult.colorPages > 0) {
        setColorMode('color');
      } else {
        setColorMode('bw');
      }
    } catch (calcErr) {
      console.warn('Page calculation error:', calcErr);
      setPageCount(1);
      setDetectedPageCount(1);
      setDetectedDocType('Document');
      setDetectedColorPages(0);
      setDetectedBwPages(1);
      setCustomColorPages(0);
      setCustomBwPages(1);
    } finally {
      setIsCalculatingPages(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  // Re-run page calculation on demand
  const handleRecalculatePages = async () => {
    if (!file) return;
    setIsCalculatingPages(true);
    try {
      const calcResult = await calculateDocumentPages(file);
      setPageCount(calcResult.pageCount);
      setDetectedPageCount(calcResult.pageCount);
      setDetectedDocType(calcResult.detectedType);
      setDetectedColorPages(calcResult.colorPages);
      setDetectedBwPages(calcResult.bwPages);
      setCustomColorPages(calcResult.colorPages);
      setCustomBwPages(calcResult.bwPages);

      if (calcResult.colorPages > 0 && calcResult.bwPages > 0) {
        setColorMode('mixed');
      } else if (calcResult.colorPages > 0) {
        setColorMode('color');
      } else {
        setColorMode('bw');
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setIsCalculatingPages(false);
    }
  };

  // Helper for pickup time label
  const getPickupTimeLabel = () => {
    if (fulfillmentType === 'instant_counter') return 'Instant Counter Print (Walk-in)';
    switch (pickupTimeOption) {
      case 'asap':
        return 'Ready as soon as possible (15-30 mins)';
      case '1hour':
        return 'In 1-2 hours';
      case 'today_later':
        return 'Later today (Afternoon/Evening)';
      case 'tomorrow':
        return 'Tomorrow morning';
      case 'custom':
        return customPickupNote.trim() || 'Custom pickup schedule';
      default:
        return 'Optional in-shop pickup';
    }
  };

  // Submission handler (Pickup and contact info are completely optional!)
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setSubmitError('Please upload a document to proceed.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const isPickup = fulfillmentType === 'pickup';
      const pickupTimeLabel = getPickupTimeLabel();
      const finalCustomerName = customerName.trim() || 'Walk-in Customer';

      const formData = new FormData();
      formData.append('document', file);
      formData.append('customer_name', finalCustomerName);
      if (customerPhone.trim()) {
        formData.append('customer_phone', customerPhone.trim());
      }
      if (customerEmail.trim()) {
        formData.append('customer_email', customerEmail.trim());
      }
      formData.append('fulfillment_type', fulfillmentType);
      formData.append('is_pickup', String(isPickup));
      if (isPickup) {
        formData.append('pickup_time', pickupTimeLabel);
      }
      formData.append('copies', String(copies));
      formData.append('paper_size', paperSize);
      formData.append('color_mode', colorMode);

      const computedColor = colorMode === 'mixed' ? customColorPages : (colorMode === 'color' ? effectivePrintPages : 0);
      const computedBw = colorMode === 'mixed' ? customBwPages : (colorMode === 'bw' ? effectivePrintPages : 0);
      formData.append('color_pages', String(computedColor));
      formData.append('bw_pages', String(computedBw));

      formData.append('sidedness', sidedness);
      formData.append('orientation', orientation);
      formData.append('page_count', String(effectivePrintPages));
      formData.append('page_range', pageRange);
      formData.append('binding', binding);
      formData.append('lamination', lamination);
      formData.append('finishing_services', JSON.stringify(selectedFinishing));
      formData.append('additional_instructions', instructions);
      formData.append('payment_method', paymentMethod);

      const res = await api.uploadPrintJob(slug, formData);
      onSuccess(res.job);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit print job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingPress) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const currencySymbol = press?.settings?.currency_symbol || 'GH₵';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      {/* Header with Press Name and Steps */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
            Printing At {press?.name}
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Document Print Order
          </h1>
        </div>
        <button
          onClick={onCancel}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-3 gap-2 mb-8">
        {[
          { num: 1, label: 'Upload File' },
          { num: 2, label: 'Print Options' },
          { num: 3, label: 'Review & Submit' },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-2.5 rounded-xl border text-center transition-all ${
              step === s.num
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-semibold'
                : step > s.num
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-400 border-slate-200'
            }`}
          >
            <div className="text-[11px] font-bold">STEP {s.num}</div>
            <div className="text-xs truncate">{s.label}</div>
          </div>
        ))}
      </div>

      {/* STEP 1: FILE UPLOAD */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Select or Drop Your Document</h2>
            <p className="text-xs text-slate-500 mb-5">
              Upload PDF, Word (DOC/DOCX), PowerPoint (PPT/PPTX), or high-res images.
            </p>

            {!file ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/60'
                }`}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                  onChange={handleFileInputChange}
                />
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  Click to browse or drag file here
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Max file size: {press?.settings?.max_file_size_mb || 25} MB
                </p>
                <span className="inline-block px-3 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-lg text-slate-600">
                  PDF, DOCX, PPTX, JPG, PNG
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || 'Document'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setDetectedPageCount(null);
                      setPageCount(1);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Page & Color Calculation Status Indicator */}
                {isCalculatingPages ? (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2.5 text-xs text-blue-800">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0"></div>
                    <span className="font-semibold">Analyzing document: counting total, coloured and monochrome pages...</span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2 text-xs text-emerald-900">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-bold">Document Analysis: </span>
                          <span className="font-extrabold text-emerald-800">
                            {pageCount} {pageCount === 1 ? 'page' : 'pages'} total
                          </span>
                          {detectedDocType && (
                            <span className="text-emerald-700 ml-1">({detectedDocType})</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRecalculatePages}
                        className="px-2.5 py-1 rounded-md bg-white border border-emerald-300 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100/50 shrink-0"
                      >
                        Re-scan
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200/60">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-[11px] font-bold text-slate-800 shadow-2xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-indigo-500 inline-block shrink-0"></span>
                        Coloured Pages: <span className="text-indigo-600 font-extrabold">{detectedColorPages}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-[11px] font-bold text-slate-800 shadow-2xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block shrink-0"></span>
                        Non-Coloured (B&W): <span className="text-slate-700 font-extrabold">{detectedBwPages}</span>
                      </span>
                      {detectedColorPages > 0 && detectedBwPages > 0 && (
                        <span className="text-[10px] font-semibold text-emerald-700">
                          ✨ Smart pricing available
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {fileError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
            >
              Back to Shop
            </button>
            <button
              onClick={() => {
                if (!file) {
                  setFileError('Please select a file to continue.');
                  return;
                }
                setStep(2);
              }}
              disabled={!file || isCalculatingPages}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span>Next: Print Options</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PRINT CONFIGURATION */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Configure Print Specifications
            </h2>

            {/* Copies & Pages Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Number of Copies
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    className="w-10 h-10 rounded-l-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center border border-slate-200"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-10 text-center font-bold text-slate-900 border-y border-slate-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCopies(copies + 1)}
                    className="w-10 h-10 rounded-r-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center border border-slate-200"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Total Pages in Document
                  </label>
                  {detectedPageCount !== null && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      <Calculator className="w-3 h-3" />
                      Calculated ({detectedPageCount} pgs)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={pageCount}
                    onChange={(e) => setPageCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. 15"
                  />
                  {file && (
                    <button
                      type="button"
                      onClick={handleRecalculatePages}
                      title="Recalculate pages from file"
                      className="px-2.5 h-10 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 shrink-0 flex items-center gap-1"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Re-check</span>
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Accurately calculated from your uploaded document. You can adjust if needed.
                </span>
              </div>
            </div>

            {/* Page Range Selection */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Pages to Print
                </label>
                <span className="text-[11px] font-semibold text-blue-700">
                  Effective to print: {effectivePrintPages} {effectivePrintPages === 1 ? 'page' : 'pages'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPageRange('All')}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold text-center transition-all ${
                    pageRange === 'All'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All Pages (1 - {pageCount})
                </button>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={pageRange === 'All' ? '' : pageRange}
                    onChange={(e) => setPageRange(e.target.value.trim() ? e.target.value : 'All')}
                    placeholder="Custom range (e.g. 1-5, 8, 11-14)"
                    className="w-full h-8.5 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                Specify specific pages or leave on "All Pages". Price automatically calculates for selected pages.
              </p>
            </div>

            {/* Colour vs B&W vs Mixed (Smart Detection) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Colour & Pricing Mode
                </label>
                {detectedColorPages > 0 && detectedBwPages > 0 && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    Auto-Identified: {detectedColorPages} Colour, {detectedBwPages} B&W
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Smart Mixed Mode */}
                <button
                  type="button"
                  onClick={() => {
                    setColorMode('mixed');
                    setCustomColorPages(detectedColorPages);
                    setCustomBwPages(detectedBwPages);
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    colorMode === 'mixed'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 font-semibold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-indigo-500 inline-block"></span>
                      Smart Mix
                    </span>
                    {colorMode === 'mixed' && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Pay colour rate for colour pages and B&W rate for monochrome pages.
                  </p>
                  <div className="mt-2 text-[11px] font-bold text-indigo-700 bg-white border border-indigo-100 px-2 py-0.5 rounded-md inline-block">
                    {customColorPages} Colour + {customBwPages} B&W
                  </div>
                </button>

                {/* 2. All B&W */}
                <button
                  type="button"
                  onClick={() => setColorMode('bw')}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    colorMode === 'bw'
                      ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 font-semibold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block"></span>
                      All Black & White
                    </span>
                    {colorMode === 'bw' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Standard monochrome print for all pages.</p>
                  <div className="mt-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md inline-block">
                    Most Economical
                  </div>
                </button>

                {/* 3. All Full Colour */}
                <button
                  type="button"
                  onClick={() => setColorMode('color')}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    colorMode === 'color'
                      ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 font-semibold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-rose-500" />
                      All Full Colour
                    </span>
                    {colorMode === 'color' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Vibrant colour laser across all pages.</p>
                  <div className="mt-2 text-[11px] font-bold text-blue-600 bg-white border border-blue-100 px-2 py-0.5 rounded-md inline-block">
                    Full Color
                  </div>
                </button>
              </div>

              {/* Mixed Mode Page Split Details */}
              {colorMode === 'mixed' && (
                <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                      Identified Page Breakdown (Adjustable)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomColorPages(detectedColorPages);
                        setCustomBwPages(detectedBwPages);
                      }}
                      className="text-[10px] font-bold text-indigo-700 hover:underline"
                    >
                      Reset to detected ({detectedColorPages} / {detectedBwPages})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        🎨 Coloured Pages
                      </label>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newColor = Math.max(0, customColorPages - 1);
                            setCustomColorPages(newColor);
                            setCustomBwPages(Math.max(0, effectivePrintPages - newColor));
                          }}
                          className="w-8 h-8 rounded-l-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center border border-slate-200"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={effectivePrintPages}
                          value={customColorPages}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setCustomColorPages(val);
                            setCustomBwPages(Math.max(0, effectivePrintPages - val));
                          }}
                          className="w-full h-8 text-center font-bold text-slate-900 border-y border-slate-200 text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newColor = Math.min(effectivePrintPages, customColorPages + 1);
                            setCustomColorPages(newColor);
                            setCustomBwPages(Math.max(0, effectivePrintPages - newColor));
                          }}
                          className="w-8 h-8 rounded-r-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center border border-slate-200"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        📄 Non-Coloured (B&W) Pages
                      </label>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newBw = Math.max(0, customBwPages - 1);
                            setCustomBwPages(newBw);
                            setCustomColorPages(Math.max(0, effectivePrintPages - newBw));
                          }}
                          className="w-8 h-8 rounded-l-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center border border-slate-200"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={effectivePrintPages}
                          value={customBwPages}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setCustomBwPages(val);
                            setCustomColorPages(Math.max(0, effectivePrintPages - val));
                          }}
                          className="w-full h-8 text-center font-bold text-slate-900 border-y border-slate-200 text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newBw = Math.min(effectivePrintPages, customBwPages + 1);
                            setCustomBwPages(newBw);
                            setCustomColorPages(Math.max(0, effectivePrintPages - newBw));
                          }}
                          className="w-8 h-8 rounded-r-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center border border-slate-200"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-indigo-700">
                    Calculated automatically from your document content. Total: {customColorPages + customBwPages} pages.
                  </p>
                </div>
              )}
            </div>

            {/* Paper Size & Sidedness */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Paper Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['A4', 'A3', 'A5'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPaperSize(size)}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold text-center transition-all ${
                        paperSize === size
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Print Sides
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSidedness('single')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold text-center transition-all ${
                      sidedness === 'single'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Single-sided
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidedness('double')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold text-center transition-all ${
                      sidedness === 'double'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Double-sided (Duplex)
                  </button>
                </div>
              </div>
            </div>

            {/* Binding Options */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Binding Service (Optional)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'none', label: 'No Binding' },
                  { id: 'spiral', label: 'Plastic Spiral' },
                  { id: 'hardcover', label: 'Hardcover Thesis' },
                  { id: 'staple', label: 'Corner Staple' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBinding(b.id as any)}
                    className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition-all ${
                      binding === b.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lamination Option */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Lamination (Optional)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'none', label: 'None' },
                  { id: 'glossy', label: 'Glossy Lamination' },
                  { id: 'matte', label: 'Matte Lamination' },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLamination(l.id as any)}
                    className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition-all ${
                      lamination === l.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Instructions */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Special Instructions for the Printer (Optional)
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Please print page 12-14 in high resolution, staple top-left corner..."
                rows={2}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Sticky Price Preview Banner */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-blue-700 font-semibold">Estimated Total</span>
              <div className="text-xl font-black text-blue-900">
                {currencySymbol} {priceEstimate.total.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <span>Review & Pay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW, CONTACT & PAYMENT */}
      {step === 3 && (
        <form onSubmit={handleSubmitOrder} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Order Summary & Collection Details
            </h2>

            {/* Itemized Price Summary */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700">Document</span>
                <span className="text-xs text-slate-600 font-medium truncate max-w-[200px]">
                  {file?.name}
                </span>
              </div>

              {/* Specs chips */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                  {copies} {copies === 1 ? 'Copy' : 'Copies'}
                </span>
                <span className="text-[11px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                  {paperSize} ({sidedness === 'double' ? '2-Sided' : '1-Sided'})
                </span>
                <span className="text-[11px] font-bold bg-white border border-indigo-200 px-2 py-0.5 rounded-md text-indigo-800 flex items-center gap-1">
                  <Palette className="w-3 h-3 text-indigo-500" />
                  {colorMode === 'mixed'
                    ? `Smart Mix: ${customColorPages} Colour + ${customBwPages} B&W`
                    : colorMode === 'color'
                    ? 'All Full Colour'
                    : 'All Black & White'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs pt-1 border-t border-slate-200/70">
                {priceEstimate.breakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-slate-600">
                    <span>{item.item}</span>
                    <span className="font-semibold text-slate-800">
                      {currencySymbol} {item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
                <span className="text-sm font-bold text-slate-900">Total Payable:</span>
                <span className="text-lg font-black text-blue-700">
                  {currencySymbol} {priceEstimate.total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Fulfillment / Collection Choice (Pickup is Optional) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Fulfillment & Collection
                </h3>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Pickup is Optional
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFulfillmentType('instant_counter')}
                  className={`p-4 rounded-xl border text-left transition-all relative ${
                    fulfillmentType === 'instant_counter'
                      ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 font-semibold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${fulfillmentType === 'instant_counter' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Store className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-900">Instant Counter Print</span>
                    </div>
                    {fulfillmentType === 'instant_counter' && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    I am in the shop now. Print immediately to the counter. No scheduled pickup or phone required.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFulfillmentType('pickup')}
                  className={`p-4 rounded-xl border text-left transition-all relative ${
                    fulfillmentType === 'pickup'
                      ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 font-semibold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${fulfillmentType === 'pickup' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Package className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-900">Schedule In-Shop Pickup</span>
                    </div>
                    {fulfillmentType === 'pickup' && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Optional: Collect your printout later today or tomorrow. Add an optional phone number for ready alerts.
                  </p>
                </button>
              </div>

              {/* Optional Pickup Time Schedule */}
              {fulfillmentType === 'pickup' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <label className="text-xs font-bold text-slate-800">
                      When would you like to collect? (Optional)
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'asap', label: '15-30 Mins' },
                      { id: '1hour', label: 'In 1-2 Hours' },
                      { id: 'today_later', label: 'Later Today' },
                      { id: 'tomorrow', label: 'Tomorrow' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPickupTimeOption(opt.id)}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-all ${
                          pickupTimeOption === opt.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={customPickupNote}
                    onChange={(e) => {
                      setCustomPickupNote(e.target.value);
                      if (pickupTimeOption !== 'custom') setPickupTimeOption('custom');
                    }}
                    placeholder="Or specific pickup note (e.g. Collecting around 4:30 PM after lectures)"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Customer Contact Inputs (All Optional) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Contact Information (Optional)
                </h3>
                <span className="text-[11px] text-slate-400">All fields optional</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  You can submit anonymously as a walk-in guest. Your private tracking token and Job Code will be generated instantly for counter collection.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Name <span className="text-slate-400 font-normal">(Optional - defaults to Walk-in Customer)</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Kwame Mensah (or leave blank for Walk-in)"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number <span className="text-slate-400 font-normal">(Optional - for ready notification)</span>
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 024 456 7890 (Optional)"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address <span className="text-slate-400 font-normal">(Optional receipt)</span>
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="e.g. kwame@example.com (Optional)"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Payment Option
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {press?.settings?.pay_at_shop_enabled !== false && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('shop')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      paymentMethod === 'shop'
                        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">Pay at Shop (Counter)</span>
                      {paymentMethod === 'shop' && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Pay cash or Momo when you pick up your printed document.
                    </p>
                  </button>
                )}

                {press?.settings?.online_payment_enabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      paymentMethod === 'online'
                        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">Pay Online (Paystack)</span>
                      {paymentMethod === 'online' && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Pay immediately with Mobile Money (MTN, Telecel, AT) or Card.
                    </p>
                  </button>
                )}
              </div>
            </div>

            {submitError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              id="confirm-submit-job-btn"
              className="px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 shadow-md transition-all active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Transmitting Document...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>Submit Print Job ({currencySymbol} {priceEstimate.total.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
