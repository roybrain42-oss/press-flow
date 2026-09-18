import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Phone, Mail, CheckCircle2, Lock, Trash2, Eye, EyeOff, Copy, Check, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const StaffManager: React.FC = () => {
  const { role } = useAuth();
  const [staffList, setStaffList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Form
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Newly created credentials notification banner
  const [createdStaffInfo, setCreatedStaffInfo] = useState<{ email: string; name: string; tempPass: string } | null>(null);
  const [copiedInfo, setCopiedInfo] = useState<boolean>(false);

  // Deletion state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const users = await api.getStaff();
      setStaffList(users);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role !== 'staff') {
      fetchStaff();
    }
  }, [role]);

  // If user is staff, show access restricted view
  if (role === 'staff') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto shadow-xs my-8">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Shield className="w-7 h-7" />
        </div>
        <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full uppercase tracking-wider mb-2">
          Staff Operator Role
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Staff Management Restricted</h2>
        <p className="text-xs text-slate-600 leading-relaxed mb-6">
          You are signed in as a Press Operator. Only the printing press owner has authorization to add, remove, or manage staff members.
        </p>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Temporary password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();
      await api.createStaff({ name: cleanName, email: cleanEmail, phone: phone.trim(), password });
      
      setCreatedStaffInfo({
        email: cleanEmail,
        name: cleanName,
        tempPass: password,
      });

      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      fetchStaff();
    } catch (err: any) {
      setError(err.message || 'Failed to add staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async (member: User) => {
    if (member.role === 'owner') return;
    const confirmed = window.confirm(`Are you sure you want to remove staff member "${member.name}" (${member.email})? They will no longer be able to sign in.`);
    if (!confirmed) return;

    setDeletingId(member.id);
    try {
      await api.deleteStaff(member.id);
      fetchStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to remove staff member.');
    } finally {
      setDeletingId(null);
    }
  };

  const copyCredentials = () => {
    if (!createdStaffInfo) return;
    const text = `PrintFlow Staff Login Credentials:\nPress Portal: ${window.location.origin}/?view=auth\nEmail: ${createdStaffInfo.email}\nTemporary Password: ${createdStaffInfo.tempPass}\n\nPlease sign in and start processing queue jobs.`;
    navigator.clipboard.writeText(text);
    setCopiedInfo(true);
    setTimeout(() => setCopiedInfo(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Newly created staff banner */}
      {createdStaffInfo && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-950">
                Staff Account Created: {createdStaffInfo.name}
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Login email: <span className="font-semibold font-mono">{createdStaffInfo.email}</span> &bull; Temp password: <span className="font-semibold font-mono">{createdStaffInfo.tempPass}</span>
              </p>
              <p className="text-[11px] text-emerald-700 mt-1">
                Your staff member can now immediately sign in at the Sign In page.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyCredentials}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              {copiedInfo ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedInfo ? 'Copied to Clipboard!' : 'Copy Login Details'}</span>
            </button>
            <button
              onClick={() => setCreatedStaffInfo(null)}
              className="px-2.5 py-1.5 rounded-xl text-emerald-700 hover:bg-emerald-100 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Staff & Operator Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authorize team members to process incoming print jobs and download files without giving them access to your system settings or staff controls.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Authorized Press Team</h2>
          <span className="text-xs font-semibold text-slate-500">{staffList.length} members</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading team...</div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {staffList.map((member) => (
              <div key={member.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      member.role === 'owner'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{member.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          member.role === 'owner'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {member.role === 'owner' ? 'Owner / Admin' : 'Press Operator'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {member.email}
                      </span>
                      {member.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {member.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active
                  </span>

                  {member.role !== 'owner' && (
                    <button
                      onClick={() => handleDeleteStaff(member)}
                      disabled={deletingId === member.id}
                      title="Remove staff member"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Add Press Operator Staff</h2>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                Staff Role
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Staff members can sign in with their own email and password to process jobs and download print files. They cannot access system settings or add other staff.
            </p>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Abena Serwaa"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email (Sign In ID) *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. abena@press.com"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 055 123 4567"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Temporary Password (Min 6 chars) *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold shadow-xs transition-opacity flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>Creating Account...</span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Staff Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
