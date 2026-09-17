import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  QrCode,
  Layers,
  ArrowDownToLine,
  Terminal,
  HelpCircle,
  Copy,
  Check,
  Zap,
  HardDrive
} from 'lucide-react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useAuth } from '../../context/AuthContext';

interface DesktopInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesktopInstallModal: React.FC<DesktopInstallModalProps> = ({ isOpen, onClose }) => {
  const { tenant } = useAuth();
  const {
    isInstallable,
    isInstalled,
    isWindows,
    isMac,
    isLinux,
    isAndroid,
    install,
    downloadWindowsUrlShortcut,
    downloadWindowsBatLauncher,
    downloadLinuxDesktopShortcut,
    downloadApk,
  } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<'desktop' | 'apk' | 'kiosk'>('desktop');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [apkQrDataUrl, setApkQrDataUrl] = useState<string>('');

  const pressSlug = tenant?.slug || 'bright-digital-printing';
  const pressName = tenant?.name || 'Printing Press';
  const portalUrl = `${window.location.origin}/?portal=${encodeURIComponent(pressSlug)}`;
  const apkDownloadUrl = `${window.location.origin}/api/download/apk?v=2.4`;

  // Generate QR code for APK download
  useEffect(() => {
    QRCode.toDataURL(apkDownloadUrl, {
      width: 220,
      margin: 2,
      color: {
        dark: '#1e1b4b',
        light: '#ffffff',
      },
    })
      .then(setApkQrDataUrl)
      .catch(console.error);
  }, [apkDownloadUrl]);

  if (!isOpen) return null;

  const handleTriggerPwaInstall = async () => {
    const success = await install();
    if (success) {
      setDownloadSuccess('Desktop application installed successfully!');
      setTimeout(() => setDownloadSuccess(null), 4000);
    }
  };

  const handleDownloadBat = () => {
    downloadWindowsBatLauncher(pressSlug, pressName);
    setDownloadSuccess('Downloaded "Launch PrintFlow Desktop.bat"! Move it to your Desktop and double-click.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadUrl = () => {
    downloadWindowsUrlShortcut(pressSlug, pressName);
    setDownloadSuccess('Downloaded Desktop Shortcut (.url)! Drag it to your Desktop.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadApk = () => {
    downloadApk();
    setDownloadSuccess('Downloading PrintFlow-Owner-v2.4.apk package...');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const copyPortalUrl = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Install Desktop App & Android APK
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  v2.4 Available
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Install PrintFlow onto your shop computer desktop or counter Android tablet for instant daily access.
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 mt-5 bg-black/30 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('desktop')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'desktop'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Desktop Shortcut & App</span>
            </button>
            <button
              onClick={() => setActiveTab('apk')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'apk'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android APK Package</span>
            </button>
            <button
              onClick={() => setActiveTab('kiosk')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'kiosk'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Counter Kiosk Setup</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {downloadSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {/* Tab 1: Desktop Shortcut */}
        {activeTab === 'desktop' && (
          <div className="p-6 space-y-6">
            {/* Primary Action Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Direct Desktop App Installation</span>
                    {isInstalled && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Installed
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Adds a native desktop icon and taskbar shortcut. Launches in a dedicated window without browser bars or distractions.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* 1. Native PWA Install button */}
                {isInstallable ? (
                  <button
                    onClick={handleTriggerPwaInstall}
                    className="p-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all"
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    <span>Install to Desktop (1-Click)</span>
                  </button>
                ) : (
                  <button
                    onClick={handleDownloadBat}
                    className="p-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all"
                    title="Creates a standalone desktop launcher that boots in app window mode"
                  >
                    <Terminal className="w-4 h-4" />
                    <span>Download Windows Launcher (.bat)</span>
                  </button>
                )}

                {/* 2. Download Windows .URL Shortcut */}
                <button
                  onClick={handleDownloadUrl}
                  className="p-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
                >
                  <Download className="w-4 h-4 text-purple-600" />
                  <span>Download Desktop Shortcut (.url)</span>
                </button>
              </div>

              {/* Linux / Mac alternative */}
              {(isMac || isLinux) && (
                <div className="pt-2 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={() => downloadLinuxDesktopShortcut(pressSlug, pressName)}
                    className="text-xs text-slate-600 hover:text-purple-600 font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Linux .desktop launcher</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick 3-Step Setup Guide */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                How to set up your Desktop Shortcut:
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">
                    1
                  </div>
                  <p className="font-bold text-slate-800">Download File</p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Click the <strong>Download Desktop Shortcut</strong> button above to save the file.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">
                    2
                  </div>
                  <p className="font-bold text-slate-800">Move to Desktop</p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Open your <em>Downloads</em> folder and drag the file onto your <strong>Windows Desktop</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">
                    3
                  </div>
                  <p className="font-bold text-slate-800">Double-Click to Run</p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Double-click any morning to open straight into your printing press counter queue!
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Portal Link for Bookmarking */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-indigo-900 block">Or bookmark your direct shop portal URL:</span>
                <span className="text-[11px] font-mono text-indigo-700 break-all">{portalUrl}</span>
              </div>
              <button
                onClick={copyPortalUrl}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Android APK Download */}
        {activeTab === 'apk' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200/80">
              {/* QR Code Container */}
              <div className="shrink-0 text-center bg-white p-3 rounded-xl border border-purple-200 shadow-xs">
                {apkQrDataUrl ? (
                  <img
                    src={apkQrDataUrl}
                    alt="Scan to download APK"
                    className="w-36 h-36 mx-auto rounded-lg"
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center bg-slate-100 text-slate-400">
                    <QrCode className="w-10 h-10" />
                  </div>
                )}
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mt-1.5">
                  Scan from Android Phone
                </span>
              </div>

              {/* APK Details & Download CTA */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-600 text-white">
                    Android APK
                  </span>
                  <span className="text-xs font-bold text-slate-700">Release v2.4.0</span>
                  <span className="text-[10px] text-slate-400 font-mono">20 KB</span>
                </div>

                <h3 className="text-base font-black text-slate-900">
                  PrintFlow Owner Manager App
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Optimized for Android counter tablets and owner phones. Includes full counter queue management, push notifications, customer receipt printing, and QR document scanning.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleDownloadApk}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download APK File (20 KB)</span>
                  </button>
                  <a
                    href="/downloads/PrintFlow-Owner-v2.4.apk"
                    download="PrintFlow-Owner-v2.4.apk"
                    className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <span>Direct Mirror Link</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>
              </div>
            </div>

            {/* Android Installation Instructions */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>How to Install the APK on Android:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 text-[11px] pl-1 leading-relaxed">
                <li>Tap <strong>Download APK File</strong> or scan the QR code above from your Android phone or counter tablet.</li>
                <li>When prompted in Chrome/browser, tap <strong>Download anyway</strong> or <strong>Open</strong>.</li>
                <li>If asked by Android, allow <em>"Install unknown apps"</em> for your browser in Settings.</li>
                <li>Tap <strong>Install</strong> to add the PrintFlow Manager icon to your Android home screen!</li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 3: Countertop Kiosk Mode */}
        {activeTab === 'kiosk' && (
          <div className="p-6 space-y-4 text-xs text-slate-600">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <Zap className="w-4 h-4 text-amber-600" />
                <span>Dedicated Countertop Reception Mode</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Set up a dedicated counter PC or touchscreen monitor at your shop reception desk so incoming print orders pop up with sound alerts automatically.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  Fullscreen Kiosk Mode (F11)
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px]">F11</kbd> on any Windows keyboard to hide all browser chrome and run PrintFlow as a dedicated counter terminal.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  Auto-Start with Windows Startup
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Copy the downloaded <code>Launch PrintFlow Desktop.bat</code> into your Windows Startup folder (<kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px]">Win + R</kbd> &rarr; <code>shell:startup</code>). PrintFlow will boot automatically whenever you turn on your shop computer!
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Thermal Receipt Printer Integration
                </h4>
                <p className="text-slate-500 text-[11px]">
                  PrintFlow receipts are formatted to standard 80mm & 58mm thermal receipt paper (ESC/POS compatible). Just select your thermal USB or Bluetooth printer in the print dialog.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Official PrintFlow Enterprise Distribution • Zero bloatware</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
