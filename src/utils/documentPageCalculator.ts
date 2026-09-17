import { PDFDocument, PDFName } from 'pdf-lib';
import pako from 'pako';

export interface DocumentPageCalculation {
  pageCount: number;
  colorPages: number;
  bwPages: number;
  detectedType: string;
  method: 'pdf-lib' | 'pdf-stream' | 'image' | 'xml' | 'default';
}

function decompressPdfStream(rawUint8: Uint8Array): string {
  try {
    const decompressed = pako.inflate(rawUint8);
    return new TextDecoder('latin1').decode(decompressed);
  } catch {
    try {
      const decompressedRaw = pako.inflateRaw(rawUint8);
      return new TextDecoder('latin1').decode(decompressedRaw);
    } catch {
      return new TextDecoder('latin1').decode(rawUint8);
    }
  }
}

function isColorPdfOperator(text: string): boolean {
  // Check RGB fill/stroke: r g b rg / RG
  const rgbRegex = /([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+(?:rg|RG)/g;
  let match: RegExpExecArray | null;
  while ((match = rgbRegex.exec(text)) !== null) {
    const r = parseFloat(match[1]);
    const g = parseFloat(match[2]);
    const b = parseFloat(match[3]);
    if (Math.abs(r - g) > 0.04 || Math.abs(g - b) > 0.04 || Math.abs(r - b) > 0.04) {
      return true;
    }
  }

  // Check CMYK fill/stroke: c m y k k / K
  const cmykRegex = /([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+(?:k|K)/g;
  while ((match = cmykRegex.exec(text)) !== null) {
    const c = parseFloat(match[1]);
    const m = parseFloat(match[2]);
    const y = parseFloat(match[3]);
    if (c > 0.04 || m > 0.04 || y > 0.04) {
      return true;
    }
  }

  // Check explicit color space specifications
  if (text.includes('/DeviceRGB') || text.includes('/DeviceCMYK')) {
    return true;
  }

  return false;
}

/**
 * Checks if an image file has color pixels using an offscreen canvas
 */
async function analyzeImageColor(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 120;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(true);
            return;
          }
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          const imgData = ctx.getImageData(0, 0, size, size).data;
          let colorPixels = 0;
          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];
            if (a > 20) {
              if (Math.abs(r - g) > 18 || Math.abs(g - b) > 18 || Math.abs(r - b) > 18) {
                colorPixels++;
                if (colorPixels > 15) {
                  resolve(true);
                  return;
                }
              }
            }
          }
          resolve(false);
        } catch {
          URL.revokeObjectURL(url);
          resolve(true);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(true);
      };
      img.src = url;
    } catch {
      resolve(true);
    }
  });
}

/**
 * Calculates the total number of pages and detects coloured vs non-coloured pages from an uploaded file.
 * Handles PDF (using pdf-lib with stream decompression and operator analysis), images (via canvas pixel analysis),
 * Word docx/pptx (via XML inspection), and defaults.
 */
export async function calculateDocumentPages(file: File): Promise<DocumentPageCalculation> {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  // 1. Single-page image formats
  if (
    fileType.startsWith('image/') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.webp')
  ) {
    const isColor = await analyzeImageColor(file);
    return {
      pageCount: 1,
      colorPages: isColor ? 1 : 0,
      bwPages: isColor ? 0 : 1,
      detectedType: 'Image',
      method: 'image',
    };
  }

  // 2. PDF Document
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      const totalPages = pages.length;

      if (totalPages > 0) {
        let colorCount = 0;
        let bwCount = 0;

        for (let i = 0; i < totalPages; i++) {
          const page = pages[i];
          let pageHasColor = false;

          // Check contents stream
          const contents = page.node.Contents();
          if (contents) {
            const items = (contents as any).asArray ? (contents as any).asArray() : [contents];
            for (const item of items) {
              const stream = (pdfDoc.context as any).lookup(item);
              if (stream && stream.getContents) {
                const raw = stream.getContents();
                const text = decompressPdfStream(raw);
                if (isColorPdfOperator(text)) {
                  pageHasColor = true;
                  break;
                }
              }
            }
          }

          // Check page resources (XObjects) for color images if stream didn't flag color
          if (!pageHasColor) {
            const resources = page.node.Resources();
            if (resources) {
              const xObjectDict = (resources as any).lookup ? (resources as any).lookup(PDFName.of('XObject')) : null;
              if (xObjectDict && xObjectDict.entries) {
                for (const [, ref] of xObjectDict.entries()) {
                  const xObj = (pdfDoc.context as any).lookup(ref);
                  if (xObj && xObj.lookup) {
                    const colorSpace = xObj.lookup(PDFName.of('ColorSpace'));
                    if (colorSpace) {
                      const csStr = colorSpace.toString();
                      if (csStr.includes('RGB') || csStr.includes('CMYK')) {
                        pageHasColor = true;
                        break;
                      }
                    }
                  }
                }
              }
            }
          }

          if (pageHasColor) {
            colorCount++;
          } else {
            bwCount++;
          }
        }

        return {
          pageCount: totalPages,
          colorPages: colorCount,
          bwPages: bwCount,
          detectedType: 'PDF Document',
          method: 'pdf-lib',
        };
      }
    } catch (pdfErr) {
      console.warn('pdf-lib parsing failed, attempting binary stream scan:', pdfErr);
      try {
        // Fallback: scan PDF stream for /Type /Page
        const text = await file.text();
        const matches = text.match(/\/Type\s*\/Page[^s]/g);
        if (matches && matches.length > 0) {
          const count = matches.length;
          const hasColor = isColorPdfOperator(text);
          return {
            pageCount: count,
            colorPages: hasColor ? count : 0,
            bwPages: hasColor ? 0 : count,
            detectedType: 'PDF Document',
            method: 'pdf-stream',
          };
        }
        // Check /Count in catalog
        const countMatch = text.match(/\/Count\s+(\d+)/);
        if (countMatch && parseInt(countMatch[1], 10) > 0) {
          const count = parseInt(countMatch[1], 10);
          const hasColor = isColorPdfOperator(text);
          return {
            pageCount: count,
            colorPages: hasColor ? count : 0,
            bwPages: hasColor ? 0 : count,
            detectedType: 'PDF Document',
            method: 'pdf-stream',
          };
        }
      } catch (streamErr) {
        console.warn('PDF stream scan fallback failed:', streamErr);
      }
    }
    // Default for unreadable PDF
    return {
      pageCount: 1,
      colorPages: 0,
      bwPages: 1,
      detectedType: 'PDF Document',
      method: 'default',
    };
  }

  // 3. Word DOCX or PowerPoint PPTX (Zipped XML archives)
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    try {
      const buffer = await file.arrayBuffer();
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const rawText = textDecoder.decode(buffer);
      const pageMatch = rawText.match(/<Pages[^>]*>(\d+)<\/Pages>/i);
      const count = (pageMatch && parseInt(pageMatch[1], 10) > 0) ? parseInt(pageMatch[1], 10) : 1;
      const hasColor = /<w:color\s+w:val="(?!000000|auto|ffffff)[0-9a-fA-F]{6}"/i.test(rawText) || rawText.includes('word/media/');
      return {
        pageCount: count,
        colorPages: hasColor ? count : 0,
        bwPages: hasColor ? 0 : count,
        detectedType: 'Word Document',
        method: 'xml',
      };
    } catch {
      // Fall through
    }
    return {
      pageCount: 1,
      colorPages: 0,
      bwPages: 1,
      detectedType: 'Word Document',
      method: 'default',
    };
  }

  if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
    try {
      const buffer = await file.arrayBuffer();
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const rawText = textDecoder.decode(buffer);
      const slideMatch = rawText.match(/<Slides[^>]*>(\d+)<\/Slides>/i);
      const count = (slideMatch && parseInt(slideMatch[1], 10) > 0) ? parseInt(slideMatch[1], 10) : 1;
      return {
        pageCount: count,
        colorPages: count, // Presentations are predominantly colored
        bwPages: 0,
        detectedType: 'PowerPoint Presentation',
        method: 'xml',
      };
    } catch {
      // Fall through
    }
    return {
      pageCount: 1,
      colorPages: 1,
      bwPages: 0,
      detectedType: 'PowerPoint Presentation',
      method: 'default',
    };
  }

  // Default fallback
  return {
    pageCount: 1,
    colorPages: 0,
    bwPages: 1,
    detectedType: 'Document',
    method: 'default',
  };
}

/**
 * Calculates effective number of printable pages given total document pages and page range.
 * Supports "All", "1-5", "1, 3, 5-8", etc.
 */
export function calculatePrintablePages(totalDocumentPages: number, pageRangeStr: string): number {
  const trimmed = pageRangeStr.trim().toLowerCase();
  if (!trimmed || trimmed === 'all') {
    return Math.max(1, totalDocumentPages);
  }

  try {
    const pageSet = new Set<number>();
    const parts = trimmed.split(',');

    for (const part of parts) {
      const cleanPart = part.trim();
      if (!cleanPart) continue;

      if (cleanPart.includes('-')) {
        const [startStr, endStr] = cleanPart.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(totalDocumentPages, Math.max(start, end));
          for (let p = min; p <= max; p++) {
            pageSet.add(p);
          }
        }
      } else {
        const pageNum = parseInt(cleanPart, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalDocumentPages) {
          pageSet.add(pageNum);
        }
      }
    }

    return pageSet.size > 0 ? pageSet.size : totalDocumentPages;
  } catch {
    return totalDocumentPages;
  }
}
