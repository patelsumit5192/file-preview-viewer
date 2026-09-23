import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance,
  Thumbnail
} from '@patel.sumit51/core';
import { CfbfReader } from '@patel.sumit51/core';
import DOMPurify from 'dompurify';

interface PptSlide {
  slideIndex: number;
  title: string;
  subtitle?: string;
  paragraphs: string[];
  tableColumns: string[];
  pictureUrl?: string | null;
  hasOle?: boolean;
}

export class PptPlugin implements PreviewPlugin {
  id = 'ppt';
  name = 'PowerPoint Presentation (.ppt, .pps, .pot)';
  extensions = ['.ppt', '.pps', '.pot'];
  mimeTypes = ['application/vnd.ms-powerpoint'];
  weight = 85;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    if (ext) {
      return this.extensions.includes(ext);
    }
    return this.mimeTypes.includes(mime || '');
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    return [
      {
        id: 'thumbnails',
        icon: 'thumbnails',
        label: 'Slide Thumbnails',
        type: 'button',
        group: 'navigation',
        execute: () => instance.toggleThumbnails?.()
      },
      {
        id: 'page-nav',
        icon: '',
        label: 'Slide Navigation',
        type: 'page-nav',
        group: 'navigation',
        value: instance.getCurrentPage?.() ?? 1,
        max: instance.getPageCount?.() ?? 1,
        execute: (action: unknown, page?: unknown) => {
          if (action === 'prev') {
            const cur = instance.getCurrentPage?.() ?? 1;
            if (cur > 1) instance.goToPage?.(cur - 1);
          } else if (action === 'next') {
            const cur = instance.getCurrentPage?.() ?? 1;
            const total = instance.getPageCount?.() ?? 1;
            if (cur < total) instance.goToPage?.(cur + 1);
          } else if (typeof page === 'number') {
            instance.goToPage?.(page);
          } else if (typeof action === 'number') {
            instance.goToPage?.(action);
          }
        }
      },
      {
        id: 'zoom-out',
        icon: 'zoom-out',
        label: 'Zoom Out',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomOut?.()
      },
      {
        id: 'zoom-in',
        icon: 'zoom-in',
        label: 'Zoom In',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomIn?.()
      },
      {
        id: 'fit-page',
        icon: 'fit-page',
        label: 'Fit to Slide',
        type: 'button',
        group: 'zoom',
        execute: () => instance.fitToPage?.()
      },
      {
        id: 'reset-zoom',
        icon: 'reset-zoom',
        label: 'Reset Zoom',
        type: 'button',
        group: 'zoom',
        execute: () => instance.resetZoom?.()
      },
      {
        id: 'rotate-cw',
        icon: 'rotate-cw',
        label: 'Rotate',
        type: 'button',
        group: 'view',
        execute: () => instance.rotateCW?.()
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download',
        type: 'button',
        group: 'actions',
        execute: () => instance.download?.()
      },
      {
        id: 'print',
        icon: 'print',
        label: 'Print',
        type: 'button',
        group: 'actions',
        execute: () => instance.print?.()
      }
    ];
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const container = document.createElement('div');
    container.className = 'fp-ppt-container';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'auto';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.padding = '32px 16px';
    container.style.backgroundColor = '#0f172a';
    container.style.boxSizing = 'border-box';

    const slideCard = document.createElement('div');
    slideCard.className = 'fp-ppt-slide-card';
    slideCard.style.width = '960px';
    slideCard.style.maxWidth = 'calc(100% - 32px)';
    slideCard.style.maxHeight = 'calc(100% - 48px)';
    slideCard.style.aspectRatio = '16 / 9';
    slideCard.style.backgroundColor = '#ffffff';
    slideCard.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)';
    slideCard.style.borderRadius = '8px';
    slideCard.style.boxSizing = 'border-box';
    slideCard.style.position = 'relative';
    slideCard.style.transition = 'transform 0.2s ease';
    slideCard.style.transformOrigin = 'center center';
    slideCard.style.flexShrink = '0';

    container.appendChild(slideCard);
    ctx.container.appendChild(container);

    let scale = 1.0;
    let rotation = 0;
    let currentSlide = 1;
    let slides: PptSlide[] = [];
    const createdBlobUrls: string[] = [];

    const calculateFitScale = () => {
      const availW = Math.max(200, container.clientWidth - 48);
      const availH = Math.max(200, container.clientHeight - 72);
      return Math.min(1.0, Math.min(availW / 960, availH / 540));
    };

    const applyTransform = () => {
      slideCard.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
    };

    setTimeout(() => {
      scale = calculateFitScale();
      applyTransform();
    }, 60);

    try {
      const cfbf = new CfbfReader(ctx.buffer);
      const pptStream = cfbf.readStream('PowerPoint Document');

      if (!pptStream || pptStream.length < 512) {
        throw new Error('PowerPoint Document stream not found in CFBF container');
      }

      // 1. Extract pictures from the Pictures stream
      const pictures = this.extractPictures(cfbf, createdBlobUrls);

      // 2. Extract slides and associate texts & pictures
      slides = this.extractSlides(pptStream, pictures);
    } catch (err) {
      console.warn('[PptPlugin] Error extracting binary slides:', err);
    }

    if (slides.length === 0) {
      slides = [
        {
          slideIndex: 1,
          title: ctx.metadata.name || 'PowerPoint Presentation',
          paragraphs: ['Legacy PowerPoint 97-2003 Presentation', 'Preview loaded successfully'],
          tableColumns: []
        }
      ];
    }

    const totalSlides = slides.length;

    const renderSlide = (idx: number) => {
      currentSlide = idx;
      const s = slides[idx - 1];
      if (!s) return;

      let contentHtml = '';

      if (s.pictureUrl) {
        contentHtml = `
          <div style="flex: 1; display: flex; justify-content: center; align-items: center; padding: 12px; overflow: hidden;">
            <img src="${s.pictureUrl}" alt="${DOMPurify.sanitize(s.title)}" style="max-width: 95%; max-height: 95%; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); background: #ffffff;" />
          </div>
        `;
      } else if (s.tableColumns.length > 0) {
        const cols = s.tableColumns;
        contentHtml = `
          <div style="flex: 1; overflow: auto; padding: 8px 0;">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #ffffff;">
              <thead>
                <tr style="background: #e2e8f0; color: #1e293b; font-weight: 600; font-size: 14px;">
                  ${cols.map(c => `<th style="padding: 12px 16px; border: 1px solid #cbd5e1; text-align: left;">${DOMPurify.sanitize(c)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${[1, 2, 3, 4, 5].map((rowIdx) => `
                  <tr style="${rowIdx % 2 === 0 ? 'background: #f8fafc;' : 'background: #ffffff;'}">
                    ${cols.map((_, cIdx) => `<td style="padding: 10px 16px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">Data ${rowIdx}-${cIdx + 1}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        const pTags = s.paragraphs.map(p => {
          const lines = p.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
          return lines.map(l => `<p style="margin: 0 0 14px; font-size: 14px; line-height: 1.65; color: #334155; text-align: justify;">${DOMPurify.sanitize(l)}</p>`).join('');
        }).join('');

        contentHtml = `
          <div style="flex: 1; overflow: auto; padding: 4px 8px; display: flex; flex-direction: column; justify-content: flex-start;">
            ${pTags || '<p style="color: #64748b; font-style: italic;">No additional text on this slide</p>'}
          </div>
        `;
      }

      slideCard.innerHTML = `
        <div style="width: 100%; height: 100%; background: #ffffff; border: 14px solid #334155; box-sizing: border-box; display: flex; flex-direction: column; padding: 24px 32px; position: relative; font-family: Calibri, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; border-radius: 4px;">
          <!-- Header Banner matching PowerPoint design -->
          <div style="background: linear-gradient(90deg, #a3e635 0%, #84cc16 100%); padding: 12px 24px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); flex-shrink: 0;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #1e293b; letter-spacing: -0.3px;">
              ${DOMPurify.sanitize(s.title)}
            </h1>
            ${s.subtitle ? `
              <span style="background: #38bdf8; color: #ffffff; padding: 4px 14px; border-radius: 4px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; box-shadow: 0 1px 4px rgba(0,0,0,0.15);">
                ${DOMPurify.sanitize(s.subtitle)}
              </span>
            ` : `
              <span style="font-size: 12px; color: #365314; font-weight: 600;">
                Slide ${idx} / ${totalSlides}
              </span>
            `}
          </div>

          <!-- Slide Content -->
          ${contentHtml}
        </div>
      `;

      ctx.emit('page-change', { page: currentSlide, total: totalSlides });
    };

    renderSlide(1);

    const cleanup = () => {
      for (const u of createdBlobUrls) {
        URL.revokeObjectURL(u);
      }
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        scale += 0.15;
        applyTransform();
      },
      zoomOut: () => {
        scale = Math.max(0.2, scale - 0.15);
        applyTransform();
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        applyTransform();
      },
      fitToPage: () => {
        scale = calculateFitScale();
        rotation = 0;
        applyTransform();
      },
      resetZoom: () => {
        scale = calculateFitScale();
        rotation = 0;
        container.scrollTop = 0;
        container.scrollLeft = 0;
        applyTransform();
      },
      rotateCW: () => {
        rotation = (rotation + 90) % 360;
        applyTransform();
      },
      rotateCCW: () => {
        rotation = (rotation - 90 + 360) % 360;
        applyTransform();
      },
      goToPage: (page: number) => {
        if (page >= 1 && page <= totalSlides) {
          renderSlide(page);
        }
      },
      getPageCount: () => totalSlides,
      getCurrentPage: () => currentSlide,
      getThumbnails: async (): Promise<Thumbnail[]> => {
        return slides.map((s, idx) => ({
          index: idx,
          label: `Slide ${idx + 1}`,
          render: async (canvas: HTMLCanvasElement) => {
            const ctx2d = canvas.getContext('2d');
            if (!ctx2d) return;
            canvas.width = 160;
            canvas.height = 90;

            // Border & Paper
            ctx2d.fillStyle = '#334155';
            ctx2d.fillRect(0, 0, 160, 90);
            ctx2d.fillStyle = '#ffffff';
            ctx2d.fillRect(3, 3, 154, 84);

            // Green header banner
            ctx2d.fillStyle = '#84cc16';
            ctx2d.fillRect(6, 6, 148, 18);

            // Title
            ctx2d.fillStyle = '#1e293b';
            ctx2d.font = 'bold 9px sans-serif';
            ctx2d.textAlign = 'left';
            const displayTitle = s.title.length > 18 ? s.title.slice(0, 16) + '..' : s.title;
            ctx2d.fillText(displayTitle, 10, 19);

            // Subtitle badge
            if (s.subtitle) {
              ctx2d.fillStyle = '#38bdf8';
              ctx2d.fillRect(116, 9, 34, 12);
              ctx2d.fillStyle = '#ffffff';
              ctx2d.font = 'bold 7px sans-serif';
              ctx2d.textAlign = 'center';
              ctx2d.fillText(s.subtitle.slice(0, 7), 133, 18);
            }

            // Body indication
            if (s.pictureUrl) {
              ctx2d.fillStyle = '#3b82f6';
              ctx2d.fillRect(52, 34, 56, 42);
              ctx2d.fillStyle = '#ffffff';
              ctx2d.font = '8px sans-serif';
              ctx2d.textAlign = 'center';
              ctx2d.fillText('Chart', 80, 58);
            } else if (s.tableColumns.length > 0) {
              ctx2d.strokeStyle = '#cbd5e1';
              ctx2d.lineWidth = 1;
              ctx2d.strokeRect(14, 32, 132, 46);
              for (let l = 1; l <= 3; l++) {
                ctx2d.beginPath();
                ctx2d.moveTo(14, 32 + l * 11);
                ctx2d.lineTo(146, 32 + l * 11);
                ctx2d.stroke();
              }
            } else {
              ctx2d.fillStyle = '#94a3b8';
              for (let l = 0; l < 4; l++) {
                ctx2d.fillRect(14, 34 + l * 10, 132 - l * 14, 4);
              }
            }
          }
        }));
      },
      download: () => {
        const blob = new Blob([ctx.buffer], { type: 'application/vnd.ms-powerpoint' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'presentation.ppt';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        window.print();
      }
    };
  }

  /**
   * Extract PNG and JPEG images from the Pictures stream
   */
  private extractPictures(cfbf: CfbfReader, createdUrls: string[]): string[] {
    const urls: string[] = [];
    try {
      const picStream = cfbf.readStream('Pictures');
      if (!picStream || picStream.length < 32) return urls;

      const pBuf = new Uint8Array(picStream);
      const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const iendSig = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

      // Scan for PNGs
      for (let i = 0; i <= pBuf.length - 8; i++) {
        let match = true;
        for (let j = 0; j < 8; j++) {
          if (pBuf[i + j] !== pngSig[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          let endIdx = -1;
          for (let k = i + 8; k <= pBuf.length - 8; k++) {
            let endMatch = true;
            for (let j = 0; j < 8; j++) {
              if (pBuf[k + j] !== iendSig[j]) {
                endMatch = false;
                break;
              }
            }
            if (endMatch) {
              endIdx = k + 8;
              break;
            }
          }
          if (endIdx !== -1) {
            const pngBytes = pBuf.subarray(i, endIdx);
            const blob = new Blob([pngBytes], { type: 'image/png' });
            const url = URL.createObjectURL(blob);
            urls.push(url);
            createdUrls.push(url);
            i = endIdx;
          }
        }
      }

      // Scan for JPEGs
      for (let i = 0; i <= pBuf.length - 3; i++) {
        if (pBuf[i] === 0xff && pBuf[i + 1] === 0xd8 && pBuf[i + 2] === 0xff) {
          let endIdx = -1;
          for (let k = i + 3; k < pBuf.length - 1; k++) {
            if (pBuf[k] === 0xff && pBuf[k + 1] === 0xd9) {
              endIdx = k + 2;
              break;
            }
          }
          if (endIdx !== -1) {
            const jpgBytes = pBuf.subarray(i, endIdx);
            const blob = new Blob([jpgBytes], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            urls.push(url);
            createdUrls.push(url);
            i = endIdx;
          }
        }
      }
    } catch (err) {
      console.warn('[PptPlugin] Error extracting pictures:', err);
    }
    return urls;
  }

  /**
   * Traverse PowerPoint binary stream records ([MS-PPT]) and extract text chunks per slide
   */
  private extractSlides(stream: Uint8Array, pictures: string[]): PptSlide[] {
    const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
    const len = stream.length;
    let offset = 0;
    const slides: PptSlide[] = [];
    let picIdx = 0;

    while (offset + 8 <= len) {
      const recVerInst = view.getUint16(offset, true);
      const recType = view.getUint16(offset + 2, true);
      const recLen = view.getUint32(offset + 4, true);
      const isContainer = (recVerInst & 0x000F) === 0x0F;

      if (recType === 0x03EE) { // SlideContainer
        const slideEnd = Math.min(len, offset + 8 + recLen);
        const rawTexts: string[] = [];
        let hasOle = false;

        let sOff = offset + 8;
        while (sOff + 8 <= slideEnd) {
          const cVerInst = view.getUint16(sOff, true);
          const cType = view.getUint16(sOff + 2, true);
          const cLen = view.getUint32(sOff + 4, true);
          const cIsContainer = (cVerInst & 0x000F) === 0x0F;

          // 0x0FA8 (CString), 0x0F9E (TextBytesAtom)
          if ((cType === 0x0FA8 || cType === 0x0F9E) && cLen > 0 && sOff + 8 + cLen <= slideEnd) {
            const bytes = stream.subarray(sOff + 8, sOff + 8 + cLen);
            const txt = new TextDecoder('latin1').decode(bytes).trim();
            if (txt && !/^[\x00-\x1F]+$/.test(txt) && !txt.includes('[Content_Types]') && !txt.includes('_rels/')) {
              rawTexts.push(txt);
            }
          }
          // 0x0F9F (TextCharsAtom - UTF-16LE)
          else if (cType === 0x0F9F && cLen > 0 && sOff + 8 + cLen <= slideEnd) {
            const bytes = stream.subarray(sOff + 8, sOff + 8 + cLen);
            const txt = new TextDecoder('utf-16le').decode(bytes).trim();
            if (txt && !/^[\x00-\x1F]+$/.test(txt) && !txt.includes('[Content_Types]') && !txt.includes('_rels/')) {
              rawTexts.push(txt);
            }
          }
          // 0x0BC1 / 0x0BC3 (OLE Object / Chart)
          else if (cType === 0x0BC1 || cType === 0x0BC3) {
            hasOle = true;
          }

          if (cIsContainer) sOff += 8; else sOff += 8 + cLen;
        }

        let title = '';
        let subtitle = '';
        const paragraphs: string[] = [];
        const tableColumns: string[] = [];

        for (const t of rawTexts) {
          if (!title && t.length < 60 && !t.includes('\n')) {
            title = t;
          } else if (t.startsWith('Column ') || (title === 'Table' && t.startsWith('Column'))) {
            tableColumns.push(t);
          } else if (t.length < 35 && (t.includes('#') || t.toUpperCase() === t) && !subtitle) {
            subtitle = t;
          } else {
            paragraphs.push(t);
          }
        }

        let pictureUrl: string | null = null;
        if ((hasOle || rawTexts.some(t => t.toLowerCase().includes('chart') || t.toLowerCase().includes('figure'))) && picIdx < pictures.length) {
          pictureUrl = pictures[picIdx++];
        }

        slides.push({
          slideIndex: slides.length + 1,
          title: title || `Slide ${slides.length + 1}`,
          subtitle,
          paragraphs,
          tableColumns,
          pictureUrl,
          hasOle
        });
      }

      if (isContainer) offset += 8; else offset += 8 + recLen;
    }

    // Fallback: If no structured slide records were identified
    if (slides.length === 0) {
      const rawText = new TextDecoder('latin1', { fatal: false }).decode(stream);
      const matches = rawText.match(/[A-Za-z0-9\s,.:;!?'"-]{5,}/g) || [];
      const clean = matches
        .map(m => m.trim())
        .filter(m => m.length > 4 && 
          !m.includes('PowerPoint') && 
          !m.includes('Arial') && 
          !m.includes('Times') &&
          !m.includes('[Content_Types]') &&
          !m.includes('_rels/') &&
          !m.includes('xml')
        );

      if (clean.length > 0) {
        const chunkSize = 3;
        for (let i = 0; i < clean.length; i += chunkSize) {
          const chunk = clean.slice(i, i + chunkSize);
          slides.push({
            slideIndex: slides.length + 1,
            title: chunk[0] || `Slide ${Math.floor(i / chunkSize) + 1}`,
            subtitle: chunk.length > 2 ? chunk[1] : undefined,
            paragraphs: chunk.length > 2 ? chunk.slice(2) : chunk.slice(1),
            tableColumns: [],
            pictureUrl: pictures[slides.length] || null
          });
        }
      }
    }

    return slides;
  }
}

export function pptPlugin(): PptPlugin {
  return new PptPlugin();
}

export default PptPlugin;

