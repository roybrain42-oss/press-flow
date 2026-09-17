import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PrintFlowIcon } from './common/PrintFlowLogo';
import {
  Printer,
  FileText,
  DollarSign,
  QrCode,
  Users,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  LogIn,
  Search,
  Plus,
  Menu,
  X,
  ShieldOff,
  ExternalLink,
} from 'lucide-react';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  dashboardTab: string;
  setDashboardTab: (tab: string) => void;
  adminTab: string;
  setAdminTab: (tab: string) => void;
  onOpenLoginModal?: () => void;
  isPortalMode?: boolean;
  onExitPortal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  dashboardTab,
  setDashboardTab,
  adminTab,
  setAdminTab,
  isPortalMode = false,
  onExitPortal,
}) => {
  const { user, tenant, role, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (role === 'super_admin') setCurrentView('admin');
                else if (role === 'owner' || role === 'staff') setCurrentView('dashboard');
                else setCurrentView('auth');
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-white p-1 border border-slate-200/80 flex items-center justify-center shadow-xs group-hover:border-blue-300 transition-all">
                <PrintFlowIcon className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900">
                    Print<span className="text-blue-600">Flow</span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    SaaS
                  </span>
                  {isPortalMode && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Shop Portal
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  Digital QR Document Reception for Printing Presses
                </p>
              </div>
            </button>
          </div>

          {/* Center Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {/* Auth / Home Mode Links */}
            {currentView === 'auth' && (
              <button
                onClick={() => setCurrentView('auth')}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-blue-50 text-blue-700 transition-colors"
              >
                Sign In / Register
              </button>
            )}

            {/* Customer Mode Links */}
            {(currentView === 'customer' || currentView === 'track') && (
              <>
                <button
                  onClick={() => setCurrentView('customer')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    currentView === 'customer'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  Document Upload
                </button>
                <button
                  onClick={() => setCurrentView('track')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    currentView === 'track'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  Track Order
                </button>
                {user && (role === 'owner' || role === 'staff') && (
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors ml-2"
                  >
                    Back to Dashboard
                  </button>
                )}
              </>
            )}

            {/* Tenant Dashboard Links (Owner or Staff) */}
            {currentView === 'dashboard' && (
              <>
                <button
                  onClick={() => setDashboardTab('jobs')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    dashboardTab === 'jobs'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Print Jobs
                </button>
                <button
                  onClick={() => setDashboardTab('pricing')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    dashboardTab === 'pricing'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  Services & Pricing
                </button>
                <button
                  onClick={() => setDashboardTab('qr')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    dashboardTab === 'qr'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  QR Countertop
                </button>

                {role === 'owner' && (
                  <>
                    <button
                      onClick={() => setDashboardTab('staff')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                        dashboardTab === 'staff'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Staff
                    </button>
                    <button
                      onClick={() => setDashboardTab('analytics')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                        dashboardTab === 'analytics'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      Analytics
                    </button>
                    <button
                      onClick={() => setDashboardTab('settings')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                        dashboardTab === 'settings'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                  </>
                )}

                {/* Quick Customer QR View button for shop operators */}
                <button
                  onClick={() => setCurrentView('customer')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1.5 ml-1"
                  title="View customer upload page"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Customer View</span>
                </button>
              </>
            )}

            {/* Super Admin Links */}
            {currentView === 'admin' && (
              <>
                <button
                  onClick={() => setAdminTab('stats')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    adminTab === 'stats'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Overview
                </button>
                <button
                  onClick={() => setAdminTab('presses')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    adminTab === 'presses'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Printing Presses
                </button>
                <button
                  onClick={() => setAdminTab('register')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    adminTab === 'register'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-purple-700 bg-purple-50 hover:bg-purple-100 font-semibold'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Register Press
                </button>
                <button
                  onClick={() => setAdminTab('subscriptions')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    adminTab === 'subscriptions'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Subscriptions
                </button>
                <button
                  onClick={() => setAdminTab('audit')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    adminTab === 'audit'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Audit Logs
                </button>
              </>
            )}
          </nav>

          {/* Right Side: User Profile & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Super Admin switcher button if logged in as super admin but on other views */}
            {role === 'super_admin' && currentView !== 'admin' && (
              <button
                onClick={() => setCurrentView('admin')}
                className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                title="Open Super Admin Dashboard"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Super Admin</span>
              </button>
            )}

            {/* Exit dedicated portal mode if active */}
            {isPortalMode && onExitPortal && (
              <button
                onClick={onExitPortal}
                className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
                title="Exit shop portal view"
              >
                Exit Portal
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 flex items-center justify-end gap-1">
                    <span>{user.name}</span>
                    {role === 'owner' && (
                      <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Owner
                      </span>
                    )}
                    {role === 'staff' && (
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Staff
                      </span>
                    )}
                    {role === 'super_admin' && (
                      <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                    {tenant?.name || user.email}
                  </div>
                </div>

                <button
                  onClick={() => {
                    logout();
                    setCurrentView('auth');
                    setMobileMenuOpen(false);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Log out and return to Home"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setCurrentView('auth');
                  setMobileMenuOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Register</span>
              </button>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 shadow-lg space-y-1">
          {/* Auth / Home View Links */}
          {currentView === 'auth' && (
            <button
              onClick={() => handleNavClick(() => setCurrentView('auth'))}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold bg-blue-50 text-blue-700"
            >
              Sign In / Register
            </button>
          )}

          {/* Customer / Track Links */}
          {(currentView === 'customer' || currentView === 'track') && (
            <>
              <button
                onClick={() => handleNavClick(() => setCurrentView('customer'))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  currentView === 'customer' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                Customer Document Upload
              </button>
              <button
                onClick={() => handleNavClick(() => setCurrentView('track'))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  currentView === 'track' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Search className="w-4 h-4" />
                Track Order
              </button>
              {user && (role === 'owner' || role === 'staff') && (
                <button
                  onClick={() => handleNavClick(() => setCurrentView('dashboard'))}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-blue-600 hover:bg-blue-50"
                >
                  Back to Shop Dashboard
                </button>
              )}
            </>
          )}

          {/* Dashboard View Tabs */}
          {currentView === 'dashboard' && (
            <>
              <button
                onClick={() => handleNavClick(() => setDashboardTab('jobs'))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  dashboardTab === 'jobs' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Print Jobs
              </button>
              <button
                onClick={() => handleNavClick(() => setDashboardTab('pricing'))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  dashboardTab === 'pricing' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Services & Pricing
              </button>
              <button
                onClick={() => handleNavClick(() => setDashboardTab('qr'))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  dashboardTab === 'qr' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-4 h-4" />
                QR Countertop
              </button>

              {role === 'owner' && (
                <>
                  <button
                    onClick={() => handleNavClick(() => setDashboardTab('staff'))}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                      dashboardTab === 'staff' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Staff Members
                  </button>
                  <button
                    onClick={() => handleNavClick(() => setDashboardTab('analytics'))}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                      dashboardTab === 'analytics' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Analytics & Revenue
                  </button>
                  <button
                    onClick={() => handleNavClick(() => setDashboardTab('settings'))}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                      dashboardTab === 'settings' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Shop Settings
                  </button>
                </>
              )}

              <button
                onClick={() => handleNavClick(() => setCurrentView('customer'))}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-2 mt-2"
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                Preview Customer QR Page
              </button>
            </>
          )}

          {/* Admin Tabs */}
          {currentView === 'admin' && (
            <>
              <button
                onClick={() => handleNavClick(() => setAdminTab('stats'))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  adminTab === 'stats' ? 'bg-purple-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Shield className="w-4 h-4" />
                Platform Overview
              </button>
              <button
                onClick={() => handleNavClick(() => setAdminTab('presses'))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  adminTab === 'presses' ? 'bg-purple-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                Printing Presses
              </button>
              <button
                onClick={() => handleNavClick(() => setAdminTab('register'))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  adminTab === 'register' ? 'bg-purple-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Plus className="w-4 h-4" />
                Register New Press
              </button>
              <button
                onClick={() => handleNavClick(() => setAdminTab('subscriptions'))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  adminTab === 'subscriptions' ? 'bg-purple-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                Subscriptions
              </button>
              <button
                onClick={() => handleNavClick(() => setAdminTab('audit'))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  adminTab === 'audit' ? 'bg-purple-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                Audit Logs
              </button>
            </>
          )}

          {user && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>Signed in as <span className="font-semibold text-slate-800">{user.name}</span> ({role})</div>
              <button
                onClick={() => {
                  logout();
                  setCurrentView('auth');
                  setMobileMenuOpen(false);
                }}
                className="text-rose-600 font-semibold flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                Log out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
