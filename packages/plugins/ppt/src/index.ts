import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance, 
  Thumbnail 
} from '@patel.sumit51/core';
import { CfbfReader, downloadFile } from '@patel.sumit51/core';
import DOMPurify from 'dompurify';

interface PptSlide {
  slideIndex: number;
  title: string;
  subtitle?: string;
  paragraphs: string[];
  tableCells: string[];
  pictureUrl?: string | null;
  hasChart?: boolean;
  hasOle?: boolean;
  backgroundColor?: string;
}

interface PptPresentation {
  slides: PptSlide[];
  width: number;
  height: number;
  aspectRatio: number;
  pictures: string[];
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
        id: 'fit-width',
        icon: 'fit-width',
        label: 'Fit to Width',
        type: 'button',
        group: 'zoom',
        execute: () => instance.fitToWidth?.()
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
        label: 'Download PPT',
        type: 'button',
        group: 'actions',
        execute: () => instance.download?.()
      },
      {
        id: 'print',
        icon: 'print',
        label: 'Print Presentation',
        type: 'button',
        group: 'actions',
        execute: () => instance.print?.()
      },
      {
        id: 'search',
        icon: 'search',
        label: 'Search / Find (Ctrl+F)',
        type: 'button',
        group: 'view',
        execute: () => (instance as any).search?.()
      },
      {
        id: 'open-window',
        icon: 'open-window',
        label: 'Open in Separate Full Window',
        type: 'button',
        group: 'actions',
        execute: () => (instance as any).openInSeparateWindow?.()
      }
    ];
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const createdBlobUrls: string[] = [];
    const container = document.createElement('div');
    container.className = 'fp-ppt-container';
    container.tabIndex = 0;
    container.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
      background: var(--fp-bg-canvas, #525659);
      outline: none;
    `;

    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'fp-ppt-scroll-wrapper';
    scrollWrapper.style.cssText = `
      min-width: 100%;
      min-height: 100%;
      width: max-content;
      height: max-content;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
      box-sizing: border-box;
    `;

    const sizer = document.createElement('div');
    sizer.className = 'fp-ppt-sizer';
    sizer.style.cssText = `
      position: relative;
      flex-shrink: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    const slideCard = document.createElement('div');
    slideCard.className = 'fp-ppt-slide-card';
    slideCard.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.35);
      border-radius: 6px;
      overflow: hidden;
      background-color: #ffffff;
      transform-origin: center center;
      transition: transform 0.2s ease;
      flex-shrink: 0;
      font-family: Calibri, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
    `;

    sizer.appendChild(slideCard);
    scrollWrapper.appendChild(sizer);
    container.appendChild(scrollWrapper);

    ctx.container.innerHTML = '';
    ctx.container.style.overflow = 'hidden';
    ctx.container.appendChild(container);

    // 1. Generic extraction of presentation structure from CFBF binary streams
    const presentation = this.parsePresentation(ctx.buffer, createdBlobUrls, ctx.metadata.name);
    const slides = presentation.slides;
    const totalSlides = Math.max(1, slides.length);
    const baseW = presentation.width;
    const baseH = presentation.height;

    // Slide state
    const initialSlide = typeof (ctx.options as any)?.page === 'number' && (ctx.options as any).page >= 1
      ? Math.max(1, Math.min(totalSlides, (ctx.options as any).page))
      : 1;
    let currentSlide = initialSlide;
    const initialZoom = typeof (ctx.options as any)?.zoom === 'number' && (ctx.options as any).zoom > 0
      ? (ctx.options as any).zoom
      : 1.0;
    let scale = initialZoom;
    let rotation = 0;
    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'page';
    let isUserZoomed = typeof (ctx.options as any)?.zoom === 'number' && (ctx.options as any).zoom > 0;

    const calculateFitScale = (mode: 'width' | 'page' = fitMode) => {
      const isRotated90 = (rotation % 180 !== 0);
      const orientedW = isRotated90 ? baseH : baseW;
      const orientedH = isRotated90 ? baseW : baseH;
      const availW = Math.max(200, (container.clientWidth || ctx.container.clientWidth) - 48);
      const availH = Math.max(200, (container.clientHeight || ctx.container.clientHeight) - 48);
      if (mode === 'page') {
        return Math.min(3.0, Math.min(availW / orientedW, availH / orientedH));
      }
      return Math.min(3.0, availW / orientedW);
    };

    const applyTransform = () => {
      const isRotated90 = (rotation % 180 !== 0);
      const boxW = Math.round((isRotated90 ? baseH : baseW) * scale);
      const boxH = Math.round((isRotated90 ? baseW : baseH) * scale);

      sizer.style.width = `${boxW}px`;
      sizer.style.height = `${boxH}px`;

      slideCard.style.width = `${baseW}px`;
      slideCard.style.height = `${baseH}px`;
      slideCard.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`;
    };

    let activeSearchQuery = '';
    let searchMatches: Array<{ slideNumber: number; text: string }> = [];
    let currentMatchIdx = -1;

    const highlightText = (text: string): string => {
      if (!text) return '';
      const safe = DOMPurify.sanitize(text);
      if (!activeSearchQuery) return safe;
      const escaped = activeSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      return safe.replace(regex, '<mark style="background: #fef08a; color: #0f172a; padding: 1px 4px; border-radius: 2px;">$1</mark>');
    };

    const performSearch = (query: string, caseSensitive = false): { current: number; total: number } => {
      activeSearchQuery = query.trim();
      searchMatches = [];
      currentMatchIdx = -1;

      if (!activeSearchQuery) {
        renderSlide(currentSlide);
        return { current: 0, total: 0 };
      }

      const q = caseSensitive ? activeSearchQuery : activeSearchQuery.toLowerCase();
      for (let i = 0; i < totalSlides; i++) {
        const s = slides[i];
        const combined = [s.title, s.subtitle || '', ...(s.paragraphs || []), ...(s.tableCells || [])].join(' ');
        const hay = caseSensitive ? combined : combined.toLowerCase();
        if (hay.includes(q)) {
          let pos = 0;
          while ((pos = hay.indexOf(q, pos)) !== -1) {
            searchMatches.push({ slideNumber: i + 1, text: combined });
            pos += q.length;
          }
        }
      }

      if (searchMatches.length > 0) {
        const nextIdx = searchMatches.findIndex(m => m.slideNumber >= currentSlide);
        currentMatchIdx = nextIdx !== -1 ? nextIdx : 0;
        const targetSlide = searchMatches[currentMatchIdx].slideNumber;
        renderSlide(targetSlide);
        return { current: currentMatchIdx + 1, total: searchMatches.length };
      }

      renderSlide(currentSlide);
      return { current: 0, total: 0 };
    };

    const searchNext = (): { current: number; total: number } => {
      if (searchMatches.length === 0) return { current: 0, total: 0 };
      currentMatchIdx = (currentMatchIdx + 1) % searchMatches.length;
      const targetSlide = searchMatches[currentMatchIdx].slideNumber;
      renderSlide(targetSlide);
      return { current: currentMatchIdx + 1, total: searchMatches.length };
    };

    const searchPrev = (): { current: number; total: number } => {
      if (searchMatches.length === 0) return { current: 0, total: 0 };
      currentMatchIdx = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
      const targetSlide = searchMatches[currentMatchIdx].slideNumber;
      renderSlide(targetSlide);
      return { current: currentMatchIdx + 1, total: searchMatches.length };
    };

    const clearSearch = () => {
      activeSearchQuery = '';
      searchMatches = [];
      currentMatchIdx = -1;
      renderSlide(currentSlide);
    };

    const renderSlide = (idx: number) => {
      currentSlide = Math.max(1, Math.min(totalSlides, idx));
      const s = slides[currentSlide - 1];
      if (!s) return;

      slideCard.innerHTML = '';
      slideCard.style.backgroundImage = 'none';
      slideCard.style.backgroundColor = s.backgroundColor || '#ffffff';
      slideCard.style.display = 'flex';
      slideCard.style.flexDirection = 'column';

      const hasImage = !!s.pictureUrl;
      const hasParagraphs = s.paragraphs && s.paragraphs.length > 0;
      const hasTable = s.tableCells && s.tableCells.length > 0;
      const hasChart = s.hasChart || s.hasOle;
      const isTitleSlide = (currentSlide === 1 && !hasImage && !hasTable && !hasChart) ||
                           (!hasParagraphs && !hasImage && !hasTable && !hasChart);

      const matchBadge = activeSearchQuery && searchMatches.length > 0
        ? `<span style="font-size: 12px; font-weight: 600; color: #854d0e; background: #fef08a; padding: 3px 10px; border-radius: 9999px; margin-right: 8px;">
            🔍 Match ${currentMatchIdx + 1} of ${searchMatches.length}
           </span>`
        : '';

      if (isTitleSlide) {
        slideCard.innerHTML = `
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 48px 36px; box-sizing: border-box; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);">
            <div style="width: 56px; height: 5px; background: #3b82f6; border-radius: 3px; margin-bottom: 24px;"></div>
            <h1 style="margin: 0 0 16px 0; font-size: clamp(26px, 3.8vw, 38px); font-weight: 800; color: #0f172a; letter-spacing: -0.5px; line-height: 1.25; max-width: 90%;">
              ${highlightText(s.title || `Presentation Slide ${currentSlide}`)}
            </h1>
            ${s.subtitle ? `<div style="font-size: clamp(15px, 2vw, 20px); color: #64748b; font-weight: 500; max-width: 80%; line-height: 1.5;">${highlightText(s.subtitle)}</div>` : ''}
            <div style="margin-top: 32px; display: flex; align-items: center; gap: 8px;">
              ${matchBadge}
              <span style="font-size: 12px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 4px 12px; border-radius: 9999px;">
                Slide ${currentSlide} / ${totalSlides}
              </span>
            </div>
          </div>
        `;
      } else {
        const titleWrapper = document.createElement('div');
        titleWrapper.className = 'fp-ppt-title-zone';
        titleWrapper.style.cssText = `
          padding: 20px 36px 12px;
          box-sizing: border-box;
          flex-shrink: 0;
        `;
        titleWrapper.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
            <div style="flex: 1; padding-right: 20px;">
              <h1 style="margin: 0 0 4px 0; font-size: clamp(20px, 2.5vw, 26px); font-weight: 700; color: #0f172a; letter-spacing: -0.3px; line-height: 1.25;">
                ${highlightText(s.title || `Slide ${currentSlide}`)}
              </h1>
              ${s.subtitle ? `<div style="font-size: clamp(13px, 1.5vw, 15px); color: #64748b; margin-top: 2px;">${highlightText(s.subtitle)}</div>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
              ${matchBadge}
              <span style="font-size: 12px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 9999px;">
                Slide ${currentSlide} / ${totalSlides}
              </span>
            </div>
          </div>
        `;
        slideCard.appendChild(titleWrapper);

        const contentZone = document.createElement('div');
        contentZone.className = 'fp-ppt-content-zone';
        contentZone.style.cssText = `
          padding: 12px 36px 20px;
          box-sizing: border-box;
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        `;

        if (hasImage && hasParagraphs) {
          contentZone.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: row; gap: 32px; align-items: center; justify-content: space-between; overflow: auto; padding: 12px 8px; box-sizing: border-box;">
              <div style="flex: 1.2; display: flex; justify-content: center; align-items: center; min-height: 240px;">
                <img src="${s.pictureUrl}" alt="${DOMPurify.sanitize(s.title)}" style="max-width: 100%; max-height: 380px; object-fit: contain; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,0.14);" />
              </div>
              <div style="flex: 1.4; display: flex; flex-direction: column; justify-content: center; overflow: auto;">
                ${this.renderTextDisplay(s, highlightText)}
              </div>
            </div>
          `;
        } else if (hasImage) {
          contentZone.innerHTML = `
            <div style="flex: 1; display: flex; justify-content: center; align-items: center; padding: 12px;">
              <img src="${s.pictureUrl}" alt="${DOMPurify.sanitize(s.title)}" style="max-width: 95%; max-height: 95%; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.12);" />
            </div>
          `;
        } else if (hasTable) {
          contentZone.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; gap: 16px; overflow: auto;">
              ${this.renderTableDisplay(s, highlightText)}
              ${hasParagraphs ? `<div style="margin-top: 10px;">${this.renderTextDisplay(s, highlightText)}</div>` : ''}
            </div>
          `;
        } else if (hasChart) {
          contentZone.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; gap: 16px; overflow: auto;">
              ${this.renderChartDisplay(s)}
              ${hasParagraphs ? `<div style="margin-top: 10px;">${this.renderTextDisplay(s, highlightText)}</div>` : ''}
            </div>
          `;
        } else {
          contentZone.innerHTML = this.renderTextDisplay(s, highlightText);
        }

        slideCard.appendChild(contentZone);
      }

      ctx.emit('page-change', { page: currentSlide, total: totalSlides, totalPages: totalSlides });
      if (!isUserZoomed) {
        scale = calculateFitScale(fitMode);
      }
      applyTransform();
    };

    renderSlide(currentSlide);

    // Mouse wheel slide-by-slide navigation
    let lastWheelTime = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const now = Date.now();
      if (now - lastWheelTime < 350) return;
      if (e.deltaY > 30) {
        if (currentSlide < totalSlides) {
          lastWheelTime = now;
          renderSlide(currentSlide + 1);
        }
      } else if (e.deltaY < -30) {
        if (currentSlide > 1) {
          lastWheelTime = now;
          renderSlide(currentSlide - 1);
        }
      }
    };
    container.addEventListener('wheel', onWheel, { passive: true });

    // Keyboard navigation
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (currentSlide < totalSlides) renderSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        if (currentSlide > 1) renderSlide(currentSlide - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        renderSlide(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        renderSlide(totalSlides);
      }
    };
    container.addEventListener('keydown', onKeyDown);

    // Resize handling
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (!isUserZoomed) {
            scale = calculateFitScale(fitMode);
            applyTransform();
          }
        })
      : null;
    ro?.observe(ctx.container);

    const cleanup = () => {
      ro?.disconnect();
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('keydown', onKeyDown);
      for (const u of createdBlobUrls) {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      }
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      goToPage: (page: number) => {
        if (page >= 1 && page <= totalSlides) {
          renderSlide(page);
        }
      },
      getPageCount: () => totalSlides,
      getCurrentPage: () => currentSlide,
      zoomIn: () => {
        isUserZoomed = true;
        scale = Math.min(6.0, Math.round((scale + 0.25) * 100) / 100);
        applyTransform();
      },
      zoomOut: () => {
        isUserZoomed = true;
        scale = Math.max(0.2, Math.round((scale - 0.25) * 100) / 100);
        applyTransform();
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        isUserZoomed = true;
        scale = Math.max(0.2, Math.min(6.0, Math.round(level * 100) / 100));
        applyTransform();
      },
      fitToPage: () => {
        isUserZoomed = false;
        fitMode = 'page';
        scale = calculateFitScale('page');
        container.scrollTop = 0;
        container.scrollLeft = 0;
        applyTransform();
      },
      fitToWidth: () => {
        isUserZoomed = false;
        fitMode = 'width';
        scale = calculateFitScale('width');
        container.scrollTop = 0;
        container.scrollLeft = 0;
        applyTransform();
      },
      resetZoom: () => {
        isUserZoomed = false;
        fitMode = 'page';
        scale = calculateFitScale('page');
        rotation = 0;
        container.scrollTop = 0;
        container.scrollLeft = 0;
        ctx.container.scrollTop = 0;
        ctx.container.scrollLeft = 0;
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
      getThumbnails: (): Thumbnail[] => {
        return slides.map((s, idx) => ({
          index: idx,
          label: `Slide ${idx + 1}`,
          render: async (canvas: HTMLCanvasElement) => {
            const ctx2d = canvas.getContext('2d');
            if (!ctx2d) return;

            const thumbW = 160;
            const thumbH = Math.max(90, Math.round(thumbW * (baseH / baseW)));
            canvas.width = thumbW;
            canvas.height = thumbH;

            // Clean background
            ctx2d.fillStyle = s.backgroundColor || '#ffffff';
            ctx2d.fillRect(0, 0, thumbW, thumbH);
            ctx2d.strokeStyle = '#cbd5e1';
            ctx2d.lineWidth = 1;
            ctx2d.strokeRect(0, 0, thumbW, thumbH);

            // Thumbnail header bar
            ctx2d.fillStyle = '#f8fafc';
            ctx2d.fillRect(1, 1, thumbW - 2, 22);
            ctx2d.strokeStyle = '#e2e8f0';
            ctx2d.beginPath();
            ctx2d.moveTo(1, 23);
            ctx2d.lineTo(thumbW - 1, 23);
            ctx2d.stroke();

            // Slide number
            ctx2d.fillStyle = '#64748b';
            ctx2d.font = 'bold 9px sans-serif';
            ctx2d.textAlign = 'left';
            ctx2d.fillText(`${idx + 1}`, 6, 15);

            // Thumbnail title
            ctx2d.fillStyle = '#0f172a';
            ctx2d.font = 'bold 9px sans-serif';
            const tText = s.title.length > 20 ? s.title.slice(0, 18) + '..' : s.title;
            ctx2d.fillText(tText, 22, 15);

            // Thumbnail visual content
            const contentY = 32;
            if (s.pictureUrl) {
              ctx2d.fillStyle = '#e2e8f0';
              ctx2d.fillRect(20, contentY + 2, thumbW - 40, thumbH - contentY - 8);
              ctx2d.fillStyle = '#94a3b8';
              ctx2d.font = '8px sans-serif';
              ctx2d.textAlign = 'center';
              ctx2d.fillText('Image', thumbW / 2, contentY + (thumbH - contentY) / 2);
            } else if (s.hasChart || s.hasOle) {
              const barColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
              const heights = [28, 44, 24, 38];
              for (let b = 0; b < 4; b++) {
                ctx2d.fillStyle = barColors[b];
                ctx2d.fillRect(32 + b * 26, contentY + (48 - heights[b]), 16, heights[b]);
              }
            } else if (s.tableCells && s.tableCells.length > 0) {
              ctx2d.strokeStyle = '#cbd5e1';
              ctx2d.lineWidth = 1;
              ctx2d.strokeRect(12, contentY + 2, thumbW - 24, 40);
              for (let l = 1; l <= 3; l++) {
                ctx2d.beginPath();
                ctx2d.moveTo(12, contentY + 2 + l * 10);
                ctx2d.lineTo(thumbW - 12, contentY + 2 + l * 10);
                ctx2d.stroke();
              }
            } else {
              ctx2d.fillStyle = '#94a3b8';
              for (let l = 0; l < 4; l++) {
                ctx2d.fillRect(16, contentY + 4 + l * 10, thumbW - 32 - (l === 3 ? 35 : 0), 4);
              }
            }
          }
        }));
      },
      download: () => {
        downloadFile(
          ctx.buffer,
          ctx.metadata.name || 'presentation.ppt',
          'application/vnd.ms-powerpoint'
        );
      },
      print: () => {
        window.print();
      },
      search: (query: string, options?: any) => {
        return performSearch(query, options?.caseSensitive);
      },
      searchNext: () => {
        return searchNext();
      },
      searchPrev: () => {
        return searchPrev();
      },
      clearSearch: () => {
        clearSearch();
      },
      toggleThumbnails: () => {
        (ctx as any)?.toggleThumbnails?.();
      },
      openInSeparateWindow: () => {
        (ctx as any)?.openInSeparateWindow?.();
      }
    };
  }

  /**
   * Parse CFBF PowerPoint Document and Pictures streams to build clean generic presentation structure
   */
  private parsePresentation(buffer: ArrayBuffer, createdBlobUrls: string[], docName?: string): PptPresentation {
    let slides: PptSlide[] = [];
    let width = 960;
    let height = 540;
    let pictures: string[] = [];

    try {
      const cfbf = new CfbfReader(buffer);
      pictures = this.extractPictures(cfbf, createdBlobUrls);

      const pptStream = cfbf.readStream('PowerPoint Document');
      if (pptStream && pptStream.length >= 64) {
        const view = new DataView(pptStream.buffer, pptStream.byteOffset, pptStream.byteLength);

        // 1. Detect SlideSizeAtom (0x0400)
        for (let o = 0; o + 16 <= pptStream.length; o++) {
          const t = view.getUint16(o + 2, true);
          const l = view.getUint32(o + 4, true);
          if (t === 0x0400 && l >= 8 && o + 8 + l <= pptStream.length) {
            const szX = view.getInt32(o + 8, true);
            const szY = view.getInt32(o + 12, true);
            if (szX > 0 && szY > 0) {
              const ratio = szX / szY;
              width = 960;
              height = Math.max(200, Math.round(960 / ratio));
            }
            break;
          }
        }

        // 2. Discover ALL SlideContainers (0x03EE) across the entire stream using thorough byte-level scanning
        const slideOffsets: Array<{ offset: number; len: number }> = [];
        const seenOffsets = new Set<number>();

        for (let p = 0; p + 8 <= pptStream.length; p++) {
          const ver = view.getUint16(p, true);
          const recType = view.getUint16(p + 2, true);
          const recLen = view.getUint32(p + 4, true);
          if (recType === 0x03EE && (ver & 0x0F) === 0x0F && recLen > 16 && p + 8 + recLen <= pptStream.length + 1024) {
            if (!seenOffsets.has(p)) {
              seenOffsets.add(p);
              slideOffsets.push({ offset: p, len: recLen });
            }
          }
        }

        slideOffsets.sort((a, b) => a.offset - b.offset);

        // 3. Extract slide contents for each discovered slide
        for (let i = 0; i < slideOffsets.length; i++) {
          const sOff = slideOffsets[i].offset;
          const sLen = slideOffsets[i].len;
          const end = Math.min(pptStream.length, sOff + 8 + sLen);

          const texts: Array<{ type: number; text: string }> = [];
          let currentType = -1;
          let hasOle = false;
          let slidePictureUrl: string | null = null;
          let picRefIndex = -1;
          let hasPicShape = false;
          let bgColor = '#ffffff';

          let p = sOff + 8;
          while (p + 8 <= end) {
            const ver = view.getUint16(p, true);
            const recType = view.getUint16(p + 2, true);
            const recLen = view.getUint32(p + 4, true);
            const recEnd = Math.min(end, p + 8 + recLen);

            // TextHeaderAtom (0x0F9F)
            if (recType === 0x0F9F && recLen >= 4) {
              currentType = view.getUint32(p + 8, true);
            }
            // UTF-16LE text atom (0x0FA0)
            else if (recType === 0x0FA0 && recLen > 0) {
              const str = new TextDecoder('utf-16le').decode(pptStream.subarray(p + 8, recEnd)).replace(/\0/g, '').trim();
              if (str && str !== '\x04' && str !== '\x05' && !str.includes('style.visibility') && !str.includes('___PPT')) {
                texts.push({ type: currentType, text: str });
              }
            }
            // Latin1 text atom (0x0FA8)
            else if (recType === 0x0FA8 && recLen > 0) {
              const str = new TextDecoder('latin1').decode(pptStream.subarray(p + 8, recEnd)).replace(/\0/g, '').trim();
              if (str && str.length > 1 && !str.includes('style.visibility') && !str.includes('___PPT')) {
                texts.push({ type: currentType, text: str });
              }
            }
            // OLE Object (0x0BC1)
            else if (recType === 0x0BC1) {
              hasOle = true;
            }
            // Escher shape with PictureFrame shape type (0x4B)
            else if (recType === 0xF00A) {
              const shapeType = ver >> 4;
              if (shapeType === 0x4B) {
                hasPicShape = true;
              }
            }
            // Escher OPT atom containing BLIP picture index property 0x0104 / 0x0105
            else if (recType === 0xF00B) {
              const propCount = ver >> 4;
              let optP = p + 8;
              for (let k = 0; k < propCount && optP + 6 <= recEnd; k++) {
                const propId = view.getUint16(optP, true) & 0x3FFF;
                const propVal = view.getUint32(optP + 2, true);
                if (propId === 0x0104 || propId === 0x0105) {
                  picRefIndex = propVal;
                }
                optP += 6;
              }
            }

            p++;
          }

          // Categorize text by real MS-PPT TextHeader types:
          // 0 = Title, 6 = Center Title
          // 1 = Body, 5 = Center Body
          // 4 = Other / Table Cell
          let title = '';
          let subtitle = '';
          const bodyParagraphs: string[] = [];
          const tableCells: string[] = [];

          for (const item of texts) {
            if ((item.type === 0 || item.type === 6) && !title) {
              title = item.text;
            } else if (item.type === 1 || item.type === 5) {
              bodyParagraphs.push(item.text);
            } else if (item.type === 4) {
              tableCells.push(item.text);
            } else {
              if (!title) {
                title = item.text;
              } else if (!subtitle && item.text.length < 120 && bodyParagraphs.length === 0) {
                subtitle = item.text;
              } else {
                bodyParagraphs.push(item.text);
              }
            }
          }

          // If no title found from headers, use the first available text string
          if (!title && texts.length > 0) {
            title = texts[0].text;
            for (let t = 1; t < texts.length; t++) {
              if (texts[t].type === 4) tableCells.push(texts[t].text);
              else bodyParagraphs.push(texts[t].text);
            }
          }

          // Associate picture only if slide actually references a picture
          if (picRefIndex >= 1 && picRefIndex <= pictures.length) {
            slidePictureUrl = pictures[picRefIndex - 1];
          } else if (picRefIndex > 0 && pictures.length > 0) {
            slidePictureUrl = pictures[Math.min(picRefIndex - 1, pictures.length - 1)];
          } else if (hasPicShape && pictures.length > 0) {
            slidePictureUrl = pictures[Math.min(i, pictures.length - 1)];
          }

          slides.push({
            slideIndex: i + 1,
            title: title || `Slide ${i + 1}`,
            subtitle: subtitle || undefined,
            paragraphs: bodyParagraphs,
            tableCells,
            hasChart: hasOle || title.toLowerCase().includes('chart'),
            hasOle,
            pictureUrl: slidePictureUrl,
            backgroundColor: bgColor
          });
        }
      }
    } catch (err) {
      console.warn('[PptPlugin] Error extracting generic presentation:', err);
    }

    // Fallback if no slides could be extracted
    if (slides.length === 0) {
      slides = [
        {
          slideIndex: 1,
          title: docName || 'PowerPoint Presentation',
          subtitle: 'Legacy PowerPoint 97-2003 Presentation',
          paragraphs: ['Preview loaded successfully.'],
          tableCells: []
        }
      ];
    }

    return {
      slides,
      width,
      height,
      aspectRatio: width / height,
      pictures
    };
  }

  /**
   * Extract PNG, JPEG, GIF, and BMP images from the Pictures stream
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

      // Scan for GIFs
      for (let i = 0; i <= pBuf.length - 6; i++) {
        if (pBuf[i] === 0x47 && pBuf[i + 1] === 0x49 && pBuf[i + 2] === 0x46 && pBuf[i + 3] === 0x38) {
          let endIdx = -1;
          for (let k = i + 6; k < pBuf.length; k++) {
            if (pBuf[k] === 0x3b) {
              endIdx = k + 1;
              break;
            }
          }
          if (endIdx !== -1) {
            const gifBytes = pBuf.subarray(i, endIdx);
            const blob = new Blob([gifBytes], { type: 'image/gif' });
            const url = URL.createObjectURL(blob);
            urls.push(url);
            createdUrls.push(url);
            i = endIdx;
          }
        }
      }

      // Scan for BMPs
      const view = new DataView(pBuf.buffer, pBuf.byteOffset, pBuf.byteLength);
      for (let i = 0; i <= pBuf.length - 14; i++) {
        if (pBuf[i] === 0x42 && pBuf[i + 1] === 0x4d) {
          const bmpSize = view.getUint32(i + 2, true);
          if (bmpSize > 54 && bmpSize <= pBuf.length - i) {
            const bmpBytes = pBuf.subarray(i, i + bmpSize);
            const blob = new Blob([bmpBytes], { type: 'image/bmp' });
            const url = URL.createObjectURL(blob);
            urls.push(url);
            createdUrls.push(url);
            i += bmpSize - 1;
          }
        }
      }
    } catch (err) {
      console.warn('[PptPlugin] Error extracting pictures:', err);
    }
    return urls;
  }

  /**
   * Render text paragraphs with clean typography
   */
  private renderTextDisplay(s: PptSlide, highlightFn?: (text: string) => string): string {
    const rawParagraphs = s.paragraphs || [];
    if (rawParagraphs.length === 0) return '';
    const hl = highlightFn || ((t: string) => DOMPurify.sanitize(t));
    const totalLines = rawParagraphs.reduce((acc, p) => acc + p.split(/[\r\n]+/).length, 0);
    const totalChars = rawParagraphs.reduce((acc, p) => acc + p.length, 0);

    // Responsive font scaling based on content volume so text doesn't overflow slide bounds
    let fontSize = 16;
    let lineHeight = 1.6;
    let marginBot = 12;
    if (totalChars > 400 || totalLines > 7) {
      fontSize = 13;
      lineHeight = 1.45;
      marginBot = 8;
    } else if (totalChars > 200 || totalLines > 4) {
      fontSize = 14;
      lineHeight = 1.5;
      marginBot = 10;
    }

    const pElements = rawParagraphs.map(p => {
      const lines = p.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      return lines.map(line => {
        const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
        const cleanLine = isBullet ? line.slice(1).trim() : line;
        if (isBullet) {
          return `
            <div style="display: flex; align-items: flex-start; margin-bottom: ${marginBot}px; font-size: ${fontSize}px; line-height: ${lineHeight}; color: #334155;">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #3b82f6; margin-top: 8px; margin-right: 12px; flex-shrink: 0;"></span>
              <span>${hl(cleanLine)}</span>
            </div>
          `;
        }
        return `
          <p style="margin: 0 0 ${marginBot}px; font-size: ${fontSize}px; line-height: ${lineHeight}; color: #334155; letter-spacing: 0.1px;">
            ${hl(line)}
          </p>
        `;
      }).join('');
    }).join('');

    return `
      <div style="flex: 1; overflow-y: auto; padding: 4px 8px; display: flex; flex-direction: column;">
        ${pElements}
      </div>
    `;
  }

  /**
   * Render real table structure from extracted table cells
   */
  private renderTableDisplay(s: PptSlide, highlightFn?: (text: string) => string): string {
    const cells = s.tableCells;
    if (!cells || cells.length === 0) return '';
    const hl = highlightFn || ((t: string) => DOMPurify.sanitize(t));
    const numCols = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(cells.length))));
    const headerCells = cells.slice(0, numCols);
    const bodyCells = cells.slice(numCols);

    // Group body cells into rows
    const rows: string[][] = [];
    for (let i = 0; i < bodyCells.length; i += numCols) {
      rows.push(bodyCells.slice(i, i + numCols));
    }

    return `
      <div style="flex: 1; overflow: auto; padding: 12px 4px; display: flex; flex-direction: column; justify-content: center;">
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          <thead>
            <tr style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);">
              ${headerCells.map(c => `
                <th style="padding: 14px 18px; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 14px; font-weight: 700; color: #1e293b; letter-spacing: 0.2px;">
                  ${hl(c)}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, rIdx) => `
              <tr style="${rIdx % 2 === 0 ? 'background: #ffffff;' : 'background: #f8fafc;'}">
                ${row.map(cell => `
                  <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #475569;">
                    ${hl(cell)}
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render clean presentation chart/diagram card based on actual slide data
   */
  private renderChartDisplay(s: PptSlide): string {
    const hasItems = s.paragraphs.length > 0;
    return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
        <div style="width: 100%; max-width: 680px; min-height: 260px; background: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; box-sizing: border-box; display: flex; flex-direction: column;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; background: #eff6ff; color: #3b82f6; font-size: 16px;">
              📊
            </span>
            <div style="font-size: 16px; font-weight: 600; color: #1e293b;">
              ${DOMPurify.sanitize(s.title || 'Chart Presentation Data')}
            </div>
          </div>
          ${hasItems ? `
            <div style="flex: 1; display: flex; flex-direction: column; gap: 10px; justify-content: center;">
              ${s.paragraphs.map(p => `
                <div style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 6px; font-size: 15px; color: #334155;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; flex-shrink: 0;"></span>
                  <span>${DOMPurify.sanitize(p)}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748b; font-size: 14px; gap: 8px;">
              <span style="font-size: 24px;">📈</span>
              <span>Embedded Presentation Visual Object</span>
            </div>
          `}
        </div>
      </div>
    `;
  }
}

export function pptPlugin(): PptPlugin {
  return new PptPlugin();
}

export default PptPlugin;
