import React, { useState, useEffect } from 'react';
import {
  Printer,
  DollarSign,
  QrCode,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { PressPublicPage } from './components/customer/PressPublicPage';
import { CustomerUploadWizard } from './components/customer/CustomerUploadWizard';
import { CustomerJobTracking } from './components/customer/CustomerJobTracking';
import { TrackJobLookup } from './components/customer/TrackJobLookup';
import { TenantDashboard } from './components/dashboard/TenantDashboard';
import { ServicesPricingManager } from './components/dashboard/ServicesPricingManager';
import { QRCodeStudio } from './components/dashboard/QRCodeStudio';
import { StaffManager } from './components/dashboard/StaffManager';
import { TenantAnalytics } from './components/dashboard/TenantAnalytics';
import { TenantSettings } from './components/dashboard/TenantSettings';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { RegisterPressModal } from './components/modals/RegisterPressModal';
import { LoginModal } from './components/modals/LoginModal';
import { AuthPage } from './components/auth/AuthPage';
import { PrintFlowIcon } from './components/common/PrintFlowLogo';

function MainLayout() {
  const { user, tenant, role, selectedPressSlug, setSelectedPressSlug, switchRole, loginWithSession, refreshMe } = useAuth();

  // Navigation state - Login / Sign Up page is the default home page
  const [currentView, setCurrentView] = useState<string>('auth'); // 'auth' | 'customer' | 'track' | 'dashboard' | 'admin'
  const [customerSubView, setCustomerSubView] = useState<'profile' | 'upload' | 'tracking'>('profile');
  const [trackJobNumber, setTrackJobNumber] = useState<string>('');
  const [trackToken, setTrackToken] = useState<string>('');

  // Dashboard Tab state
  const [dashboardTab, setDashboardTab] = useState<string>('jobs'); // 'jobs' | 'pricing' | 'qr' | 'staff' | 'analytics' | 'settings'

  // Admin Tab state
  const [adminTab, setAdminTab] = useState<string>('stats'); // 'stats' | 'presses' | 'subscriptions' | 'audit'

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isPortalMode, setIsPortalMode] = useState<boolean>(false);

  // Check URL path and query params on mount for direct customer QR scan link, tracking link, or portal routing
  useEffect(() => {
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    // Extract potential path-based routing (e.g. /p/:slug, /upload/:slug, /press/:slug, /track/:job, /portal/:slug)
    let pathPressSlug: string | null = null;
    let pathTrackJob: string | null = null;
    let isPathAdmin = false;
    let isPathPortal: string | null = null;

    if (pathname.startsWith('/p/')) {
      pathPressSlug = pathname.replace(/^\/p\//, '').split('/')[0] || null;
    } else if (pathname.startsWith('/upload/')) {
      pathPressSlug = pathname.replace(/^\/upload\//, '').split('/')[0] || null;
    } else if (pathname.startsWith('/press/')) {
      pathPressSlug = pathname.replace(/^\/press\//, '').split('/')[0] || null;
    } else if (pathname.startsWith('/track/')) {
      pathTrackJob = pathname.replace(/^\/track\//, '').split('/')[0] || null;
    } else if (pathname.startsWith('/portal/')) {
      isPathPortal = pathname.replace(/^\/portal\//, '').split('/')[0] || null;
    } else if (pathname === '/admin') {
      isPathAdmin = true;
    }

    const portalParam = params.get('portal') || isPathPortal;
    const pressParam = params.get('press') || pathPressSlug;
    const trackParam = params.get('track') || pathTrackJob;
    const tokenParam = params.get('token');
    const viewParam = params.get('view');
    const adminParam = params.get('admin');

    if (adminParam === 'true' || viewParam === 'admin' || portalParam === 'admin' || isPathAdmin) {
      setIsPortalMode(false);
      if (role === 'super_admin') {
        setCurrentView('admin');
        setAdminTab('stats');
      } else {
        setCurrentView('auth');
      }
    } else if (portalParam) {
      setIsPortalMode(true);
      setSelectedPressSlug(portalParam);
      if (user && (role === 'owner' || role === 'staff')) {
        setCurrentView('dashboard');
        setDashboardTab('jobs');
      } else {
        setCurrentView('auth');
      }
    } else if (pressParam && viewParam === 'dashboard') {
      setIsPortalMode(true);
      setSelectedPressSlug(pressParam);
      if (user && (role === 'owner' || role === 'staff')) {
        setCurrentView('dashboard');
        setDashboardTab('jobs');
      } else {
        setCurrentView('auth');
      }
    } else if (trackParam) {
      setTrackJobNumber(trackParam);
      if (tokenParam) setTrackToken(tokenParam);
      setCurrentView('customer');
      setCustomerSubView('tracking');
    } else if (pressParam) {
      // CUSTOMER QR CODE SCAN / DIRECT SHOP LINK:
      // Instantly allow customer to upload a document WITHOUT requiring registration or login!
      setSelectedPressSlug(pressParam);
      setCurrentView('customer');
      if (viewParam === 'profile') {
        setCustomerSubView('profile');
      } else {
        // Default to instant document upload wizard
        setCustomerSubView('upload');
      }
    } else if (viewParam === 'dashboard') {
      if (user) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('auth');
      }
    } else if (viewParam === 'customer' || viewParam === 'upload') {
      setCurrentView('customer');
      setCustomerSubView('upload');
    } else if (viewParam === 'track') {
      setCurrentView('track');
    } else {
      // Default: If user is authenticated, route to their authorized workspace
      const existingToken = localStorage.getItem('printflow_token');
      if (existingToken && user) {
        if (role === 'super_admin') {
          setCurrentView('admin');
        } else {
          setCurrentView('dashboard');
        }
      } else {
        setCurrentView('auth');
      }
    }
  }, [setSelectedPressSlug, user, role]);

  // Strict Access Guard: If user is not super_admin and tries to view admin panel, force back
  useEffect(() => {
    if (currentView === 'admin' && role !== 'super_admin') {
      setCurrentView(user ? 'dashboard' : 'auth');
    }
  }, [currentView, role, user]);

  // RBAC Guard: Staff cannot access Staff, Settings, or Analytics tabs
  useEffect(() => {
    if (role === 'staff' && (dashboardTab === 'staff' || dashboardTab === 'settings' || dashboardTab === 'analytics')) {
      setDashboardTab('jobs');
    }
  }, [role, dashboardTab]);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Single Navigation Bar */}
      <Navbar
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view);
          if (view === 'customer') setCustomerSubView('upload');
        }}
        dashboardTab={dashboardTab}
        setDashboardTab={setDashboardTab}
        adminTab={adminTab}
        setAdminTab={setAdminTab}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        isPortalMode={isPortalMode}
        onExitPortal={() => {
          setIsPortalMode(false);
          setCurrentView('customer');
          setCustomerSubView('upload');
        }}
      />

      {/* 3. Dynamic Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* VIEW 0: HOME PAGE - LOGIN & REGISTRATION */}
        {currentView === 'auth' && (
          <AuthPage
            initialMode="login"
            onLoginSuccess={(loggedRole) => {
              if (loggedRole === 'super_admin') {
                setCurrentView('admin');
                setAdminTab('stats');
              } else {
                setCurrentView('dashboard');
                setDashboardTab('jobs');
              }
            }}
          />
        )}

        {/* VIEW A: CUSTOMER WORKFLOW (Mobile-first QR Flow) */}
        {currentView === 'customer' && (
          <div>
            {customerSubView === 'profile' && (
              <PressPublicPage
                slug={selectedPressSlug}
                onStartUpload={() => setCustomerSubView('upload')}
                onTrackOrder={() => setCurrentView('track')}
              />
            )}

            {customerSubView === 'upload' && (
              <CustomerUploadWizard
                slug={selectedPressSlug}
                onSuccess={(job) => {
                  setTrackJobNumber(job.job_number);
                  setTrackToken(job.tracking_token);
                  setCustomerSubView('tracking');
                }}
                onCancel={() => setCustomerSubView('profile')}
              />
            )}

            {customerSubView === 'tracking' && (
              <CustomerJobTracking
                jobNumber={trackJobNumber}
                token={trackToken}
                onBackToShop={() => setCustomerSubView('profile')}
              />
            )}
          </div>
        )}

        {/* VIEW B: ORDER LOOKUP SCREEN */}
        {currentView === 'track' && (
          <TrackJobLookup
            onFoundJob={(jobNum, tok) => {
              setTrackJobNumber(jobNum);
              setTrackToken(tok);
              setCurrentView('customer');
              setCustomerSubView('tracking');
            }}
            onBackToShop={() => setCurrentView('customer')}
          />
        )}

        {/* VIEW C: PRINTING PRESS OWNER / STAFF PORTAL */}
        {currentView === 'dashboard' && (
          <div>
            {!user || (role !== 'owner' && role !== 'staff') ? (
              <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold">PF</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  Printing Press Portal Access
                </h2>
                <p className="text-xs text-slate-500 mb-6">
                  Please log in as a registered shop owner or operator staff member to manage your counter queue.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      await switchRole('owner', selectedPressSlug);
                      setCurrentView('dashboard');
                    }}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    Quick-Login as Press Owner (Kwame)
                  </button>
                  <button
                    onClick={() => setCurrentView('auth')}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    Go to Login / Sign Up Page
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Shop Portal Navigation Bar */}
                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto">
                  <button
                    onClick={() => setDashboardTab('jobs')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                      dashboardTab === 'jobs'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    <span>Jobs & Queue</span>
                  </button>
                  <button
                    onClick={() => setDashboardTab('pricing')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                      dashboardTab === 'pricing'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Services & Pricing</span>
                  </button>
                  <button
                    onClick={() => setDashboardTab('qr')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                      dashboardTab === 'qr'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QR Countertop</span>
                  </button>
                  {/* Owner & Super Admin only tabs: Staff, Analytics, Settings */}
                  {role !== 'staff' && (
                    <>
                      <button
                        onClick={() => setDashboardTab('staff')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                          dashboardTab === 'staff'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        <span>Staff</span>
                      </button>
                      <button
                        onClick={() => setDashboardTab('analytics')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                          dashboardTab === 'analytics'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Analytics</span>
                      </button>
                      <button
                        onClick={() => setDashboardTab('settings')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                          dashboardTab === 'settings'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Settings className="w-4 h-4" />
                        <span>Settings</span>
                      </button>
                    </>
                  )}
                </div>

                <div>
                  {dashboardTab === 'jobs' && <TenantDashboard onSwitchTab={(tab: string) => setDashboardTab(tab as any)} />}
                  {dashboardTab === 'pricing' && <ServicesPricingManager />}
                  {dashboardTab === 'qr' && <QRCodeStudio />}
                  {dashboardTab === 'staff' && (
                    role === 'staff' ? (
                      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto shadow-xs my-8">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
                          <Users className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">Owner Access Only</h3>
                        <p className="text-xs text-slate-500 mb-6">
                          Staff management and creating new staff members is restricted to the printing press owner.
                        </p>
                        <button
                          onClick={() => setDashboardTab('jobs')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                        >
                          Return to Print Queue
                        </button>
                      </div>
                    ) : (
                      <StaffManager />
                    )
                  )}
                  {dashboardTab === 'analytics' && <TenantAnalytics />}
                  {dashboardTab === 'settings' && (
                    role === 'staff' ? (
                      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto shadow-xs my-8">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
                          <Settings className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">Owner Access Only</h3>
                        <p className="text-xs text-slate-500 mb-6">
                          System settings, payment options, and shop preferences can only be modified by the printing press owner.
                        </p>
                        <button
                          onClick={() => setDashboardTab('jobs')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                        >
                          Return to Print Queue
                        </button>
                      </div>
                    ) : (
                      <TenantSettings />
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW D: SUPER ADMIN PLATFORM CONTROL */}
        {currentView === 'admin' && (
          <div>
            {role !== 'super_admin' ? (
              <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-xs">
                <h2 className="text-lg font-bold text-slate-900 mb-1">Super Admin Clearance Required</h2>
                <p className="text-xs text-slate-500 mb-6">
                  Platform administration is strictly reserved for authorized platform operators. Your shop operations are managed from your private shop dashboard.
                </p>
                <button
                  onClick={() => {
                    setCurrentView('dashboard');
                  }}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Return to My Shop Dashboard
                </button>
              </div>
            ) : (
              <SuperAdminDashboard
                activeTab={adminTab}
                setActiveTab={setAdminTab}
                onSwitchToPressOwner={async (slug) => {
                  setSelectedPressSlug(slug);
                  setIsPortalMode(true);
                  await switchRole('owner', slug);
                  setCurrentView('dashboard');
                  setDashboardTab('jobs');
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* 4. Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-white border border-slate-200 p-0.5 flex items-center justify-center shadow-2xs">
              <PrintFlowIcon className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-slate-900 tracking-tight">PrintFlow SaaS</span>
            <span>—</span>
            <span>Digital QR Reception for Printing Presses</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Strict Tenant Isolation</span>
            <span>•</span>
            <span>Encrypted Transmission</span>
            <span>•</span>
            <span>Paystack Mobile Money</span>
          </div>
        </div>
      </footer>

      {/* 5. Modals */}
      <RegisterPressModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegistered={async (slug, token, newUser, switchImmediately, newTenant) => {
          setSelectedPressSlug(slug);
          setIsPortalMode(true);
          if (token && newUser && newTenant) {
            loginWithSession(token, newUser, newTenant);
          } else if (token) {
            localStorage.setItem('printflow_token', token);
            await refreshMe();
          } else if (user?.role === 'super_admin') {
            await switchRole('owner', slug);
          }
          setCurrentView('dashboard');
          setDashboardTab('jobs');
        }}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          setCurrentView('dashboard');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
