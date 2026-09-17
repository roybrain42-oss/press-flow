import React, { useState, useEffect } from 'react';
import {
  Shield,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  Layers,
  FileText,
  Clock,
  Activity,
  UserCheck,
  Search,
  ExternalLink,
  Trash2,
  Plus,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  MapPin,
  User,
  ArrowRight,
  Key,
  Database,
  RefreshCw,
  Server,
  HardDrive,
} from 'lucide-react';
import { api } from '../../services/api';
import { Tenant, Subscription, AuditLog } from '../../types';
import { RegisterPressModal } from '../modals/RegisterPressModal';
import { useAuth } from '../../context/AuthContext';

interface SuperAdminDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSwitchToPressOwner?: (slug: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  activeTab,
  setActiveTab,
  onSwitchToPressOwner,
}) => {
  const { switchRole, selectedPressSlug, setSelectedPressSlug } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [presses, setPresses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [isSyncingDb, setIsSyncingDb] = useState<boolean>(false);
  const [dbSyncResult, setDbSyncResult] = useState<any | null>(null);
  const [pressFilter, setPressFilter] = useState<string>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);

  // Dedicated in-dashboard Register Press Console state
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('PrintFlow2026!');
  const [regPhone, setRegPhone] = useState('+233 24 ');
  const [regLocation, setRegLocation] = useState('Kumasi');
  const [regAddress, setRegAddress] = useState('');
  const [regOperatingHours, setRegOperatingHours] = useState('Mon–Sat: 8:00 AM – 7:00 PM');
  const [regDescription, setRegDescription] = useState('');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [createdPressResult, setCreatedPressResult] = useState<{
    slug: string;
    name: string;
    ownerEmail: string;
    ownerPass: string;
    portalUrl: string;
    customerUrl: string;
    token?: string;
    user?: any;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsData, pressList, subList, logs, jobs, dbInfo] = await Promise.all([
        api.getAdminStats(),
        api.getAdminPresses(pressFilter),
        api.getAdminSubscriptions(),
        api.getAdminAuditLogs(),
        api.getAdminJobs(),
        api.getDatabaseStatus().catch(() => null),
      ]);
      setStats(statsData);
      setPresses(pressList);
      setSubscriptions(subList);
      setAuditLogs(logs);
      setAllJobs(jobs);
      if (dbInfo) setDbStatus(dbInfo);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePressRegistered = async (
    slug: string,
    _token?: string,
    _user?: any,
    switchImmediately: boolean = false
  ) => {
    await loadData();
    setActionSuccess(`Successfully onboarded printing press: ${slug}`);
    setTimeout(() => setActionSuccess(null), 5000);
    setActiveTab('presses');
    if (switchImmediately) {
      if (onSwitchToPressOwner) {
        onSwitchToPressOwner(slug);
      } else {
        await switchRole('owner', slug);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [pressFilter]);

  const handleUpdateStatus = async (id: string, status: 'active' | 'suspended') => {
    try {
      await api.updatePressStatus(id, status);
      setActionSuccess(`Printing press status updated to ${status}`);
      loadData();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    }
  };

  const handleInitiateDelete = (tenant: any) => {
    setDeletingTenant(tenant);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTenant) return;
    setIsDeleting(true);
    try {
      const res = await api.deletePress(deletingTenant.id);
      setActionSuccess(res.message || `Printing press "${deletingTenant.name}" has been permanently deleted.`);
      setDeletingTenant(null);
      await loadData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete printing press.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSyncDatabase = async () => {
    setIsSyncingDb(true);
    setDbSyncResult(null);
    try {
      const res = await api.syncDatabase();
      setDbSyncResult(res);
      setActionSuccess(`Synced ${res.count || 0} records to Cloud Firestore successfully!`);
      const updatedStatus = await api.getDatabaseStatus().catch(() => null);
      if (updatedStatus) setDbStatus(updatedStatus);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Database synchronization failed.');
    } finally {
      setIsSyncingDb(false);
    }
  };

  const handlePrefillSample = () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setRegBusinessName(`Apex High-Tech Press ${randomSuffix}`);
    setRegOwnerName('Kwame Mensah');
    setRegEmail(`kwame.mensah${randomSuffix}@apexprint.gh`);
    setRegPassword('PrintFlow2026!');
    setRegPhone('+233 24 555 8920');
    setRegLocation('Kumasi');
    setRegAddress('Adum Commercial Center, Shop B-12, Kumasi');
    setRegOperatingHours('Mon–Sat: 7:30 AM – 7:30 PM');
    setRegDescription('Fast-turnaround digital color printouts, architectural CAD plots, invoice books, and roll-up banners.');
    setRegError(null);
  };

  const handleInlineRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReg(true);
    setRegError(null);

    try {
      const res = await api.registerPress({
        business_name: regBusinessName,
        owner_name: regOwnerName,
        email: regEmail,
        password: regPassword,
        phone: regPhone,
        location: regLocation,
        address: regAddress,
        operating_hours: regOperatingHours,
        description: regDescription,
      });

      const origin = window.location.origin;
      const portalUrl = `${origin}/?portal=${res.tenant.slug}`;
      const customerUrl = `${origin}/?press=${res.tenant.slug}`;

      setCreatedPressResult({
        slug: res.tenant.slug,
        name: res.tenant.name,
        ownerEmail: regEmail,
        ownerPass: regPassword,
        portalUrl,
        customerUrl,
        token: res.token,
        user: res.user,
      });

      setActionSuccess(`Printing press "${res.tenant.name}" successfully registered & active!`);
      await loadData();
    } catch (err: any) {
      setRegError(err.message || 'Registration failed. Please review your inputs.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleResetRegForm = () => {
    setCreatedPressResult(null);
    setRegBusinessName('');
    setRegOwnerName('');
    setRegEmail('');
    setRegPassword('PrintFlow2026!');
    setRegPhone('+233 24 ');
    setRegAddress('');
    setRegDescription('');
    setRegError(null);
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Headline */}
      <div className="bg-slate-900 text-white p-6 sm:p-7 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Platform Headquarters
            </span>
            <span className="text-xs text-slate-400">Multi-Tenant Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
            PrintFlow Super Admin
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global oversight across all onboarded printing presses, tenant subscriptions, and system audit trails.
          </p>
        </div>

        {/* Actions & Tab Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 ${
              activeTab === 'register'
                ? 'bg-white text-purple-950 ring-2 ring-purple-400 font-extrabold'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Register Press</span>
          </button>

          {/* Tab Controls */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-800 p-1.5 rounded-xl text-xs">
            {[
              { id: 'stats', label: 'Platform Stats' },
              { id: 'presses', label: `Presses (${stats?.tenants?.total || 0})` },
              { id: 'register', label: 'Register Press', icon: Plus },
              { id: 'subscriptions', label: 'SaaS Plans' },
              { id: 'database', label: 'Cloud Database', icon: Database },
              { id: 'audit', label: 'Audit Logs' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.id ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ADMIN-ONLY ACTIVE PRINTING PRESS SWITCHER */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs">Switch Active Printing Press</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Admin Exclusive
              </span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Select any printing press to inspect its operations or switch into its owner dashboard.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {presses.length > 0 && (
            <select
              id="admin-switch-press-select"
              value={selectedPressSlug}
              onChange={(e) => {
                const slug = e.target.value;
                setSelectedPressSlug(slug);
              }}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
            >
              {presses.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name} ({p.location}) — {p.status.replace('_', ' ')}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              const targetSlug = selectedPressSlug || (presses[0]?.slug ?? 'bright-digital-printing');
              if (onSwitchToPressOwner) {
                onSwitchToPressOwner(targetSlug);
              } else {
                switchRole('owner', targetSlug);
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Switch into this press's owner dashboard"
          >
            <span>Switch to This Press</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW & STATS */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Active Presses
              </span>
              <div className="text-3xl font-black text-slate-900">
                {stats?.tenants?.active || 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Total onboarded: {stats?.tenants?.total || 0}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Pending Approval
              </span>
              <div className="text-3xl font-black text-amber-600">
                {stats?.tenants?.pending || 0}
              </div>
              <p className="text-[11px] text-amber-600 mt-1">Awaiting registration review</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Platform Volume (Jobs)
              </span>
              <div className="text-3xl font-black text-blue-700">
                GH₵ {stats?.revenue?.platformVolumeGHS?.toFixed(2) || '0.00'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {stats?.jobs?.total || 0} total print orders processed
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                SaaS Monthly ARR
              </span>
              <div className="text-3xl font-black text-purple-700">
                GH₵ {stats?.revenue?.subscriptionMonthlyGHS?.toFixed(2) || '0.00'}
              </div>
              <p className="text-[11px] text-purple-600 mt-1">Recurring subscription billings</p>
            </div>
          </div>

          {/* Quick Onboard Banner */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-purple-800/60 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Register & Onboard a Printing Press</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30">
                    Direct Provisioning
                  </span>
                </div>
                <p className="text-xs text-purple-200/80 mt-0.5">
                  Directly register new print companies, assign owner logins, and immediately generate isolated shop portal and customer reception links.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-white text-purple-950 hover:bg-purple-50 text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 text-purple-700" />
              <span>Register Printing Press</span>
            </button>
          </div>

          {/* Cross-Tenant Recent Jobs Feed */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Cross-Tenant Print Activity Stream
              </h2>
              <span className="text-xs font-semibold text-slate-500">Live platform throughput</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-3 px-4">Job Number</th>
                    <th className="py-3 px-4">Printing Press</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allJobs.slice(0, 8).map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{j.job_number}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {j.tenant_name}
                        <span className="text-slate-400 text-[10px] block">{j.tenant_location}</span>
                      </td>
                      <td className="py-3 px-4">{j.customer_name}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        GH₵ {j.estimated_total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {j.job_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(j.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRINTING PRESSES MANAGEMENT */}
      {activeTab === 'presses' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-slate-500 shrink-0">Filter Status:</span>
              {(['all', 'active', 'pending_approval', 'suspended'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPressFilter(filter)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize ${
                    pressFilter === filter
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter.replace('_', ' ')}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register New Press</span>
            </button>
          </div>

          {presses.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No printing presses found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No printing presses match the selected filter. You can onboard a new printing company directly into the platform.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Printing Press</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {presses.map((p) => (
              <div
                key={p.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          p.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'pending_approval'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {p.status.replace('_', ' ')}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{p.name}</h3>
                      <p className="text-xs text-slate-500">
                        {p.location} • Owner: <strong>{p.owner_name}</strong>
                      </p>
                    </div>

                    <span className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 uppercase">
                      {p.plan_id} Plan
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Email</span>
                      <span className="truncate block font-medium">{p.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Phone</span>
                      <span className="font-medium">{p.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Total Jobs Handled</span>
                      <strong className="text-slate-900 font-bold">{p.jobCount || 0}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Public Slug</span>
                      <span className="font-mono text-[11px] text-blue-600">/p/{p.slug}</span>
                    </div>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <a
                    href={`/?press=${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>View Public Page</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSwitchToPressOwner) {
                          onSwitchToPressOwner(p.slug);
                        } else {
                          switchRole('owner', p.slug);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                      title="Switch to manage this printing press as owner"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Switch to this Press</span>
                    </button>

                    {p.status === 'pending_approval' && (
                      <button
                        onClick={() => handleUpdateStatus(p.id, 'active')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        Approve Press
                      </button>
                    )}

                    {p.status === 'active' && (
                      <button
                        onClick={() => handleUpdateStatus(p.id, 'suspended')}
                        className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 text-xs font-semibold"
                      >
                        Suspend
                      </button>
                    )}

                    {p.status === 'suspended' && (
                      <button
                        onClick={() => handleUpdateStatus(p.id, 'active')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        Re-activate
                      </button>
                    )}

                    <button
                      onClick={() => handleInitiateDelete(p)}
                      className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Permanently Delete Press"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* TAB: REGISTER PRESS & DIRECT TENANT ONBOARDING */}
      {activeTab === 'register' && (
        <div className="space-y-6">
          {createdPressResult ? (
            /* SUCCESS & HANDOFF SCREEN */
            <div className="bg-white rounded-2xl border border-purple-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-98 duration-200">
              <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 p-6 sm:p-7 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Tenant Provisioned
                        </span>
                        <span className="text-xs text-purple-200 font-mono">
                          slug: {createdPressResult.slug}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                        {createdPressResult.name} is Live!
                      </h2>
                      <p className="text-xs text-purple-200/80 mt-0.5">
                        The isolated environment, customer QR reception countertop, and shop manager accounts are active.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetRegForm}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold shrink-0 transition-colors border border-white/20"
                  >
                    + Register Another Press
                  </button>
                </div>
              </div>

              {/* Handoff Details Cards */}
              <div className="p-6 sm:p-7 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Customer Countertop QR URL */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Customer Reception Link
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          Public QR Scan
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Customers scan this at the counter or open remotely to upload print documents and calculate instant estimates.
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-slate-700 truncate select-all">
                        {createdPressResult.customerUrl}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyText(createdPressResult.customerUrl, 'customer')}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          {copiedKey === 'customer' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <a
                          href={createdPressResult.customerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-blue-600 rounded"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Shop Owner Portal URL */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Shop Owner Portal Link
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          Private Manager
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Dedicated dashboard URL for incoming print job dispatch, price tier configurations, and staff oversight.
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-slate-700 truncate select-all">
                        {createdPressResult.portalUrl}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyText(createdPressResult.portalUrl, 'portal')}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          {copiedKey === 'portal' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <a
                          href={createdPressResult.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-purple-600 rounded"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Owner Credentials Handoff */}
                <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-900">
                      <Key className="w-4 h-4 text-purple-700" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Client Login Credentials (Handoff Kit)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const creds = `PrintFlow Press Login Credentials:\nShop Name: ${createdPressResult.name}\nDashboard URL: ${createdPressResult.portalUrl}\nEmail: ${createdPressResult.ownerEmail}\nPassword: ${createdPressResult.ownerPass}\nPublic Reception URL: ${createdPressResult.customerUrl}`;
                        handleCopyText(creds, 'creds');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      {copiedKey === 'creds' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Credentials Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Client Handoff Text</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-lg border border-purple-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Owner Email</span>
                      <span className="font-mono font-bold text-slate-800 select-all">
                        {createdPressResult.ownerEmail}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-purple-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Initial Password</span>
                      <span className="font-mono font-bold text-slate-800 select-all">
                        {createdPressResult.ownerPass}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Navigation Options */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveTab('presses')}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
                  >
                    ← View in Printing Presses Directory
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSwitchToPressOwner) {
                          onSwitchToPressOwner(createdPressResult.slug);
                        } else {
                          switchRole('owner', createdPressResult.slug);
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <span>Switch & Manage As Shop Owner</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ONBOARDING REGISTRATION FORM */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Header banner */}
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Register & Provision Printing Press
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        Direct Provisioning
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Directly onboard new print shops into PrintFlow with immediate active status, custom QR countertop reception, and shop owner logins.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handlePrefillSample}
                    className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Auto-Fill Sample Press</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRegisterModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors"
                  >
                    Open as Popup Modal
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {regError && (
                <div className="mx-6 mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleInlineRegisterSubmit} className="p-6 sm:p-7 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Business Profile */}
                  <div className="space-y-4">
                    <div className="pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <span>1. Printing Press Identity & Counter</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Shop public details displayed on customer reception pages and invoices.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Printing Press / Business Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={regBusinessName}
                        onChange={(e) => setRegBusinessName(e.target.value)}
                        placeholder="e.g. Apex Digital Print & Design Hub"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          City / Region <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={regLocation}
                          onChange={(e) => setRegLocation(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs bg-white"
                        >
                          <option value="Kumasi">Kumasi</option>
                          <option value="Accra">Accra</option>
                          <option value="Takoradi">Takoradi</option>
                          <option value="Tema">Tema</option>
                          <option value="Cape Coast">Cape Coast</option>
                          <option value="Tamale">Tamale</option>
                          <option value="Sunyani">Sunyani</option>
                          <option value="Koforidua">Koforidua</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Counter Operating Hours
                        </label>
                        <input
                          type="text"
                          value={regOperatingHours}
                          onChange={(e) => setRegOperatingHours(e.target.value)}
                          placeholder="e.g. Mon–Sat: 8:00 AM – 7:00 PM"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Physical Address & Counter Location
                      </label>
                      <input
                        type="text"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="e.g. Adum High Street, Near Kejetia Central Market, Kumasi"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Services & Shop Overview
                      </label>
                      <textarea
                        rows={3}
                        value={regDescription}
                        onChange={(e) => setRegDescription(e.target.value)}
                        placeholder="e.g. Specialized in digital laser printing, wide-format canvas banners, booklet binding, CAD plots, and business cards."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                      />
                    </div>
                  </div>

                  {/* Right Column: Owner Credentials & Access */}
                  <div className="space-y-4">
                    <div className="pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-4 h-4 text-purple-600" />
                        <span>2. Shop Owner Credentials & Access</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Login account created for the printing press manager.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Owner Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={regOwnerName}
                        onChange={(e) => setRegOwnerName(e.target.value)}
                        placeholder="e.g. Kwame Mensah"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Owner Login Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="e.g. kwame@apexprint.gh"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Initial Password <span className="text-rose-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const randomPass = 'PF-' + Math.random().toString(36).slice(-6) + '!';
                              setRegPassword(randomPass);
                            }}
                            className="text-[10px] text-purple-600 hover:text-purple-800 font-semibold"
                          >
                            Generate
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Contact Phone Number
                        </label>
                        <input
                          type="text"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="e.g. +233 24 555 8920"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                        />
                      </div>
                    </div>

                    {/* Admin Guarantees */}
                    <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100 space-y-2 text-xs">
                      <span className="font-bold text-purple-900 block text-[11px] uppercase tracking-wider">
                        Super Admin Provisioning Features:
                      </span>
                      <ul className="space-y-1 text-slate-600 text-[11px]">
                        <li className="flex items-center gap-1.5 text-purple-950 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Immediate Active Status (Bypasses verification queue)</span>
                        </li>
                        <li className="flex items-center gap-1.5 text-purple-950 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Automated URL slug generation (/p/business-name)</span>
                        </li>
                        <li className="flex items-center gap-1.5 text-purple-950 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Initial Starter SaaS tier provisioned at GH₵ 0.00</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleResetRegForm}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Clear Form
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSubmittingReg}
                      className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                      {isSubmittingReg ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Provisioning Press Environment...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Register & Provision Press</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SUBSCRIPTIONS & PLANS */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tenant SaaS Subscriptions</h2>
              <p className="text-xs text-slate-500">Tier limits and recurring monthly charges</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-3 px-4">Printing Press</th>
                  <th className="py-3 px-4">Plan Tier</th>
                  <th className="py-3 px-4">Monthly Rate</th>
                  <th className="py-3 px-4">Monthly Quota</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Renews At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {sub.tenant_name}
                      <span className="text-[11px] text-slate-400 block font-normal font-mono">
                        /p/{sub.tenant_slug}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                        {sub.plan_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      GH₵ {sub.monthly_price.toFixed(2)}/mo
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {sub.current_month_jobs} / {sub.max_jobs_per_month} jobs
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700">
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(sub.renews_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Platform-Wide Security Audit Logs</h2>
            <span className="text-xs font-semibold text-slate-500">{auditLogs.length} events</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 sm:p-4 hover:bg-slate-50 transition-colors flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{log.action}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {log.resource_type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Actor: <strong>{log.user_email || 'System / Customer'}</strong> ({log.role || 'public'}) • IP: {log.ip || '127.0.0.1'}
                  </p>
                  {log.details && (
                    <pre className="mt-1 text-[10px] text-slate-600 bg-slate-100 p-1.5 rounded overflow-x-auto max-w-xl">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CLOUD FIRESTORE DATABASE TAB */}
      {activeTab === 'database' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Status Banner */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-sm border border-purple-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0">
                <Database className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tracking-wider uppercase text-purple-300">
                    Production Persistence Layer
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {dbStatus?.firestore?.connected ? 'Firestore Connected' : 'Ready & Active'}
                  </span>
                </div>
                <h2 className="text-xl font-black mt-1">Google Cloud Firestore Database</h2>
                <p className="text-xs text-purple-200/80 mt-1 max-w-2xl">
                  Fully provisioned multi-tenant database storing printing press businesses, live customer print orders, catalog pricing, user accounts, and financial records.
                </p>
              </div>
            </div>

            <button
              onClick={handleSyncDatabase}
              disabled={isSyncingDb}
              className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingDb ? 'animate-spin' : ''}`} />
              <span>{isSyncingDb ? 'Syncing Records...' : 'Force Full Sync'}</span>
            </button>
          </div>

          {/* Sync result alert if available */}
          {dbSyncResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Full Sync Completed:</strong> Successfully synchronized {dbSyncResult.count} documents to Cloud Firestore at {new Date(dbSyncResult.timestamp).toLocaleTimeString()}.
              </span>
            </div>
          )}

          {/* Database Specs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Database ID
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Server className="w-4 h-4 text-purple-600" />
                <span className="font-mono text-xs font-bold text-slate-900 truncate">
                  {dbStatus?.firestore?.databaseId || 'ai-studio-printflow-...'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2 block">
                Dedicated database instance provisioned for PrintFlow
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                GCP Project
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span className="font-mono text-xs font-bold text-slate-900 truncate">
                  {dbStatus?.firestore?.projectId || 'gen-lang-client-0548628441'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2 block">
                Cloud resource project with deployed security rules
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Storage Architecture
              </span>
              <div className="flex items-center gap-2 mt-1">
                <HardDrive className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  Dual-Engine: Firestore + WAL
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2 block">
                Cloud durability + sub-millisecond local caching
              </span>
            </div>
          </div>

          {/* Collection Counts & Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Firestore Collections & Schemas</h3>
                <p className="text-xs text-slate-500">Live document counts stored in database collections</p>
              </div>
              <span className="text-xs font-mono font-semibold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                Blueprint: firebase-blueprint.json
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">/tenants</span>
                <span className="text-2xl font-black text-slate-900 block mt-1">
                  {dbStatus?.collections?.tenants ?? presses.length}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Printing Press Shops</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">/print_jobs</span>
                <span className="text-2xl font-black text-slate-900 block mt-1">
                  {dbStatus?.collections?.print_jobs ?? allJobs.length}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Customer Print Orders</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">/services</span>
                <span className="text-2xl font-black text-slate-900 block mt-1">
                  {dbStatus?.collections?.services ?? 8}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Printing & Binding Catalog</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">/users</span>
                <span className="text-2xl font-black text-slate-900 block mt-1">
                  {dbStatus?.collections?.users ?? 4}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Admins, Owners & Staff</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">/subscriptions</span>
                <span className="text-2xl font-black text-slate-900 block mt-1">
                  {dbStatus?.collections?.subscriptions ?? subscriptions.length}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">SaaS Quotas & Tiers</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">/payments</span>
                <span className="text-2xl font-black text-slate-900 block mt-1">
                  {dbStatus?.collections?.payments ?? 2}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Transactions & Receipts</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">/documents</span>
                <span className="text-2xl font-black text-slate-900 block mt-1">
                  {dbStatus?.collections?.documents ?? 6}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Uploaded PDF Metadata</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">/audit_logs</span>
                <span className="text-2xl font-black text-slate-900 block mt-1">
                  {dbStatus?.collections?.audit_logs ?? auditLogs.length}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Security Event Trail</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTenant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Printing Press?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permanent removal from PrintFlow platform
                </p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5 text-xs text-rose-900 space-y-1.5">
              <p className="font-semibold">
                Are you sure you want to delete <span className="font-bold underline">{deletingTenant.name}</span>?
              </p>
              <ul className="list-disc list-inside text-[11px] text-rose-800 space-y-0.5 pt-1">
                <li>Permanently removes company profile and slug (<strong>/p/{deletingTenant.slug}</strong>)</li>
                <li>Deletes all associated shop owner & staff accounts</li>
                <li>Removes all customer print jobs, uploaded documents, and payments</li>
                <li>Deletes all configured services and pricing rules</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingTenant(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Company</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Press Modal for Super Admin */}
      <RegisterPressModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegistered={handlePressRegistered}
        isAdminRegistering={true}
      />
    </div>
  );
};
