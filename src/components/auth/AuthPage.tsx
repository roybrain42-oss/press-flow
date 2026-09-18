import React, { useState } from 'react';
import { PrintFlowLogo } from '../common/PrintFlowLogo';
import {
  Printer,
  LogIn,
  Store,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  User,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  QrCode,
  Shield,
  FileCheck,
  Zap,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
  onNavigateToCustomer?: () => void;
  onNavigateToTrack?: () => void;
  onLoginSuccess: (role: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onLoginSuccess,
}) => {
  const { login, register, resetPassword } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialMode);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Reset password state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Registration form state
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('Kumasi');
  const [address, setAddress] = useState('');
  const [operatingHours, setOperatingHours] = useState('Mon–Sat: 8:00 AM – 7:00 PM');
  const [description, setDescription] = useState('');
  const [isRegSubmitting, setIsRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoginSubmitting(true);
    setLoginError(null);
    try {
      const cleanEmail = loginEmail.trim();
      const res = await login(cleanEmail, loginPassword);
      const role = res?.user?.role || (cleanEmail.includes('admin') ? 'super_admin' : 'owner');
      onLoginSuccess(role);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetSubmitting(true);
    setResetStatus(null);
    try {
      const cleanEmail = resetEmail.trim();
      const res = await resetPassword(cleanEmail, resetNewPassword);
      setResetStatus({ type: 'success', message: res.message || 'Password updated successfully!' });
      setLoginEmail(cleanEmail);
      setLoginPassword(resetNewPassword);
      setTimeout(() => {
        setShowResetModal(false);
        setResetStatus(null);
      }, 2000);
    } catch (err: any) {
      setResetStatus({ type: 'error', message: err.message || 'Failed to update password.' });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegSubmitting(true);
    setRegError(null);
    try {
      const cleanEmail = regEmail.trim();
      await register({
        business_name: businessName.trim(),
        owner_name: ownerName.trim(),
        email: cleanEmail,
        password: regPassword,
        phone: phone.trim(),
        location: location.trim(),
        address: address.trim(),
        operating_hours: operatingHours.trim(),
        description: description.trim() || 'Professional commercial digital print and copying services.',
      });
      setLoginEmail(cleanEmail);
      onLoginSuccess('owner');
    } catch (err: any) {
      setRegError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setIsRegSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-8 px-2 sm:px-4 space-y-8">
      {/* Hero Header with Official Brand Logo */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="flex justify-center mb-2">
          <PrintFlowLogo size="xl" variant="full" showSubtitle={true} />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-xs font-bold tracking-wide shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Printing Press Operating Platform</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Commercial Print Queue & Countertop Reception
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          The all-in-one digital counter queue for commercial print shops. Allow walk-in customers to scan, upload, and pay in seconds—with automated pre-flight PDF proofing.
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden max-w-xl mx-auto">
        {/* Dual Tab Switcher */}
        <div className="grid grid-cols-2 p-2 bg-slate-50 border-b border-slate-200 text-xs sm:text-sm font-bold">
          <button
            type="button"
            id="tab-signin-btn"
            onClick={() => {
              setActiveTab('login');
              setLoginError(null);
            }}
            className={`py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'login'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In to Shop</span>
          </button>

          <button
            type="button"
            id="tab-signup-btn"
            onClick={() => {
              setActiveTab('signup');
              setRegError(null);
            }}
            className={`py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'signup'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Register Press (Sign Up)</span>
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {/* TAB 1: SIGN IN */}
          {activeTab === 'login' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sign in to your press dashboard</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your press credentials to manage incoming jobs, counter queues, and pricing.
                </p>
              </div>

              {loginError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Business Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="owner@yourprintingpress.com"
                      className="w-full h-10 pl-10 pr-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs text-slate-800 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(loginEmail);
                        setResetNewPassword('');
                        setResetStatus(null);
                        setShowResetModal(true);
                      }}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs text-slate-800 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 absolute right-3 top-2.5"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoginSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isLoginSubmitting ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Register Callout */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>New printing press?</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signup');
                    setRegError(null);
                  }}
                  className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Register Press</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTER NEW PRESS (SIGN UP) */}
          {activeTab === 'signup' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Register your printing press</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Get your customized shop countertop QR code, digital queue, and order tracking portal in minutes.
                </p>
              </div>

              {regError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {regError}
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Printing Press Name *</label>
                    <div className="relative">
                      <Store className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Apex Digital Prints"
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Owner Full Name *</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="e.g. Kofi Mensah"
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Business Email *</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="owner@apexprints.com"
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Password *</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="p-1 text-slate-400 hover:text-slate-600 absolute right-2 top-2.5"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">WhatsApp / Phone *</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+233 24 123 4567"
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">City / Region *</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <select
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                      >
                        <option value="Kumasi">Kumasi (Ashanti)</option>
                        <option value="Accra">Accra (Greater Accra)</option>
                        <option value="Takoradi">Takoradi (Western)</option>
                        <option value="Tema">Tema</option>
                        <option value="Cape Coast">Cape Coast (Central)</option>
                        <option value="Sunyani">Sunyani (Bono)</option>
                        <option value="Tamale">Tamale (Northern)</option>
                        <option value="Koforidua">Koforidua (Eastern)</option>
                        <option value="Other">Other Location</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shop Address / Landmark</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Near Commercial Area, Campus Tech Junction"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Operating Hours</label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={operatingHours}
                        onChange={(e) => setOperatingHours(e.target.value)}
                        placeholder="Mon–Sat: 8:00 AM – 7:00 PM"
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Services Note (Optional)</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Spiral binding, color laser, plans"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isRegSubmitting}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isRegSubmitting ? (
                      <span>Setting up your press...</span>
                    ) : (
                      <>
                        <span>Register Press & Launch Dashboard</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto pt-4 text-center sm:text-left">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mx-auto sm:mx-0">
            <QrCode className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-xs">Instant QR Countertop</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Customers simply scan your shop QR code to submit PDF & doc files without Bluetooth, cables, or flash drives.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mx-auto sm:mx-0">
            <FileCheck className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-xs">Pre-Flight PDF Proofing</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Inspect customer documents directly on your counter screen with automated page counts and trim guides before printing.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto sm:mx-0">
            <Zap className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-xs">MoMo & Cash Reconciliation</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Collect payments via Paystack Mobile Money or cash at counter, with automatic WhatsApp/SMS status updates.
          </p>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reset Press Credentials</h3>
                  <p className="text-xs text-slate-500">Update your password to access your dashboard</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {resetStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  resetStatus.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}
              >
                {resetStatus.message}
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Registered Email Address</label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="owner@yourprintingpress.com"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">New Password (min. 6 characters)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs text-slate-800"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 transition-colors"
                >
                  {isResetSubmitting ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
