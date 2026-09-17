import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  DollarSign,
  Clock,
  Printer,
  Package,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  RefreshCw,
  Phone,
  ChevronRight,
  User,
  ArrowUpRight,
  Link2,
  Check,
  ShieldOff,
  QrCode,
  Copy,
  ExternalLink,
  Tag,
  Smartphone,
  FileSearch,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PrintJob, DashboardData, JobStatus, PaymentStatus } from '../../types';
import { JobDetailModal } from './JobDetailModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';

interface TenantDashboardProps {
  onSwitchTab?: (tab: string) => void;
}

export const TenantDashboard: React.FC<TenantDashboardProps> = ({ onSwitchTab }) => {
  const { tenant } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [previewJob, setPreviewJob] = useState<PrintJob | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedPortalLink, setCopiedPortalLink] = useState<boolean>(false);
  const [copiedQrLink, setCopiedQrLink] = useState<boolean>(false);

  const directDashboardUrl = `${window.location.origin}/?portal=${tenant?.slug || 'bright-digital-printing'}`;
  const countertopQrUrl = `${window.location.origin}/?press=${tenant?.slug || 'bright-digital-printing'}`;

  const copyToClipboard = (text: string, type: 'portal' | 'qr') => {
    navigator.clipboard.writeText(text);
    if (type === 'portal') {
      setCopiedPortalLink(true);
      setTimeout(() => setCopiedPortalLink(false), 2500);
    } else {
      setCopiedQrLink(true);
      setTimeout(() => setCopiedQrLink(false), 2500);
    }
  };

  const fetchDashboardAndJobs = async () => {
    setIsRefreshing(true);
    try {
      const [dash, jobList] = await Promise.all([
        api.getTenantDashboard(),
        api.getTenantJobs({
          search: searchQuery,
          status: statusFilter,
          payment_status: paymentFilter,
          date_range: dateRange,
        }),
      ]);
      setDashboardData(dash);
      setJobs(jobList);
    } catch (err) {
      console.error('Failed to load tenant dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardAndJobs();
  }, [statusFilter, paymentFilter, dateRange]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDashboardAndJobs();
  };

  // Quick inline status transition
  const handleQuickStatusChange = async (jobId: string, newStatus: JobStatus) => {
    try {
      const updated = await api.updateJobStatus(jobId, { status: newStatus });
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      // Refresh dashboard summary KPI counts
      api.getTenantDashboard().then(setDashboardData).catch(console.error);
    } catch (err: any) {
      alert(err.message || 'Failed to update job status.');
    }
  };

  const currencySymbol = tenant?.settings?.currency_symbol || 'GH₵';

  return (
    <div className="space-y-6">
      {/* Top Banner / Press Identity */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {tenant?.name || 'Printing Press Dashboard'}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active Press
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time digital counter queue and incoming document orders
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardAndJobs}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Direct Links Card: Private Dashboard Link (NO super admin) + Customer QR Link */}
      <div className="bg-gradient-to-r from-blue-50/90 via-slate-50 to-emerald-50/60 p-4 sm:p-5 rounded-2xl border border-blue-200/70 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Private Dashboard Link Section */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                <Link2 className="w-3 h-3" />
                Direct Dashboard Link
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                <ShieldOff className="w-3 h-3 text-blue-600" />
                Dedicated Counter Mode
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Share or bookmark this link for your operators. It leads <strong>directly to only your shop dashboard</strong> and incoming jobs.
            </p>
            <div className="flex items-center gap-2 max-w-xl">
              <input
                type="text"
                readOnly
                value={directDashboardUrl}
                className="w-full h-8 px-2.5 text-xs font-mono bg-white rounded-lg border border-slate-300 text-slate-700 outline-none select-all"
              />
              <button
                onClick={() => copyToClipboard(directDashboardUrl, 'portal')}
                className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                title="Copy direct link to your shop dashboard"
              >
                {copiedPortalLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Customer Countertop QR Link */}
          <div className="lg:border-l lg:border-slate-200 lg:pl-6 space-y-1.5 shrink-0">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
              <span>Customer Countertop QR Link</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Customers scan this to upload documents at your counter
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={countertopQrUrl}
                className="w-48 sm:w-64 h-8 px-2 text-xs font-mono bg-white rounded-lg border border-slate-300 text-slate-600 outline-none select-all truncate"
              />
              <button
                onClick={() => copyToClipboard(countertopQrUrl, 'qr')}
                className="h-8 px-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
              >
                {copiedQrLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedQrLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Pricing & Rates Access Card */}
      <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Tag className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900">Services & Price Management</h3>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                Live Calculator Rates
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Edit existing printing and binding prices, add new items, or pause rates when consumables change.
            </p>
          </div>
        </div>
        <button
          onClick={() => onSwitchTab?.('pricing')}
          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span>Edit & Add Prices</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* KPI Metrics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Today's Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {currencySymbol} {dashboardData?.revenue.today.toFixed(2) || '0.00'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            Month: {currencySymbol} {dashboardData?.revenue.monthly.toFixed(2) || '0.00'}
          </p>
        </div>

        {/* Pending Queue */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pending Orders
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {dashboardData?.counts.pending || 0}
          </div>
          <p className="text-[11px] text-amber-600 mt-1 font-medium">Requires approval or start</p>
        </div>

        {/* In Production */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              On Press / Printing
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {(dashboardData?.counts.accepted || 0) + (dashboardData?.counts.processing || 0)}
          </div>
          <p className="text-[11px] text-blue-600 mt-1 font-medium">Currently in production</p>
        </div>

        {/* Ready for Pickup */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Ready for Pickup
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {dashboardData?.counts.ready_for_pickup || 0}
          </div>
          <p className="text-[11px] text-indigo-600 mt-1 font-medium">Waiting for customer counter collection</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Job #, Customer name, Phone, or Document..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700 focus:outline-none"
            >
              <option value="all">All Payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="pay_at_shop">Pay at Shop</option>
            </select>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700 focus:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
            </select>

            <button
              type="submit"
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
            >
              Filter
            </button>
          </div>
        </form>

        {/* Status Pill Filters */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Status:</span>
          {[
            { id: 'all', label: 'All Jobs' },
            { id: 'pending', label: 'Pending' },
            { id: 'accepted', label: 'Accepted' },
            { id: 'processing', label: 'Processing' },
            { id: 'ready_for_pickup', label: 'Ready for Pickup' },
            { id: 'completed', label: 'Completed' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === pill.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Print Jobs Queue</h2>
            <p className="text-xs text-slate-500">Showing {jobs.length} jobs in queue</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500">Loading incoming jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">No jobs found</p>
            <p className="text-xs text-slate-500 mt-0.5">
              No orders matched your active filter or search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Job Number</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Specs</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-blue-50/30 transition-colors group">
                    {/* Job Number */}
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-blue-700 block font-mono">
                        {job.job_number}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{job.customer_name}</div>
                      <a
                        href={`tel:${job.customer_phone}`}
                        className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{job.customer_phone}</span>
                      </a>
                    </td>

                    {/* Document */}
                    <td className="py-3.5 px-4 max-w-[220px]">
                      <div className="font-semibold text-slate-800 truncate" title={job.document_name}>
                        {job.document_name}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                        <span>{(job.document_size / (1024 * 1024)).toFixed(1)} MB</span>
                        <button
                          type="button"
                          onClick={() => setPreviewJob(job)}
                          className="text-purple-600 hover:text-purple-800 font-bold inline-flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded text-[11px] transition-colors border border-purple-200/60"
                          title="Open PDF Viewer & verify requirements before printing"
                        >
                          <FileSearch className="w-3 h-3 text-purple-500" />
                          <span>Preview PDF</span>
                        </button>
                        <a
                          href={`/api/public/documents/${job.document_id}/download?token=${encodeURIComponent(job.tracking_token)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-0.5"
                          title="Download original file"
                        >
                          <Download className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </td>

                    {/* Specifications */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-700">
                        {job.options.copies} {job.options.copies === 1 ? 'copy' : 'copies'} • {job.options.paper_size}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {job.options.color_mode === 'color' ? (
                          <span className="text-amber-600 font-semibold">Colour</span>
                        ) : (
                          'B&W'
                        )}{' '}
                        • {job.options.sidedness}-sided
                        {job.options.binding && job.options.binding !== 'none' && ` • ${job.options.binding}`}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4">
                      <span className="font-black text-slate-900 text-sm">
                        {currencySymbol} {job.estimated_total.toFixed(2)}
                      </span>
                    </td>

                    {/* Payment Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          job.payment_status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {job.payment_status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Status Pill */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          job.job_status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : job.job_status === 'accepted'
                            ? 'bg-blue-100 text-blue-800'
                            : job.job_status === 'processing'
                            ? 'bg-purple-100 text-purple-800 animate-pulse'
                            : job.job_status === 'ready_for_pickup'
                            ? 'bg-indigo-100 text-indigo-800'
                            : job.job_status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {job.job_status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Quick Inline Actions */}
                    <td className="py-3.5 px-4 text-right space-x-1">
                      {job.job_status === 'pending' && (
                        <button
                          onClick={() => handleQuickStatusChange(job.id, 'accepted')}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors"
                        >
                          Accept
                        </button>
                      )}

                      {job.job_status === 'accepted' && (
                        <button
                          onClick={() => handleQuickStatusChange(job.id, 'processing')}
                          className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition-colors"
                        >
                          Start Print
                        </button>
                      )}

                      {job.job_status === 'processing' && (
                        <button
                          onClick={() => handleQuickStatusChange(job.id, 'ready_for_pickup')}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors"
                        >
                          Mark Ready
                        </button>
                      )}

                      {job.job_status === 'ready_for_pickup' && (
                        <button
                          onClick={() => handleQuickStatusChange(job.id, 'completed')}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
                        >
                          Complete
                        </button>
                      )}

                      <button
                        onClick={() => setPreviewJob(job)}
                        className="p-1.5 rounded-lg border border-purple-200 text-purple-600 hover:text-purple-900 hover:bg-purple-50 transition-colors inline-flex items-center"
                        title="Open PDF Viewer & verify requirements before printing"
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setSelectedJob(job)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors inline-flex items-center"
                        title="View complete order details & operator controls"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Preview & Pre-Flight Verification Modal */}
      {previewJob && (
        <DocumentPreviewModal
          job={previewJob}
          onClose={() => setPreviewJob(null)}
          onStatusUpdated={(updated) => {
            setPreviewJob(updated);
            setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
            api.getTenantDashboard().then(setDashboardData).catch(console.error);
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onOpenPreview={(jobToPreview) => {
            setSelectedJob(null);
            setPreviewJob(jobToPreview);
          }}
          onStatusUpdated={(updated) => {
            setSelectedJob(updated);
            setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
            api.getTenantDashboard().then(setDashboardData).catch(console.error);
          }}
        />
      )}
    </div>
  );
};
