import React, { useState, useEffect } from 'react';
import { QrCode, Download, Printer, Copy, Check, ExternalLink, Sparkles, RefreshCw, Building2, Link2, ShieldOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export const QRCodeStudio: React.FC = () => {
  const { tenant } = useAuth();
  const [qrData, setQrData] = useState<{ publicUrl: string; dataUrl: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedDashboard, setCopiedDashboard] = useState<boolean>(false);
  const [standStyle, setStandStyle] = useState<'modern' | 'minimal' | 'classic'>('modern');

  const directDashboardUrl = `${window.location.origin}/?portal=${tenant?.slug || 'bright-digital-printing'}`;

  useEffect(() => {
    if (tenant?.slug) {
      api.getPressQR(tenant.slug).then(setQrData).catch(console.error);
    }
  }, [tenant?.slug]);

  const handleCopyLink = () => {
    if (!qrData?.publicUrl) return;
    navigator.clipboard.writeText(qrData.publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyDashboard = () => {
    navigator.clipboard.writeText(directDashboardUrl);
    setCopiedDashboard(true);
    setTimeout(() => setCopiedDashboard(false), 2500);
  };

  const handlePrintStand = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Countertop QR Code Studio
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Display this QR code at your front desk, counter, and entrance so walk-in customers can print without WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied!' : 'Copy Direct Link'}</span>
          </button>

          <button
            onClick={handlePrintStand}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Countertop Sign</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: The Print-Ready Table Tent Card */}
        <div className="lg:col-span-2">
          <div
            id="printable-counter-stand"
            className="bg-white rounded-3xl border-2 border-slate-200 shadow-lg p-8 sm:p-12 text-center relative overflow-hidden"
          >
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-orange-500" />

            {/* Shop Brand Heading */}
            <div className="mb-6">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                Digital Print Station
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {tenant?.name || 'Bright Digital Printing'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                {tenant?.location} • {tenant?.address || 'Front Desk Counter'}
              </p>
            </div>

            {/* Main Call to Action Headline */}
            <div className="my-6">
              <p className="text-lg sm:text-2xl font-extrabold text-blue-700 uppercase tracking-wide">
                Scan to Print Instantly
              </p>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mt-1">
                Skip the WhatsApp queue! Upload your document directly from your phone in 30 seconds.
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Instant Walk-In: No Registration or Login Required</span>
              </div>
            </div>

            {/* High-Resolution QR Code Frame */}
            <div className="inline-block p-5 sm:p-7 bg-white rounded-3xl border-4 border-slate-900 shadow-md my-4">
              {qrData?.dataUrl ? (
                <img
                  src={qrData.dataUrl}
                  alt="PrintFlow Shop QR Code"
                  className="w-52 h-52 sm:w-64 sm:h-64 object-contain mx-auto"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            {/* 3 Step Visual Guide */}
            <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mt-6 pt-6 border-t border-slate-200 text-left">
              <div className="p-2.5 rounded-xl bg-slate-50">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-1.5">
                  1
                </span>
                <p className="text-xs font-bold text-slate-900">Scan QR Code</p>
                <p className="text-[10px] text-slate-500">Open phone camera and point at code</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-1.5">
                  2
                </span>
                <p className="text-xs font-bold text-slate-900">Choose Options</p>
                <p className="text-[10px] text-slate-500">Upload PDF, select copies & colour</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-1.5">
                  3
                </span>
                <p className="text-xs font-bold text-slate-900">Collect Print</p>
                <p className="text-[10px] text-slate-500">Show your Job # right at the counter</p>
              </div>
            </div>

            {/* Footer Direct URL */}
            <div className="mt-8 pt-4 text-center text-xs text-slate-400">
              <span>Or visit in your mobile browser: </span>
              <strong className="text-slate-800 font-mono underline">{qrData?.publicUrl}</strong>
            </div>
          </div>
        </div>

        {/* Right Col: Customization & Formats */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Export & Download Options</h3>

            {qrData?.dataUrl && (
              <div className="space-y-2">
                <a
                  href={qrData.dataUrl}
                  download={`${tenant?.slug || 'printflow'}-counter-qr.png`}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download High-Res PNG (1000px)</span>
                </a>

                <button
                  onClick={handlePrintStand}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span>Print Table Tent / Counter Poster</span>
                </button>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 space-y-1.5">
              <strong className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Permanent Multi-Tenant QR
              </strong>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                This QR code is permanently bound to your business slug. You can laminate and display it permanently on your acrylic stands and counter displays.
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Your Business URL</h3>
            <p className="text-slate-500">Direct link for your customers or social media bio:</p>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 break-all select-all">
              {qrData?.publicUrl}
            </div>
          </div>

          {/* Private Dashboard Link for Owner & Operators */}
          <div className="bg-blue-50/80 p-5 rounded-2xl border border-blue-200 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Private Dashboard Link</span>
              </h3>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                <ShieldOff className="w-3 h-3" />
                No Super Admin
              </span>
            </div>
            <p className="text-slate-600 text-[11px]">
              Bookmark this link to open directly to your counter jobs queue without any platform Super Admin panel.
            </p>
            <div className="p-2 bg-white rounded-xl border border-blue-200 font-mono text-[11px] text-slate-700 break-all select-all">
              {directDashboardUrl}
            </div>
            <button
              onClick={handleCopyDashboard}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedDashboard ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Dashboard Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Private Dashboard Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
