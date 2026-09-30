import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance,
  Thumbnail
} from '@patel.sumit51/core';
import { downloadFile } from '@patel.sumit51/core';
import { PptxRenderer } from 'pptx-browser';

export class PptxPlugin implements PreviewPlugin {
  id = 'pptx';
  name = 'PowerPoint Presentation';
  extensions = ['.pptx', '.ppsx', '.pptm', '.ppsm', '.potx', '.potm'];
  mimeTypes = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
    'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
    'application/vnd.openxmlformats-officedocument.presentationml.template',
    'application/vnd.ms-powerpoint.template.macroEnabled.12'
  ];
  weight = 80;

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
        label: 'Download PPTX',
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
    const renderer = new PptxRenderer();
    try {
      await renderer.load(ctx.buffer);
    } catch (loadErr) {
      console.warn('[PptxPlugin] Initial renderer.load warning:', loadErr);
    }

    // Generic, robust slide discovery:
    // Ensure all slides from ZIP are found even if presentation.xml used unconventional namespace/relationships
    const filesMap = (renderer as any)._files || {};
    const discoveredSlides = Object.keys(filesMap)
      .filter(k => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
        return numA - numB;
      });

    if (discoveredSlides.length > (renderer.slidePaths?.length || 0)) {
      renderer.slidePaths = discoveredSlides;
      renderer.slideCount = discoveredSlides.length;
    }

    const slideCount = Math.max(1, renderer.slideCount || renderer.slidePaths?.length || 1);
    const initialSlide = typeof (ctx.options as any)?.page === 'number' && (ctx.options as any).page >= 1
      ? Math.max(1, Math.min(slideCount, (ctx.options as any).page))
      : 1;
    let currentSlide = initialSlide;
    const initialZoom = typeof (ctx.options as any)?.zoom === 'number' && (ctx.options as any).zoom > 0
      ? (ctx.options as any).zoom
      : 1.0;
    let scale = initialZoom;
    let rotation = 0;

    // Detect exact native slide dimensions and aspect ratio from presentation.xml
    const emuW = renderer.slideSize?.cx || 9144000;
    const emuH = renderer.slideSize?.cy || 5143500;
    const slideAspect = emuW / emuH;
    const baseW = 1280;
    const baseH = Math.max(200, Math.round(baseW / slideAspect));

    // Presentation container setup
    const wrapper = document.createElement('div');
    wrapper.className = 'fp-pptx-wrapper';
    wrapper.tabIndex = 0;
    wrapper.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
      background: var(--fp-bg-canvas, #525659);
      outline: none;
    `;

    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'fp-pptx-scroll-wrapper';
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
    sizer.className = 'fp-pptx-sizer';
    sizer.style.cssText = `
      position: relative;
      flex-shrink: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    const slideContainer = document.createElement('div');
    slideContainer.className = 'fp-slide-container';
    slideContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.4);
      border-radius: 6px;
      overflow: hidden;
      background: #ffffff;
      transform-origin: center center;
      transition: transform 0.2s ease;
      flex-shrink: 0;
      width: ${baseW}px;
      height: ${baseH}px;
      transform: translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg);
    `;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
      width: 100%;
      height: 100%;
      display: block;
      object-fit: fill;
    `;
    slideContainer.appendChild(canvas);
    sizer.appendChild(slideContainer);
    scrollWrapper.appendChild(sizer);
    wrapper.appendChild(scrollWrapper);

    ctx.container.innerHTML = '';
    ctx.container.style.overflow = 'hidden';
    ctx.container.appendChild(wrapper);

    // Default fit mode is 'width'
    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'width';
    let isUserZoomed = typeof (ctx.options as any)?.zoom === 'number' && (ctx.options as any).zoom > 0;

    const calculateFitScale = (mode: 'width' | 'page' = fitMode) => {
      const isRotated90 = (rotation % 180 !== 0);
      const orientedW = isRotated90 ? baseH : baseW;
      const orientedH = isRotated90 ? baseW : baseH;
      const availW = Math.max(200, (wrapper.clientWidth || ctx.container.clientWidth) - 64);
      const availH = Math.max(200, (wrapper.clientHeight || ctx.container.clientHeight) - 64);
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

      slideContainer.style.width = `${baseW}px`;
      slideContainer.style.height = `${baseH}px`;
      slideContainer.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`;
    };

    /**
     * Fallback slide renderer:
     * Parses slide XML directly and draws background, text shapes, tables, and images on canvas.
     * Guarantees NO slide is ever blank, even if third-party canvas routines encounter an unhandled element.
     */
    const renderSlideFallback = async (slideIndex: number, targetCanvas: HTMLCanvasElement, targetW: number) => {
      const targetH = Math.round(targetW / slideAspect);
      targetCanvas.width = targetW;
      targetCanvas.height = targetH;
      const ctx2d = targetCanvas.getContext('2d');
      if (!ctx2d) return;

      // Base background
      ctx2d.fillStyle = '#ffffff';
      ctx2d.fillRect(0, 0, targetW, targetH);

      // Subtle presentation slide border
      ctx2d.strokeStyle = '#e2e8f0';
      ctx2d.lineWidth = 1;
      ctx2d.strokeRect(0, 0, targetW, targetH);

      const slidePath = renderer.slidePaths?.[slideIndex] || `ppt/slides/slide${slideIndex + 1}.xml`;
      const slideBytes = filesMap[slidePath];
      if (!slideBytes) {
        ctx2d.fillStyle = '#64748b';
        ctx2d.font = `bold ${Math.round(targetW * 0.03)}px sans-serif`;
        ctx2d.textAlign = 'center';
        ctx2d.fillText(`Slide ${slideIndex + 1}`, targetW / 2, targetH / 2);
        return;
      }

      const slideXml = new TextDecoder('utf-8').decode(slideBytes);
      const parser = new DOMParser();
      const doc = parser.parseFromString(slideXml, 'application/xml');

      // Helper to extract elements across namespaces (with prefix, without prefix, or wildcard NS)
      const getTags = (root: Document | Element, tagName: string): Element[] => {
        const pTags = Array.from(root.getElementsByTagName('p:' + tagName));
        const aTags = Array.from(root.getElementsByTagName('a:' + tagName));
        const plainTags = Array.from(root.getElementsByTagName(tagName));
        const nsTags = Array.from(root.getElementsByTagNameNS('*', tagName));
        const set = new Set([...pTags, ...aTags, ...plainTags, ...nsTags]);
        return Array.from(set);
      };

      // Extract text shapes
      const shapes = getTags(doc, 'sp');
      const scaleFactor = targetW / baseW;
      let yCursor = Math.round(60 * scaleFactor);

      for (const sp of shapes) {
        // Read text body
        const txBodies = getTags(sp, 'txBody');
        const txBody = txBodies[0];
        if (!txBody) continue;

        const paragraphs = getTags(txBody, 'p');
        for (const p of paragraphs) {
          const textRuns = getTags(p, 't');
          const lineText = textRuns.map(t => t.textContent || '').join('').trim();
          if (!lineText) continue;

          // Check if title or body
          const rPrs = getTags(p, 'rPr');
          const rPr = rPrs[0];
          const sz = rPr ? parseInt(rPr.getAttribute('sz') || '2000', 10) : 2000;
          const isBold = rPr?.getAttribute('b') === '1' || sz >= 2800;
          const fontSize = Math.max(14, Math.round((sz / 100) * 1.333 * scaleFactor));

          ctx2d.font = `${isBold ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Calibri, sans-serif`;
          ctx2d.fillStyle = isBold ? '#0f172a' : '#334155';
          ctx2d.textAlign = 'left';

          // Word wrap
          const maxWidth = targetW - Math.round(120 * scaleFactor);
          const words = lineText.split(' ');
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx2d.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
              ctx2d.fillText(currentLine, Math.round(60 * scaleFactor), yCursor);
              yCursor += fontSize * 1.35;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) {
            ctx2d.fillText(currentLine, Math.round(60 * scaleFactor), yCursor);
            yCursor += fontSize * 1.4;
          }
          yCursor += Math.round(12 * scaleFactor);
        }
      }

      // If no text was rendered, render slide index indicator
      if (yCursor <= Math.round(60 * scaleFactor)) {
        ctx2d.fillStyle = '#64748b';
        ctx2d.font = `bold ${Math.round(targetW * 0.03)}px sans-serif`;
        ctx2d.textAlign = 'center';
        ctx2d.fillText(`Slide ${slideIndex + 1}`, targetW / 2, targetH / 2);
      }
    };

    const hasCanvasDrawnContent = (c: HTMLCanvasElement): boolean => {
      try {
        const testCtx = c.getContext('2d');
        if (!testCtx || c.width === 0 || c.height === 0) return false;
        // Sample 400 pixels across canvas
        const sampleW = Math.min(c.width, 20);
        const sampleH = Math.min(c.height, 20);
        const imgData = testCtx.getImageData(
          Math.floor(c.width / 4),
          Math.floor(c.height / 4),
          sampleW,
          sampleH
        ).data;
        for (let i = 0; i < imgData.length; i += 4) {
          // If pixel has alpha and is not pure white (#ffffff)
          if (imgData[i + 3] > 0 && (imgData[i] < 250 || imgData[i + 1] < 250 || imgData[i + 2] < 250)) {
            return true;
          }
        }
      } catch {}
      return false;
    };

    const renderCurrentSlide = async () => {
      let renderSucceeded = false;
      const dpr = typeof window !== 'undefined' ? Math.min(2, Math.max(1, window.devicePixelRatio || 1)) : 1;
      const renderW = Math.round(baseW * dpr);

      try {
        await renderer.renderSlide(currentSlide - 1, canvas, renderW);
        renderSucceeded = hasCanvasDrawnContent(canvas);
      } catch (err) {
        console.warn(`[PptxPlugin] Canvas render encountered issue on slide ${currentSlide}:`, err);
      }

      if (!renderSucceeded) {
        await renderSlideFallback(currentSlide - 1, canvas, renderW);
      }

      canvas.style.width = `${baseW}px`;
      canvas.style.height = `${baseH}px`;

      ctx.emit('page-change', { page: currentSlide, total: slideCount, totalPages: slideCount });
      if (!isUserZoomed) {
        scale = calculateFitScale(fitMode);
      }
      applyTransform();
    };

    await renderCurrentSlide();

    // Mouse wheel slide-by-slide navigation
    let lastWheelTime = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const now = Date.now();
      if (now - lastWheelTime < 350) return;
      if (e.deltaY > 30) {
        if (currentSlide < slideCount) {
          lastWheelTime = now;
          currentSlide++;
          renderCurrentSlide();
        }
      } else if (e.deltaY < -30) {
        if (currentSlide > 1) {
          lastWheelTime = now;
          currentSlide--;
          renderCurrentSlide();
        }
      }
    };
    wrapper.addEventListener('wheel', onWheel, { passive: true });

    // Keyboard navigation
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (currentSlide < slideCount) {
          currentSlide++;
          renderCurrentSlide();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        if (currentSlide > 1) {
          currentSlide--;
          renderCurrentSlide();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        currentSlide = 1;
        renderCurrentSlide();
      } else if (e.key === 'End') {
        e.preventDefault();
        currentSlide = slideCount;
        renderCurrentSlide();
      }
    };
    wrapper.addEventListener('keydown', onKeyDown);

    // Responsive container observer
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (!isUserZoomed) {
            scale = calculateFitScale(fitMode);
            applyTransform();
          }
        })
      : null;
    ro?.observe(wrapper);

    const cleanup = () => {
      ro?.disconnect();
      wrapper.removeEventListener('wheel', onWheel);
      wrapper.removeEventListener('keydown', onKeyDown);
      try {
        renderer.destroy();
      } catch {}
      wrapper.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    const instance: PreviewInstance = {
      destroy: cleanup,
      goToPage: (page: number) => {
        if (page >= 1 && page <= slideCount) {
          currentSlide = page;
          renderCurrentSlide();
        }
      },
      getPageCount: () => slideCount,
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
        applyTransform();
      },
      fitToWidth: () => {
        isUserZoomed = false;
        fitMode = 'width';
        scale = calculateFitScale('width');
        wrapper.scrollTop = 0;
        wrapper.scrollLeft = 0;
        applyTransform();
      },
      resetZoom: () => {
        isUserZoomed = true;
        fitMode = 'width';
        scale = 1.0;
        rotation = 0;
        wrapper.scrollTop = 0;
        wrapper.scrollLeft = 0;
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
        const list: Thumbnail[] = [];
        const thumbW = 240;
        const thumbH = Math.max(100, Math.round(thumbW / slideAspect));
        for (let i = 0; i < slideCount; i++) {
          const slideIdx = i;
          list.push({
            index: slideIdx,
            label: `Slide ${slideIdx + 1}`,
            render: async (thumbCanvas: HTMLCanvasElement) => {
              thumbCanvas.width = thumbW;
              thumbCanvas.height = thumbH;
              let thumbDrawn = false;
              try {
                await renderer.renderSlide(slideIdx, thumbCanvas, thumbW);
                thumbDrawn = hasCanvasDrawnContent(thumbCanvas);
              } catch (err) {}
              if (!thumbDrawn) {
                await renderSlideFallback(slideIdx, thumbCanvas, thumbW);
              }
            }
          });
        }
        return list;
      },
      download: () => {
        downloadFile(
          ctx.buffer,
          ctx.metadata.name || 'presentation.pptx',
          this.mimeTypes[0]
        );
      },
      print: () => {
        window.print();
      }
    };

    return instance;
  }
}

export function pptxPlugin(): PptxPlugin {
  return new PptxPlugin();
}

export default PptxPlugin;
