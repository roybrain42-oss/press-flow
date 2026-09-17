import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

/**
 * GET /api/download/apk
 * Serves the Android APK installer file for printing press owners
 */
router.get('/apk', (req: Request, res: Response) => {
  const version = (req.query.v as string) || '2.4';
  const apkFilename = `PrintFlow-Owner-v${version}.apk`;
  const primaryPath = path.join(process.cwd(), 'public', 'downloads', 'PrintFlow-Owner-v2.4.apk');
  const fallbackPath = path.join(process.cwd(), 'public', 'downloads', 'PrintFlow-Owner.apk');

  const fileToSend = fs.existsSync(primaryPath)
    ? primaryPath
    : fs.existsSync(fallbackPath)
    ? fallbackPath
    : null;

  if (!fileToSend) {
    res.status(404).json({ error: 'APK package not found on server' });
    return;
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${apkFilename}"`);
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const fileStream = fs.createReadStream(fileToSend);
  fileStream.pipe(res);
});

/**
 * GET /api/download/desktop-shortcut
 * Generates and downloads a custom Desktop launcher for printing press owners
 * Supports: .url (Windows Internet Shortcut), .bat (Standalone Chrome/Edge App Mode launcher), .desktop (Linux)
 */
router.get('/desktop-shortcut', (req: Request, res: Response) => {
  const slug = (req.query.slug as string) || 'bright-digital-printing';
  const name = (req.query.name as string) || 'PrintFlow Manager';
  const type = ((req.query.type as string) || 'bat').toLowerCase();

  // Determine base host
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const targetUrl = `${protocol}://${host}/?portal=${encodeURIComponent(slug)}`;
  const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (type === 'url') {
    // Windows .url shortcut file
    const content = `[InternetShortcut]\r\nURL=${targetUrl}\r\nIconIndex=0\r\nIconFile=${protocol}://${host}/favicon.ico\r\nHotKey=0\r\n[{000214A0-0000-0000-C000-000000000046}]\r\nProp3=19,11\r\n`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedName}_Desktop_Shortcut.url"`);
    res.send(content);
    return;
  }

  if (type === 'desktop') {
    // Linux .desktop file
    const content = `[Desktop Entry]\nVersion=1.0\nType=Application\nName=${name}\nComment=Launch PrintFlow Manager\nExec=xdg-open "${targetUrl}"\nIcon=applications-internet\nTerminal=false\nCategories=Office;Network;\n`;
    res.setHeader('Content-Type', 'application/x-desktop');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedName}.desktop"`);
    res.send(content);
    return;
  }

  // Default: Windows .bat launcher that boots Chrome or MS Edge in borderless standalone desktop window (--app=...)
  const batContent = `@echo off
title Launching ${name} Desktop...
echo ==========================================================
echo  Starting ${name} Standalone Desktop Mode...
echo ==========================================================
set TARGET_URL=${targetUrl}

:: Check for Google Chrome
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

:: Check for Microsoft Edge
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%"
    exit /b
)
if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%"
    exit /b
)

:: Fallback: Open in default browser
start "" "%TARGET_URL%"
exit
`;

  res.setHeader('Content-Type', 'application/x-msdos-program');
  res.setHeader('Content-Disposition', `attachment; filename="Launch_${sanitizedName}_Desktop.bat"`);
  res.send(batContent);
});

export default router;
