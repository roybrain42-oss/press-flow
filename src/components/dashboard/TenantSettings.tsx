import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  Shield,
  CreditCard,
  Clock,
  MapPin,
  Building2,
  Trash2,
  Link2,
  Check,
  ShieldOff,
  Copy,
  QrCode,
  HardDrive,
  Database,
  Smartphone,
  Download,
  ExternalLink,
  User,
  Lock,
  Key,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Tenant } from '../../types';
import { DesktopInstallModal } from '../modals/DesktopInstallModal';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const TenantSettings: React.FC = () => {
  const { user, tenant, refreshMe, updateUserProfile } = useAuth();
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [operatingHours, setOperatingHours] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [payAtShop, setPayAtShop] = useState<boolean>(true);
  const [onlinePay, setOnlinePay] = useState<boolean>(true);
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [maxFileSize, setMaxFileSize] = useState<number>(25);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [copiedDashboardLink, setCopiedDashboardLink] = useState(false);
  const [copiedCustomerLink, setCopiedCustomerLink] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const { downloadWindowsUrlShortcut, downloadWindowsBatLauncher, downloadApk } = usePWAInstall();

  // Owner user account & credentials state
  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerEmail, setOwnerEmail] = useState<string>('');
  const [ownerPhone, setOwnerPhone] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPasswords, setShowPasswords] = useState<boolean>(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const directDashboardUrl = `${window.location.origin}/?portal=${tenant?.slug || 'bright-digital-printing'}`;
  const countertopQrUrl = `${window.location.origin}/?press=${tenant?.slug || 'bright-digital-printing'}`;

  const copyUrl = (text: string, type: 'dashboard' | 'customer') => {
    navigator.clipboard.writeText(text);
    if (type === 'dashboard') {
      setCopiedDashboardLink(true);
      setTimeout(() => setCopiedDashboardLink(false), 2500);
    } else {
      setCopiedCustomerLink(true);
      setTimeout(() => setCopiedCustomerLink(false), 2500);
    }
  };

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || '');
      setPhone(tenant.phone || '');
      setEmail(tenant.email || '');
      setLocation(tenant.location || '');
      setAddress(tenant.address || '');
      setDescription(tenant.description || '');
      setOperatingHours(tenant.settings?.operating_hours || 'Mon-Sat 8:00 AM - 7:00 PM');
      setWhatsapp(tenant.settings?.contact_whatsapp || '');
      setPayAtShop(tenant.settings?.pay_at_shop_enabled ?? true);
      setOnlinePay(tenant.settings?.online_payment_enabled ?? true);
      setRetentionDays(tenant.settings?.document_retention_days || 30);
      setMaxFileSize(tenant.settings?.max_file_size_mb || 25);
    }
    if (user) {
      setOwnerName(user.name || tenant?.owner_name || '');
      setOwnerEmail(user.email || tenant?.email || '');
      setOwnerPhone(user.phone || tenant?.phone || '');
    }
  }, [tenant, user]);

  const handleOwnerProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!ownerName.trim()) {
      setProfileError('User name cannot be empty.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setProfileError('New password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileError('New password and confirmation password do not match.');
        return;
      }
    }

    setIsUpdatingProfile(true);
    try {
      const res = await updateUserProfile({
        name: ownerName.trim(),
        email: ownerEmail.trim(),
        phone: ownerPhone.trim(),
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      });
      setProfileSuccess(res.message || 'Owner user name and password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update credentials.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      await api.updateTenantSettings({
        name,
        phone,
        email,
        location,
        address,
        description,
        settings: {
          currency: tenant?.settings?.currency || 'GHS',
          currency_symbol: tenant?.settings?.currency_symbol || 'GH₵',
          operating_hours: operatingHours,
          contact_whatsapp: whatsapp,
          pay_at_shop_enabled: payAtShop,
          online_payment_enabled: onlinePay,
          payment_provider: 'paystack',
          document_retention_days: retentionDays,
          max_file_size_mb: maxFileSize,
        },
      });
      await refreshMe();
      setSaveSuccess('Business settings updated successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Printing Press Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure your shop profile, pickup location, payment gateways, and security retention policy.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Direct Portal & Access Links */}
      <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/70 p-6 rounded-2xl border border-blue-200 shadow-xs space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-600" />
            <span>Dedicated Direct Links</span>
          </h2>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-200 text-blue-900">
            <ShieldOff className="w-3 h-3 text-blue-700" />
            Isolated From Super Admin
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shop Dashboard Private Link */}
          <div className="bg-white p-4 rounded-xl border border-blue-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Private Shop Dashboard Link
              </span>
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                Only your shop
              </span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Use this private link to access only your press dashboard. Platform super administration is hidden.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={directDashboardUrl}
                className="w-full text-xs font-mono bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 outline-none select-all"
              />
              <button
                type="button"
                onClick={() => copyUrl(directDashboardUrl, 'dashboard')}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1 shrink-0 transition-colors"
              >
                {copiedDashboardLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Customer Countertop Reception Link */}
          <div className="bg-white p-4 rounded-xl border border-blue-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                Customer Countertop QR Link
              </span>
              <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                Walk-in clients
              </span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Walk-in customers scan this link to upload files directly without needing WhatsApp.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={countertopQrUrl}
                className="w-full text-xs font-mono bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 outline-none select-all"
              />
              <button
                type="button"
                onClick={() => copyUrl(countertopQrUrl, 'customer')}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold flex items-center gap-1 shrink-0 transition-colors"
              >
                {copiedCustomerLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop App Shortcut & Android APK Card */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 rounded-2xl border border-purple-800 shadow-md text-white space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner shrink-0">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black tracking-tight text-white">
                  Counter Desktop Shortcut & Android APK App
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready to Download
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Install a 1-click desktop launcher on your counter PC or download the APK package for shop Android tablets.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsInstallModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold flex items-center gap-2 shadow-xs transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Open Install Center</span>
          </button>
        </div>

        {/* Quick action grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <button
            type="button"
            onClick={() => downloadWindowsBatLauncher(tenant?.slug, tenant?.name)}
            className="p-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-left transition-colors flex items-start gap-2.5"
          >
            <HardDrive className="w-4 h-4 text-purple-300 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-white block text-[11px]">Windows Launcher (.bat)</span>
              <span className="text-[10px] text-slate-300">Opens in dedicated borderless desktop app window</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => downloadWindowsUrlShortcut(tenant?.slug, tenant?.name)}
            className="p-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-left transition-colors flex items-start gap-2.5"
          >
            <ExternalLink className="w-4 h-4 text-purple-300 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-white block text-[11px]">Desktop Shortcut (.url)</span>
              <span className="text-[10px] text-slate-300">Standard Windows desktop icon link</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => downloadApk()}
            className="p-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-left transition-colors flex items-start gap-2.5"
          >
            <Smartphone className="w-4 h-4 text-purple-300 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-white block text-[11px]">Android APK (v2.4)</span>
              <span className="text-[10px] text-slate-300">Package installer for counter tablets & phones</span>
            </div>
          </button>
        </div>
      </div>

      {/* Business Identity */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span>Public Shop Profile</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Business Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">City / Region</label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Physical Street Address / Counter Location</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Commercial Area, Opposite Central Library"
            className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Phone Number (Calls)</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">WhatsApp Inquiry Number</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="e.g. +233244123456"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Operating Hours</label>
            <input
              type="text"
              value={operatingHours}
              onChange={(e) => setOperatingHours(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Shop Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Owner Account & Security (User Name & Password) */}
      <div className="bg-white p-6 rounded-2xl border border-blue-200/80 shadow-xs space-y-5 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Owner Profile & Account Credentials</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
                  Press Owner
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Change your user name, email, and password. Synced to Cloud Firestore.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOwnerProfileUpdate}
            disabled={isUpdatingProfile}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-xs transition-colors shrink-0"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{isUpdatingProfile ? 'Updating Credentials...' : 'Save User Name & Password'}</span>
          </button>
        </div>

        {profileSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        {/* Name, Email, Phone Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Owner User Name / Display Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Kwame Mensah"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Shown on receipts and countertop interactions.
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Login Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@yourpress.com"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Used to sign in to your owner dashboard.
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder="+233..."
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Direct line for urgent order alerts.
            </span>
          </div>
        </div>

        {/* Password Change Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-700" />
              <span className="font-bold text-slate-800 text-xs">Change Password</span>
              <span className="text-[10px] text-slate-500 font-normal">
                (Leave blank if keeping current password)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                Current Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                New Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                Confirm New Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span>Payment Acceptance</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="p-4 rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={payAtShop}
              onChange={(e) => setPayAtShop(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 mt-0.5"
            />
            <div>
              <span className="font-bold text-slate-900 block">Allow Pay at Shop</span>
              <span className="text-slate-500">
                Customers can choose to pay cash or Momo when collecting their order at your counter.
              </span>
            </div>
          </label>

          <label className="p-4 rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={onlinePay}
              onChange={(e) => setOnlinePay(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 mt-0.5"
            />
            <div>
              <span className="font-bold text-slate-900 block">Allow Online Mobile Money & Cards</span>
              <span className="text-slate-500">
                Direct online checkout powered by Paystack Ghana (MTN, Telecel, AT, Visa/Mastercard).
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Privacy & Storage Retention Policy */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-600" />
          <span>Document Security & Auto-Purge Policy</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Document Retention Period (Days)
            </label>
            <select
              value={retentionDays}
              onChange={(e) => setRetentionDays(parseInt(e.target.value, 10))}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none"
            >
              <option value={7}>7 Days (Recommended for tight privacy)</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days (Standard)</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
            </select>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Files older than this retention threshold are automatically deleted from server disks.
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Max Upload Size per Document (MB)
            </label>
            <input
              type="number"
              min="5"
              max="50"
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(parseInt(e.target.value, 10) || 25)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none font-bold"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Standard SaaS tier limit is 25 MB.
            </span>
          </div>
        </div>
      </div>

      {/* Cloud Database & Disaster Recovery */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900">Cloud Firestore Storage & Data Durability</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Cloud Firestore Synced
          </span>
        </div>
        <p className="text-slate-600 text-[11px] leading-relaxed">
          Your printing press catalog, live customer print orders, paper options, and financial receipts are permanently stored and backed up in <strong>Google Cloud Firestore</strong>. Data is securely isolated under your shop tenant key (<code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">{tenant?.id}</code>).
        </p>
      </div>

      {/* Desktop App & APK Setup Modal */}
      <DesktopInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </form>
  );
};
