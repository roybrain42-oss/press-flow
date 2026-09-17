import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileText, Eye, Image as ImageIcon, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

// Configure PDF.js worker if needed
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface DocumentThumbnailProps {
  url: string;
  documentName: string;
  mimeType?: string;
  colorMode?: 'color' | 'bw';
  sizeBytes?: number;
  pageCount?: number;
  onClick?: () => void;
  className?: string;
}

export const DocumentThumbnail: React.FC<DocumentThumbnailProps> = ({
  url,
  documentName,
  mimeType,
  colorMode = 'color',
  sizeBytes,
  pageCount,
  onClick,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasRenderError, setHasRenderError] = useState<boolean>(false);
  const [isRendered, setIsRendered] = useState<boolean>(false);

  const isPdf =
    mimeType === 'application/pdf' ||
    documentName.toLowerCase().endsWith('.pdf');

  const isImage =
    mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(documentName);

  const fileExt = documentName.split('.').pop()?.toUpperCase() || (isPdf ? 'PDF' : 'DOC');

  useEffect(() => {
    if (!isPdf || !url) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    let renderTask: any = null;
    let loadingTask: any = null;

    const renderPdfThumbnail = async () => {
      try {
        setIsLoading(true);
        setHasRenderError(false);

        loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: true,
        });

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        const page = await pdf.getPage(1);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Render at thumbnail scale ~0.26 (approx 150px width for standard A4)
        const baseViewport = page.getViewport({ scale: 1.0 });
        const targetWidth = 140;
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });

        await renderTask.promise;

        if (!isCancelled) {
          setIsRendered(true);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled && err?.name !== 'RenderingCancelledException') {
          console.warn('[DocumentThumbnail] Thumbnail render notice:', err);
          setHasRenderError(true);
          setIsLoading(false);
        }
      }
    };

    renderPdfThumbnail();

    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [url, isPdf]);

  const formattedSize = sizeBytes
    ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : null;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-purple-400 hover:shadow-md' : ''
      } ${className}`}
      title={onClick ? 'Click to inspect low-resolution preview modal' : documentName}
    >
      {/* Top Banner: Low-Res Badge */}
      <div className="bg-slate-900 text-white px-2.5 py-1 text-[10px] font-bold flex items-center justify-between">
        <span className="flex items-center gap-1 text-purple-300">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span>Low-Res Proof</span>
        </span>
        <span className="px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800 text-[9px] font-mono">
          {fileExt}
        </span>
      </div>

      {/* Main Thumbnail Body */}
      <div className="p-3 bg-slate-50 flex items-center justify-center min-h-[140px] relative overflow-hidden">
        {/* If Image File */}
        {isImage ? (
          <div className="relative flex items-center justify-center">
            <img
              src={url}
              alt={documentName}
              referrerPolicy="no-referrer"
              className="max-h-[120px] max-w-full rounded shadow-xs object-contain"
              style={{ filter: colorMode === 'bw' ? 'grayscale(100%)' : 'none' }}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasRenderError(true);
              }}
            />
          </div>
        ) : isPdf ? (
          /* PDF Canvas Thumbnail */
          <div className="relative flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className={`rounded shadow-sm transition-opacity duration-200 ${
                isRendered ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                filter: colorMode === 'bw' ? 'grayscale(100%)' : 'none',
              }}
            />

            {/* Loading Shimmer */}
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/90 rounded p-2 text-center">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin mb-1" />
                <span className="text-[10px] font-medium text-slate-500">Generating thumbnail...</span>
              </div>
            )}

            {/* Error / Fallback Card */}
            {hasRenderError && !isRendered && (
              <div className="flex flex-col items-center justify-center py-4 px-3 text-center">
                <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-1.5">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 truncate max-w-[120px]">
                  {documentName}
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5">Click for Proof Viewer</span>
              </div>
            )}
          </div>
        ) : (
          /* Office Document / Other Format */
          <div className="flex flex-col items-center justify-center py-4 px-2 text-center">
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-1.5 shadow-xs">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 truncate max-w-[130px]">
              {documentName}
            </span>
            <span className="text-[9px] text-slate-500 mt-0.5">
              {formattedSize || `${fileExt} Document`}
            </span>
          </div>
        )}

        {/* Diagonal Low-Res Proof Watermark Stamp */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-30 select-none">
          <span className="text-[11px] font-black tracking-widest text-slate-900/60 uppercase rotate-[-25deg] whitespace-nowrap border border-slate-900/30 px-2 py-0.5 rounded">
            PROOF • PREVIEW
          </span>
        </div>

        {/* Hover Overlay with "Inspect Proof" */}
        {onClick && (
          <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white p-2 text-center">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white mb-1 shadow-md transform group-hover:scale-110 transition-transform">
              <Eye className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold">Inspect Proof</span>
            <span className="text-[9px] text-purple-200">Open preview modal</span>
          </div>
        )}
      </div>

      {/* Bottom Footer Info */}
      <div className="p-2 border-t border-slate-100 bg-white flex items-center justify-between text-[10px] text-slate-600">
        <span className="font-semibold truncate max-w-[90px]" title={documentName}>
          {documentName}
        </span>
        <span className="text-slate-400 font-mono">
          {pageCount ? `${pageCount} pg${pageCount > 1 ? 's' : ''}` : formattedSize || 'Proof'}
        </span>
      </div>
    </div>
  );
};
