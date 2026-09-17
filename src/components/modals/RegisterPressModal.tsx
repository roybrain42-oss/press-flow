import React, { useState } from 'react';
import { X, Building2, User, Mail, Lock, Phone, MapPin, CheckCircle2, Clock, Copy, Check, ExternalLink, ShieldOff, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';

interface RegisterPressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: (slug: string, token?: string, user?: any, switchImmediately?: boolean, tenant?: any) => void;
  isAdminRegistering?: boolean;
}

export const RegisterPressModal: React.FC<RegisterPressModalProps> = ({
  isOpen,
  onClose,
  onRegistered,
  isAdminRegistering = false,
}) => {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('Kumasi');
  const [address, setAddress] = useState('');
  const [operatingHours, setOperatingHours] = useState('Mon–Sat: 8:00 AM – 7:00 PM');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state holding newly created press info
  const [createdPress, setCreatedPress] = useState<{
    slug: string;
    name: string;
    ownerEmail: string;
    ownerPass: string;
    token?: string;
    user?: any;
    tenant?: any;
    dashboardUrl: string;
    customerUrl: string;
  } | null>(null);

  const [copiedDashboard, setCopiedDashboard] = useState(false);
  const [copiedCustomer, setCopiedCustomer] = useState(false);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.registerPress({
        business_name: businessName,
        owner_name: ownerName,
        email,
        password,
        phone,
        location,
        address,
        operating_hours: operatingHours,
        description,
      });

      const origin = window.location.origin;
      const portalUrl = `${origin}/?portal=${res.tenant.slug}`;
      const custUrl = `${origin}/?press=${res.tenant.slug}`;

      // Only store token in localStorage if not in Super Admin onboarding mode
      if (res.token && !isAdminRegistering) {
        localStorage.setItem('printflow_token', res.token);
      }

      setCreatedPress({
        slug: res.tenant.slug,
        name: res.tenant.name,
        ownerEmail: email,
        ownerPass: password,
        token: res.token,
        user: res.user,
        tenant: res.tenant,
        dashboardUrl: portalUrl,
        customerUrl: custUrl,
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please verify your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string, type: 'dashboard' | 'customer' | 'credentials') => {
    navigator.clipboard.writeText(text);
    if (type === 'dashboard') {
      setCopiedDashboard(true);
      setTimeout(() => setCopiedDashboard(false), 2500);
    } else if (type === 'customer') {
      setCopiedCustomer(true);
      setTimeout(() => setCopiedCustomer(false), 2500);
    } else {
      setCopiedCredentials(true);
      setTimeout(() => setCopiedCredentials(false), 2500);
    }
  };

  const handleEnterDashboard = (switchImmediately: boolean = true) => {
    if (createdPress) {
      onRegistered(createdPress.slug, createdPress.token, createdPress.user, switchImmediately, createdPress.tenant);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                isAdminRegistering ? 'bg-purple-600' : 'bg-orange-600'
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">
                  {createdPress
                    ? isAdminRegistering
                      ? 'Printing Press Successfully Onboarded!'
                      : 'Printing Press Ready!'
                    : isAdminRegistering
                    ? 'Register New Printing Press'
                    : 'Register Your Printing Press'}
                </h2>
                {isAdminRegistering && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Super Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {createdPress
                  ? isAdminRegistering
                    ? 'New tenant created in database. Hand off credentials to owner.'
                    : 'Private Shop Portal Provisioned'
                  : isAdminRegistering
                  ? 'Platform Company Onboarding & Tenant Provisioning'
                  : 'Join the PrintFlow SaaS network'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View: Displays private dashboard link without super admin */}
        {createdPress ? (
          <div className="p-6 space-y-5 text-xs">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  {createdPress.name} is now live!
                </h3>
                <p className="text-emerald-800 mt-0.5">
                  {isAdminRegistering
                    ? 'The printing press tenant has been created and activated in the database.'
                    : 'Your printing press account is created and fully activated. You have an exclusive private link configured for your shop.'}
                </p>
              </div>
            </div>

            {/* Shop Owner Credentials Card for Super Admin */}
            {isAdminRegistering && (
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                    <User className="w-4 h-4 text-amber-700" />
                    <span>Owner Login Credentials (For Shop Hand-off)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        `Shop: ${createdPress.name}\nEmail: ${createdPress.ownerEmail}\nPassword: ${createdPress.ownerPass}\nPortal: ${createdPress.dashboardUrl}`,
                        'credentials'
                      )
                    }
                    className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    {copiedCredentials ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCredentials ? 'Copied Details' : 'Copy All Details'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-white p-2.5 rounded-lg border border-amber-200">
                  <div>
                    <span className="text-slate-400 block text-[10px]">LOGIN EMAIL</span>
                    <span className="font-bold text-slate-800">{createdPress.ownerEmail}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">PASSWORD</span>
                    <span className="font-bold text-slate-800">{createdPress.ownerPass}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Private Dashboard Link Card (NO Super Admin) */}
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Private Dashboard Link (Only This Press)</span>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-200 text-blue-900">
                  <ShieldOff className="w-3 h-3 text-blue-700" />
                  No Super Admin Panel
                </span>
              </div>

              <p className="text-slate-600 text-[11px]">
                Direct link for the shop owner and staff. Leads <strong>exclusively to this shop&apos;s queue</strong> without exposing platform Super Admin controls.
              </p>

              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-blue-200">
                <input
                  type="text"
                  readOnly
                  value={createdPress.dashboardUrl}
                  className="w-full text-xs font-mono bg-transparent text-slate-800 outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(createdPress.dashboardUrl, 'dashboard')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md flex items-center gap-1 shrink-0 transition-colors"
                >
                  {copiedDashboard ? (
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

            {/* Customer Public QR Upload Link */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-slate-700 font-bold text-xs">
                <span>Public Customer Reception Link (For Countertop QR)</span>
                <span className="text-[10px] text-slate-500 font-normal">Customer view</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Walk-in customers scan this link to upload their PDFs and photos without saving phone numbers.
              </p>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                <input
                  type="text"
                  readOnly
                  value={createdPress.customerUrl}
                  className="w-full text-xs font-mono bg-transparent text-slate-700 outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(createdPress.customerUrl, 'customer')}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-md flex items-center gap-1 shrink-0 transition-colors"
                >
                  {copiedCustomer ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCustomer ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              {isAdminRegistering ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleEnterDashboard(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition-colors"
                  >
                    Done & Stay in Super Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEnterDashboard(true)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <span>Inspect Shop as Owner</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEnterDashboard(true)}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <span>Enter My Shop Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Printing Press Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Apex Print Hub"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Owner Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Kwabena Osei"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Owner Email (Login ID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. owner@apexprint.com"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 024 123 4567"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  City / Location <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Kumasi, KNUST"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Street Address / Counter Location
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Stadium Road, Near Total Filling Station"
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

            <div>
              <label className="block font-bold text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="e.g. Commercial printing, thesis binding, architectural plans, brochures..."
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-xl font-bold text-white shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                  isAdminRegistering
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {isSubmitting
                  ? 'Provisioning Press...'
                  : isAdminRegistering
                  ? 'Onboard Printing Press'
                  : 'Register Printing Press'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
