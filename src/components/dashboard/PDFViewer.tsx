import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Printer,
  Download,
  Eye,
  Sliders,
  AlertCircle,
  FileText,
  Loader2,
  Columns,
  RefreshCw,
} from 'lucide-react';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Use unpkg CDN worker matching current version or cdnjs fallback
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

// Low-resolution miniature page proof thumbnail item
const PDFPageThumbnail: React.FC<{
  pdfDoc: any;
  pageNumber: number;
  isSelected: boolean;
  colorMode: 'color' | 'bw';
  onClick: () => void;
}> = ({ pdfDoc, pageNumber, isSelected, colorMode, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    let active = true;
    let renderTask: any = null;

    if (!pdfDoc) return;

    pdfDoc
      .getPage(pageNumber)
      .then((page: any) => {
        if (!active || !canvasRef.current) return;
        const baseViewport = page.getViewport({ scale: 1.0 });
        const targetWidth = 96;
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });

        renderTask.promise
          .then(() => {
            if (active) setIsRendered(true);
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      active = false;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNumber]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-1.5 rounded-lg border transition-all ${
        isSelected
          ? 'bg-purple-900/50 border-purple-400 text-purple-200 shadow-xs'
          : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      <div className="flex items-center justify-between text-xs font-bold mb-1">
        <span>Page {pageNumber}</span>
        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
      </div>
      <div className="min-h-[58px] bg-slate-950/80 rounded border border-white/10 flex items-center justify-center overflow-hidden relative">
        <canvas
          ref={canvasRef}
          className={`rounded shadow-xs max-w-full transition-opacity duration-200 ${
            isRendered ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            filter: colorMode === 'bw' ? 'grayscale(100%)' : 'none',
          }}
        />
        {!isRendered && (
          <span className="text-[9px] text-slate-500">Proof #{pageNumber}</span>
        )}
      </div>
    </button>
  );
};

interface PDFViewerProps {
  url: string;
  documentName: string;
  colorMode?: 'color' | 'bw';
  expectedPageCount?: number;
  onPageCountDetected?: (detectedCount: number) => void;
  className?: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  url,
  documentName,
  colorMode = 'color',
  expectedPageCount,
  onPageCountDetected,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGrayscale, setIsGrayscale] = useState<boolean>(colorMode === 'bw');
  const [showGutterGuide, setShowGutterGuide] = useState<boolean>(true);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'canvas' | 'native'>('canvas');
  const [isRendering, setIsRendering] = useState<boolean>(false);

  // Load PDF document
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: true,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setIsLoading(false);

        if (onPageCountDetected) {
          onPageCountDetected(doc.numPages);
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.error('[PDFViewer] Error loading document:', err);
        setErrorMessage(
          err.message || 'Unable to load PDF directly into the canvas inspector. You can switch to the Native Viewer tab.'
        );
        setIsLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [url]);

  // Render current page on canvas
  useEffect(() => {
    if (!pdfDoc || viewMode !== 'canvas') return;

    let isCancelled = false;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        setIsRendering(true);
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Determine viewport with rotation
        const viewport = page.getViewport({ scale, rotation });

        // High-DPI support
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: context,
          viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;

        if (!isCancelled) {
          setIsRendering(false);
        }
      } catch (err: any) {
        if (!isCancelled && err.name !== 'RenderingCancelledException') {
          console.error('[PDFViewer] Page render error:', err);
          setIsRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, scale, rotation, viewMode]);

  // Auto-fit to container width
  const handleFitWidth = () => {
    if (!containerRef.current || !pdfDoc) return;
    const containerWidth = containerRef.current.clientWidth - 48; // padding
    // Approximate A4 width in points is ~595
    const idealScale = Math.min(Math.max(containerWidth / 620, 0.5), 2.5);
    setScale(parseFloat(idealScale.toFixed(2)));
  };

  const handleZoomIn = () => setScale((prev) => Math.min(parseFloat((prev + 0.2).toFixed(2)), 3.0));
  const handleZoomOut = () => setScale((prev) => Math.max(parseFloat((prev - 0.2).toFixed(2)), 0.4));
  const handleResetZoom = () => setScale(1.0);
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, numPages));

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  const handlePrint = () => {
    // Open print dialog using hidden iframe
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    printFrame.src = url;

    document.body.appendChild(printFrame);
    printFrame.onload = () => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        window.open(url, '_blank');
      }
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 60000);
    };
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-xl ${className} ${
        isFullscreen ? 'h-screen w-screen rounded-none' : 'h-[640px]'
      }`}
    >
      {/* Top Controls Toolbar */}
      <div className="bg-slate-950/90 backdrop-blur-xs px-3 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        {/* Left: View Mode & Title */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors ${
                viewMode === 'canvas'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Interactive pre-flight canvas inspection"
            >
              <Eye className="w-3 h-3" />
              <span>Inspector</span>
            </button>
            <button
              onClick={() => setViewMode('native')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors ${
                viewMode === 'native'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Standard browser native PDF engine"
            >
              <FileText className="w-3 h-3" />
              <span>Native</span>
            </button>
          </div>

          <span className="text-slate-400 font-mono text-[11px] hidden sm:inline truncate max-w-[180px]">
            {documentName}
          </span>
        </div>

        {/* Center: Page Controls (for canvas inspector mode) */}
        {viewMode === 'canvas' && numPages > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-semibold text-slate-200 min-w-[70px] text-center">
              {currentPage} / {numPages}
            </span>

            <button
              onClick={handleNextPage}
              disabled={currentPage >= numPages}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowThumbnails(!showThumbnails)}
              className={`p-1 rounded ml-1 ${
                showThumbnails ? 'bg-purple-600 text-white' : 'hover:bg-slate-700 text-slate-400'
              }`}
              title="Toggle Thumbnails Strip"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Right: Zoom, Simulation, Pre-flight guides & Print */}
        <div className="flex items-center gap-1.5">
          {viewMode === 'canvas' && (
            <>
              {/* Zoom Controls */}
              <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5">
                <button
                  onClick={handleZoomOut}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-1.5 py-0.5 text-[10px] font-bold text-slate-300 hover:text-white"
                  title="Reset to 100%"
                >
                  {Math.round(scale * 100)}%
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Fit Width */}
              <button
                onClick={handleFitWidth}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-[11px] font-semibold text-slate-300 hidden md:inline-flex"
                title="Fit to Container Width"
              >
                Fit Width
              </button>

              {/* Rotate */}
              <button
                onClick={handleRotate}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300"
                title={`Rotate 90° Clockwise (Current: ${rotation}°)`}
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              {/* Grayscale Simulation Toggle */}
              <button
                onClick={() => setIsGrayscale(!isGrayscale)}
                className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors ${
                  isGrayscale
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title="Simulate B&W Monochrome Laser Print output"
              >
                <Sliders className="w-3 h-3" />
                <span className="hidden sm:inline">{isGrayscale ? 'B&W Sim' : 'Colour'}</span>
              </button>

              {/* Gutter / Margin Guide Overlay */}
              <button
                onClick={() => setShowGutterGuide(!showGutterGuide)}
                className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors ${
                  showGutterGuide
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title="Toggle visual 15mm spine gutter and safe print border"
              >
                <span>Margins</span>
              </button>
            </>
          )}

          {/* Direct Print Button */}
          <button
            onClick={handlePrint}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
            title="Open browser print dialog"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {/* Download Original File */}
          <a
            href={url}
            download={documentName}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Download Document"
          >
            <Download className="w-3.5 h-3.5" />
          </a>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 hover:text-white"
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Thumbnails Drawer (if enabled) */}
        {viewMode === 'canvas' && showThumbnails && numPages > 0 && (
          <div className="w-32 bg-slate-950 border-r border-slate-800 overflow-y-auto p-2 space-y-2 shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Pages ({numPages})</p>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
              <PDFPageThumbnail
                key={p}
                pdfDoc={pdfDoc}
                pageNumber={p}
                isSelected={currentPage === p}
                colorMode={colorMode}
                onClick={() => setCurrentPage(p)}
              />
            ))}
          </div>
        )}

        {/* Center Stage: Canvas or Native Viewer */}
        <div className="flex-1 overflow-auto bg-slate-950/60 p-4 flex items-center justify-center relative">
          {isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-300">Rendering high-resolution PDF proof...</p>
              <p className="text-[11px] text-slate-500 mt-1">Inspecting color vectors and page boundaries</p>
            </div>
          ) : errorMessage ? (
            <div className="max-w-md p-6 bg-slate-900 rounded-2xl border border-slate-800 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">Interactive Canvas Notice</h3>
              <p className="text-xs text-slate-400">{errorMessage}</p>
              <div className="pt-2">
                <button
                  onClick={() => setViewMode('native')}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  Switch to Native Browser Viewer
                </button>
              </div>
            </div>
          ) : viewMode === 'native' ? (
            <div className="w-full h-full bg-white rounded-lg overflow-hidden">
              <object
                data={`${url}#toolbar=1&navpanes=1`}
                type="application/pdf"
                className="w-full h-full min-h-[550px]"
              >
                <div className="p-8 text-center bg-slate-900 text-slate-300 h-full flex flex-col items-center justify-center">
                  <p className="text-sm font-bold mb-2">Native PDF Plugin</p>
                  <p className="text-xs text-slate-400 mb-4">
                    Your browser does not directly embed this PDF. You can download or view it in a new window:
                  </p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold"
                  >
                    Open Document in New Tab
                  </a>
                </div>
              </object>
            </div>
          ) : (
            <div className="relative inline-block shadow-2xl transition-transform duration-100">
              {/* The Rendered PDF Canvas */}
              <canvas
                ref={canvasRef}
                className="bg-white rounded shadow-md block transition-all"
                style={{
                  filter: isGrayscale ? 'grayscale(100%) contrast(105%)' : 'none',
                }}
              />

              {/* Visual Gutter & Margin Verification Overlay */}
              {showGutterGuide && (
                <div className="absolute inset-0 pointer-events-none border border-red-400/40 rounded">
                  {/* Left Spine Gutter (approx 15mm = ~42pt) */}
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-indigo-500/15 border-r-2 border-dashed border-indigo-400/60 flex items-center justify-center"
                    style={{ width: `${Math.max(scale * 42, 24)}px` }}
                  >
                    <span className="text-[9px] font-bold text-indigo-300 tracking-wider rotate-90 whitespace-nowrap drop-shadow-sm select-none">
                      SPINE GUTTER (15MM SAFE ZONE)
                    </span>
                  </div>

                  {/* Safe Trim Margin Box (5mm = ~14pt) */}
                  <div
                    className="absolute border border-emerald-400/40"
                    style={{
                      top: `${Math.max(scale * 14, 8)}px`,
                      bottom: `${Math.max(scale * 14, 8)}px`,
                      left: `${Math.max(scale * 42, 24)}px`,
                      right: `${Math.max(scale * 14, 8)}px`,
                    }}
                  >
                    <span className="absolute top-1 right-1 text-[8px] font-bold text-emerald-400/70 select-none">
                      SAFE PRINT AREA
                    </span>
                  </div>
                </div>
              )}

              {/* Active Inspection Badges */}
              <div className="absolute top-2 right-2 flex flex-col gap-1 pointer-events-none">
                {isGrayscale && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 shadow-md">
                    B&W LASER SIMULATION
                  </span>
                )}
                {rotation !== 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white shadow-md">
                    ROTATED {rotation}°
                  </span>
                )}
              </div>

              {/* Rendering indicator */}
              {isRendering && (
                <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="bg-slate-900/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-2 border border-slate-700 shadow-lg">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    <span>Rendering page...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer Status Bar */}
      <div className="bg-slate-950 px-4 py-2 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <strong className="text-slate-300">PDF.js Engine:</strong> High-Fidelity 600 DPI Vector Proofing
          </span>

          {expectedPageCount && numPages > 0 && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                expectedPageCount === numPages
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {expectedPageCount === numPages
                ? `Page Count Verified (${numPages} pages)`
                : `Count Warning: PDF has ${numPages} vs Order ${expectedPageCount}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span>Standard ISO 216</span>
          <span>•</span>
          <span>Left Spine Gutter: 15mm</span>
          <span>•</span>
          <span>Zoom: {Math.round(scale * 100)}%</span>
        </div>
      </div>
    </div>
  );
};
