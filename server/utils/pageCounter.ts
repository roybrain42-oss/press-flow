import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { PDFDocument, PDFName } from 'pdf-lib';

export interface ServerPageAnalysis {
  totalPages: number;
  colorPages: number;
  bwPages: number;
  detectedType: string;
}

function decompressStream(uint8: Uint8Array): Buffer {
  try {
    return zlib.inflateSync(Buffer.from(uint8));
  } catch {
    try {
      return zlib.inflateRawSync(Buffer.from(uint8));
    } catch {
      return Buffer.from(uint8);
    }
  }
}

function streamHasColor(text: string): boolean {
  // 1. Check RGB fill or stroke (rg or RG), e.g. "0.8 0.1 0.2 rg"
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

  // 2. Check CMYK fill or stroke (k or K)
  const cmykRegex = /([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+(?:k|K)/g;
  while ((match = cmykRegex.exec(text)) !== null) {
    const c = parseFloat(match[1]);
    const m = parseFloat(match[2]);
    const y = parseFloat(match[3]);
    if (c > 0.04 || m > 0.04 || y > 0.04) {
      return true;
    }
  }

  // 3. Explicit device RGB or CMYK spaces
  if (text.includes('/DeviceRGB') || text.includes('/DeviceCMYK')) {
    return true;
  }

  return false;
}

/**
 * Detailed server-side calculation and color analysis for an uploaded file on disk.
 */
export async function analyzeServerDocumentPages(filePath: string): Promise<ServerPageAnalysis> {
  try {
    if (!fs.existsSync(filePath)) {
      return { totalPages: 1, colorPages: 0, bwPages: 1, detectedType: 'Document' };
    }

    const ext = path.extname(filePath).toLowerCase();

    // 1. Single page images
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      // Analyze file header / buffer for color indicators or default to single color image
      return {
        totalPages: 1,
        colorPages: 1,
        bwPages: 0,
        detectedType: 'Image',
      };
    }

    // 2. PDF Document
    if (ext === '.pdf') {
      try {
        const fileBuffer = await fs.promises.readFile(filePath);
        const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        const total = pages.length;

        if (total > 0) {
          let colorCount = 0;
          let bwCount = 0;

          for (let i = 0; i < total; i++) {
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
                  const decompressed = decompressStream(raw).toString('binary');
                  if (streamHasColor(decompressed)) {
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
            totalPages: total,
            colorPages: colorCount,
            bwPages: bwCount,
            detectedType: 'PDF Document',
          };
        }
      } catch (pdfErr) {
        console.warn('Server detailed PDF color analysis fallback:', pdfErr);
      }

      const total = await calculateServerDocumentPages(filePath);
      return {
        totalPages: total,
        colorPages: 0,
        bwPages: total,
        detectedType: 'PDF Document',
      };
    }

    // 3. Word DOCX or PowerPoint PPTX
    if (ext === '.docx' || ext === '.doc') {
      try {
        const buffer = await fs.promises.readFile(filePath);
        const text = buffer.toString('utf-8');
        const pageMatch = text.match(/<Pages[^>]*>(\d+)<\/Pages>/i);
        const total = (pageMatch && parseInt(pageMatch[1], 10) > 0) ? parseInt(pageMatch[1], 10) : 1;
        const hasColorTags = /<w:color\s+w:val="(?!000000|auto|ffffff)[0-9a-fA-F]{6}"/i.test(text);
        return {
          totalPages: total,
          colorPages: hasColorTags ? total : 0,
          bwPages: hasColorTags ? 0 : total,
          detectedType: 'Word Document',
        };
      } catch {
        return { totalPages: 1, colorPages: 0, bwPages: 1, detectedType: 'Word Document' };
      }
    }

    if (ext === '.pptx' || ext === '.ppt') {
      try {
        const buffer = await fs.promises.readFile(filePath);
        const text = buffer.toString('utf-8');
        const slideMatch = text.match(/<Slides[^>]*>(\d+)<\/Slides>/i);
        const total = (slideMatch && parseInt(slideMatch[1], 10) > 0) ? parseInt(slideMatch[1], 10) : 1;
        return {
          totalPages: total,
          colorPages: total, // presentations are predominantly color
          bwPages: 0,
          detectedType: 'PowerPoint Presentation',
        };
      } catch {
        return { totalPages: 1, colorPages: 1, bwPages: 0, detectedType: 'PowerPoint Presentation' };
      }
    }

    return { totalPages: 1, colorPages: 0, bwPages: 1, detectedType: 'Document' };
  } catch (err) {
    console.error('Error in analyzeServerDocumentPages:', err);
    return { totalPages: 1, colorPages: 0, bwPages: 1, detectedType: 'Document' };
  }
}

/**
 * Server-side calculation of total pages for an uploaded file on disk.
 */
export async function calculateServerDocumentPages(filePath: string): Promise<number> {
  try {
    if (!fs.existsSync(filePath)) {
      return 1;
    }

    const ext = path.extname(filePath).toLowerCase();

    // 1. Single page images
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return 1;
    }

    // 2. PDF Document
    if (ext === '.pdf') {
      try {
        const fileBuffer = await fs.promises.readFile(filePath);
        const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();
        if (count && count > 0) {
          return count;
        }
      } catch (pdfErr) {
        console.warn('Server pdf-lib parsing failed, falling back to stream check:', pdfErr);
        try {
          const rawBuffer = await fs.promises.readFile(filePath);
          const rawText = rawBuffer.toString('binary');
          const matches = rawText.match(/\/Type\s*\/Page[^s]/g);
          if (matches && matches.length > 0) {
            return matches.length;
          }
          const countMatch = rawText.match(/\/Count\s+(\d+)/);
          if (countMatch && parseInt(countMatch[1], 10) > 0) {
            return parseInt(countMatch[1], 10);
          }
        } catch (rawErr) {
          console.warn('Server raw stream scan failed:', rawErr);
        }
      }
      return 1;
    }

    // 3. Word DOCX or PowerPoint PPTX
    if (ext === '.docx' || ext === '.doc') {
      try {
        const buffer = await fs.promises.readFile(filePath);
        const text = buffer.toString('utf-8');
        const pageMatch = text.match(/<Pages[^>]*>(\d+)<\/Pages>/i);
        if (pageMatch && parseInt(pageMatch[1], 10) > 0) {
          return parseInt(pageMatch[1], 10);
        }
      } catch {
        // fallback
      }
      return 1;
    }

    if (ext === '.pptx' || ext === '.ppt') {
      try {
        const buffer = await fs.promises.readFile(filePath);
        const text = buffer.toString('utf-8');
        const slideMatch = text.match(/<Slides[^>]*>(\d+)<\/Slides>/i);
        if (slideMatch && parseInt(slideMatch[1], 10) > 0) {
          return parseInt(slideMatch[1], 10);
        }
      } catch {
        // fallback
      }
      return 1;
    }

    return 1;
  } catch (err) {
    console.error('Error in calculateServerDocumentPages:', err);
    return 1;
  }
}
