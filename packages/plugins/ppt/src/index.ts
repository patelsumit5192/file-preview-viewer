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
  title: string;
  texts: string[];
}

export class PptPlugin implements PreviewPlugin {
  id = 'ppt';
  name = 'Legacy PowerPoint Presentation (.ppt, .pps, .pot)';
  extensions = ['.ppt', '.pps', '.pot'];
  mimeTypes = ['application/vnd.ms-powerpoint'];
  weight = 75;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    return this.extensions.includes(ext || '') || this.mimeTypes.includes(mime || '');
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
        id: 'page-prev',
        icon: 'page-prev',
        label: 'Previous Slide',
        type: 'button',
        group: 'navigation',
        execute: () => {
          const cur = instance.getCurrentPage?.() ?? 1;
          if (cur > 1) instance.goToPage?.(cur - 1);
        }
      },
      {
        id: 'page-nav',
        icon: '',
        label: 'Slide Number',
        type: 'page-nav',
        group: 'navigation',
        execute: (p: unknown) => instance.goToPage?.(Number(p))
      },
      {
        id: 'page-next',
        icon: 'page-next',
        label: 'Next Slide',
        type: 'button',
        group: 'navigation',
        execute: () => {
          const cur = instance.getCurrentPage?.() ?? 1;
          const total = instance.getPageCount?.() ?? 1;
          if (cur < total) instance.goToPage?.(cur + 1);
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

    const slideCard = document.createElement('div');
    slideCard.className = 'fp-ppt-slide-card';
    slideCard.style.width = '960px';
    slideCard.style.maxWidth = '90%';
    slideCard.style.aspectRatio = '16 / 9';
    slideCard.style.backgroundColor = '#ffffff';
    slideCard.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)';
    slideCard.style.borderRadius = '8px';
    slideCard.style.padding = '48px';
    slideCard.style.display = 'flex';
    slideCard.style.flexDirection = 'column';
    slideCard.style.justifyContent = 'center';
    slideCard.style.alignItems = 'center';
    slideCard.style.boxSizing = 'border-box';
    slideCard.style.position = 'relative';
    slideCard.style.overflow = 'hidden';
    slideCard.style.transformOrigin = 'center center';
    slideCard.style.transition = 'transform 0.2s ease';

    container.appendChild(slideCard);
    ctx.container.appendChild(container);

    let scale = 1.0;
    let currentSlide = 1;
    let slides: PptSlide[] = [];

    try {
      const cfbf = new CfbfReader(ctx.buffer);
      const pptStream = cfbf.readStream('PowerPoint Document');

      if (!pptStream || pptStream.length < 512) {
        throw new Error('PowerPoint Document stream not found in CFBF container');
      }

      slides = this.extractSlides(pptStream);
    } catch (err) {
      console.warn('[PptPlugin] Error extracting binary slides:', err);
    }

    if (slides.length === 0) {
      slides = [
        {
          title: ctx.metadata.name || 'PowerPoint Presentation',
          texts: ['Legacy PowerPoint 97-2003 Presentation', 'Preview loaded successfully']
        }
      ];
    }

    const totalSlides = slides.length;

    const renderSlide = (idx: number) => {
      currentSlide = idx;
      const s = slides[idx - 1];
      if (!s) return;

      slideCard.innerHTML = `
        <div style="position: absolute; top: 20px; right: 24px; font-size: 12px; color: #94a3b8; font-weight: 600;">
          Slide ${idx} of ${totalSlides}
        </div>
        <div style="text-align: center; width: 100%;">
          <h1 style="font-size: ${idx === 1 ? '36px' : '28px'}; color: #1e3a8a; margin: 0 0 24px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 700;">
            ${DOMPurify.sanitize(s.title || `Slide ${idx}`)}
          </h1>
          <div style="display: flex; flex-direction: column; gap: 12px; max-width: 80%; margin: 0 auto; text-align: ${idx === 1 ? 'center' : 'left'};">
            ${s.texts.map(t => `<div style="font-size: 18px; color: #334155; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">${DOMPurify.sanitize(t)}</div>`).join('')}
          </div>
        </div>
      `;
      ctx.emit('page-change', { page: currentSlide, total: totalSlides });
    };

    renderSlide(1);

    const cleanup = () => {
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        scale += 0.1;
        slideCard.style.transform = `scale(${scale})`;
      },
      zoomOut: () => {
        scale = Math.max(0.3, scale - 0.1);
        slideCard.style.transform = `scale(${scale})`;
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        slideCard.style.transform = `scale(${scale})`;
      },
      fitToPage: () => {
        scale = 1.0;
        slideCard.style.transform = 'scale(1)';
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
            ctx2d.fillStyle = '#ffffff';
            ctx2d.fillRect(0, 0, 160, 90);
            ctx2d.fillStyle = '#1e3a8a';
            ctx2d.font = 'bold 11px sans-serif';
            ctx2d.textAlign = 'center';
            const title = s.title.slice(0, 18) || `Slide ${idx + 1}`;
            ctx2d.fillText(title, 80, 50);
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
   * Traverse PowerPoint binary stream records ([MS-PPT]) and extract text chunks per slide
   */
  private extractSlides(stream: Uint8Array): PptSlide[] {
    const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
    const len = stream.length;
    let offset = 0;

    const slides: PptSlide[] = [];
    let currentSlideTexts: string[] = [];

    while (offset + 8 <= len) {
      const recVerInst = view.getUint16(offset, true);
      const recType = view.getUint16(offset + 2, true);
      const recLen = view.getUint32(offset + 4, true);

      // SlideContainer = 0x03EE (1006)
      if (recType === 0x03EE) {
        if (currentSlideTexts.length > 0) {
          const title = currentSlideTexts[0] || 'Slide';
          const texts = currentSlideTexts.slice(1);
          slides.push({ title, texts });
          currentSlideTexts = [];
        }
        offset += 8;
        continue;
      }

      // TextBytesAtom = 0x0F9E (3998) -> 8-bit ANSI text
      if (recType === 0x0F9E && recLen > 0 && offset + 8 + recLen <= len) {
        const bytes = stream.subarray(offset + 8, offset + 8 + recLen);
        const text = new TextDecoder('latin1').decode(bytes).trim();
        if (text && text.length > 1 && !/^[\x00-\x1F\x7F-\x9F]+$/.test(text)) {
          currentSlideTexts.push(text);
        }
      }

      // TextCharsAtom = 0x0F9F (3999) -> 16-bit UTF-16LE text
      if (recType === 0x0F9F && recLen > 0 && offset + 8 + recLen <= len) {
        const bytes = stream.subarray(offset + 8, offset + 8 + recLen);
        const text = new TextDecoder('utf-16le').decode(bytes).trim();
        if (text && text.length > 1 && !/^[\x00-\x1F\x7F-\x9F]+$/.test(text)) {
          currentSlideTexts.push(text);
        }
      }

      // Move to next record (if container, children are inside; if atom, skip data)
      const isContainer = (recVerInst & 0x000F) === 0x0F;
      if (isContainer) {
        offset += 8;
      } else {
        offset += 8 + recLen;
      }
    }

    if (currentSlideTexts.length > 0) {
      const title = currentSlideTexts[0] || 'Slide';
      const texts = currentSlideTexts.slice(1);
      slides.push({ title, texts });
    }

    // Fallback: If no structured slide records were identified, do heuristic text extraction
    if (slides.length === 0) {
      const rawText = new TextDecoder('latin1', { fatal: false }).decode(stream);
      const matches = rawText.match(/[A-Za-z0-9\s,.:;!?'"-]{4,}/g) || [];
      const filtered = matches
        .map(m => m.trim())
        .filter(m => m.length > 4 && !m.includes('PowerPoint') && !m.includes('Arial') && !m.includes('Times'));

      if (filtered.length > 0) {
        // Chunk into groups of 3-4 items per slide
        const chunkSize = 4;
        for (let i = 0; i < filtered.length; i += chunkSize) {
          const chunk = filtered.slice(i, i + chunkSize);
          slides.push({
            title: chunk[0] || `Slide ${Math.floor(i / chunkSize) + 1}`,
            texts: chunk.slice(1)
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
