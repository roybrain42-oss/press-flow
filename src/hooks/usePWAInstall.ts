import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isLinux, setIsLinux] = useState(false);

  useEffect(() => {
    // Detect standalone mode (already installed on desktop or mobile)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    // Detect user platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));
    setIsWindows(/win/.test(userAgent));
    setIsMac(/mac/.test(userAgent) && !/iphone|ipad|ipod/.test(userAgent));
    setIsLinux(/linux/.test(userAgent) && !/android/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.error('Failed to trigger PWA prompt:', err);
    }
    return false;
  };

  /**
   * Generates and downloads a Windows .url desktop shortcut directly in the browser
   */
  const downloadWindowsUrlShortcut = (pressSlug?: string, pressName?: string) => {
    const origin = window.location.origin;
    const targetUrl = pressSlug ? `${origin}/?portal=${encodeURIComponent(pressSlug)}` : origin;
    const title = pressName ? `${pressName} - PrintFlow` : 'PrintFlow Manager';
    const content = `[InternetShortcut]\r\nURL=${targetUrl}\r\nIconIndex=0\r\nIconFile=${origin}/favicon.ico\r\nHotKey=0\r\n[{000214A0-0000-0000-C000-000000000046}]\r\nProp3=19,11\r\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Shortcut.url`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  /**
   * Generates and downloads a Windows .bat Standalone Desktop Window launcher
   * Launches Chrome/Edge in borderless app window mode (--app=...)
   */
  const downloadWindowsBatLauncher = (pressSlug?: string, pressName?: string) => {
    const origin = window.location.origin;
    const targetUrl = pressSlug ? `${origin}/?portal=${encodeURIComponent(pressSlug)}` : origin;
    const title = pressName ? `${pressName} PrintFlow` : 'PrintFlow Manager';

    const bat = `@echo off
title Launching ${title} Desktop App...
echo ==========================================================
echo  Starting ${title} in Standalone Window Mode...
echo ==========================================================
set TARGET_URL=${targetUrl}

:: 1. Launch with Google Chrome in standalone app mode
if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%"
    exit /b
)
if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%"
    exit /b
)
if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%"
    exit /b
)

:: 2. Fallback to Microsoft Edge in standalone app mode
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%"
    exit /b
)
if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%"
    exit /b
)

:: 3. Default fallback
start "" "%TARGET_URL%"
exit
`;

    const blob = new Blob([bat], { type: 'application/x-msdos-program;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Launch_${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Desktop.bat`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  /**
   * Generates Linux .desktop launcher
   */
  const downloadLinuxDesktopShortcut = (pressSlug?: string, pressName?: string) => {
    const origin = window.location.origin;
    const targetUrl = pressSlug ? `${origin}/?portal=${encodeURIComponent(pressSlug)}` : origin;
    const title = pressName ? `${pressName} PrintFlow` : 'PrintFlow Manager';

    const content = `[Desktop Entry]
Version=1.0
Type=Application
Name=${title}
Comment=Open PrintFlow Counter Dashboard
Exec=xdg-open "${targetUrl}"
Icon=applications-internet
Terminal=false
Categories=Office;Network;
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.desktop`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  /**
   * Triggers download of the Android APK
   */
  const downloadApk = () => {
    const link = document.createElement('a');
    link.href = '/api/download/apk?v=2.4';
    link.download = 'PrintFlow-Owner-v2.4.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isWindows,
    isMac,
    isLinux,
    install,
    downloadWindowsUrlShortcut,
    downloadWindowsBatLauncher,
    downloadLinuxDesktopShortcut,
    downloadApk,
  };
}
