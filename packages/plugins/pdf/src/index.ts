import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance, 
  Thumbnail 
} from '@patel.sumit51/core';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker: 100% local, zero external network dependencies
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  if (!pdfjsLib.GlobalWorkerOptions.workerPort && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const customWorker = (window as any).__PDF_WORKER_SRC__;
    if (customWorker) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = customWorker;
    } else {
      try {
        pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
          new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
          { type: 'module' }
        );
      } catch {
        pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';
      }
    }
  }
}

export class PdfPlugin implements PreviewPlugin {
  id = 'pdf';
  name = 'PDF Document Preview';
  extensions = ['.pdf'];
  mimeTypes = ['application/pdf'];
  weight = 100;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    if (ext) return this.extensions.includes(ext);
    return this.mimeTypes.includes(mime || '');
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    const totalPages = instance.getPageCount?.() ?? 1;
    const curPage = instance.getCurrentPage?.() ?? 1;

    return [
      {
        id: 'thumbnails',
        icon: 'thumbnails',
        label: 'Page Thumbnails',
        type: 'button',
        group: 'navigation',
        execute: () => instance.toggleThumbnails?.()
      },
      {
        id: 'page-nav',
        icon: '',
        label: 'Page Navigation',
        type: 'page-nav',
        group: 'navigation',
        value: curPage,
        max: totalPages,
        execute: (action: unknown, page?: unknown) => {
          const cur = instance.getCurrentPage?.() ?? 1;
          const max = instance.getPageCount?.() ?? 1;
          if (action === 'prev') {
            if (cur > 1) instance.goToPage?.(cur - 1);
          } else if (action === 'next') {
            if (cur < max) instance.goToPage?.(cur + 1);
          } else if (typeof page === 'number') {
            instance.goToPage?.(page);
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
        label: 'Fit to Page',
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
        label: 'Rotate Clockwise',
        type: 'button',
        group: 'view',
        execute: () => instance.rotateCW?.()
      },
      {
        id: 'rotate-ccw',
        icon: 'rotate-ccw',
        label: 'Rotate Counter-Clockwise',
        type: 'button',
        group: 'view',
        execute: () => instance.rotateCCW?.()
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download PDF',
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
    const container = document.createElement('div');
    container.className = 'fp-pdf-container';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflowX = 'hidden';
    container.style.overflowY = 'auto';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'flex-start';
    container.style.padding = '16px 8px';
    container.style.backgroundColor = '#0f172a';
    container.style.boxSizing = 'border-box';
    container.style.position = 'relative';

    const pageCard = document.createElement('div');
    pageCard.className = 'fp-pdf-page-card';
    pageCard.style.boxShadow = '0 10px 35px rgba(0, 0, 0, 0.5)';
    pageCard.style.backgroundColor = '#ffffff';
    pageCard.style.borderRadius = '4px';
    pageCard.style.overflow = 'hidden';
    pageCard.style.lineHeight = '0';
    pageCard.style.position = 'relative';
    pageCard.style.flexShrink = '0';
    pageCard.style.transition = 'box-shadow 0.2s ease';

    let canvas = document.createElement('canvas');
    pageCard.appendChild(canvas);
    container.appendChild(pageCard);
    ctx.container.appendChild(container);

    const standardFontsUrl = (typeof window !== 'undefined' && (window as any).__PDF_STANDARD_FONTS_URL__) || './standard_fonts/';
    const cmapsUrl = (typeof window !== 'undefined' && (window as any).__PDF_CMAPS_URL__) || './cmaps/';

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(ctx.buffer.slice(0)),
      cMapUrl: cmapsUrl,
      cMapPacked: true,
      standardFontDataUrl: standardFontsUrl,
      verbosity: 0,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = Math.max(1, pdfDoc.numPages);

    let currentPage = 1;
    let zoomScale = 1.0;
    let rotation = 0;
    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'width';
    let currentRenderTask: any = null;
    let textLayerDiv: HTMLElement | null = null;

    const renderPage = async (pageNum: number) => {
      if (currentRenderTask) {
        try {
          currentRenderTask.cancel();
        } catch {}
        currentRenderTask = null;
      }

      // Fresh canvas on every render to eliminate PDF.js canvas collision on fast render/rotation
      const newCanvas = document.createElement('canvas');
      pageCard.replaceChild(newCanvas, canvas);
      canvas = newCanvas;

      if (textLayerDiv) {
        textLayerDiv.remove();
        textLayerDiv = null;
      }

      currentPage = Math.max(1, Math.min(totalPages, pageNum));
      ctx.emit('page-change', { page: currentPage, total: totalPages });

      const page = await pdfDoc.getPage(currentPage);

      const containerWidth = container.clientWidth || 900;
      const containerHeight = container.clientHeight || 700;
      const unscaledVp = page.getViewport({ scale: 1.0, rotation });

      // Minimal side margins (16px on each side, safe from vertical scrollbar)
      const availWidth = Math.max(280, containerWidth - 36);
      const availHeight = Math.max(280, containerHeight - 32);
      const scaleW = availWidth / unscaledVp.width;
      const scaleH = availHeight / unscaledVp.height;

      // In 'page' mode: fit page height & width so full document fits comfortably with 0 scroll
      // In 'width' mode: fit page width comfortably for reading with minimal side margins
      let fitScale: number;
      if (fitMode === 'page') {
        fitScale = Math.max(0.2, Math.min(4.0, Math.min(scaleW, scaleH)));
      } else {
        fitScale = Math.max(0.2, Math.min(4.0, scaleW));
      }
      const effectiveScale = (fitScale > 0 ? fitScale : 1.0) * zoomScale;

      const pixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: effectiveScale, rotation });

      const displayWidth = Math.floor(viewport.width);
      const displayHeight = Math.floor(viewport.height);

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      pageCard.style.width = `${displayWidth}px`;
      pageCard.style.height = `${displayHeight}px`;

      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      canvasCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      currentRenderTask = page.render({
        canvasContext: canvasCtx,
        viewport,
      });

      try {
        await currentRenderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('[PdfPlugin] Page render warning:', err);
        }
        return;
      } finally {
        currentRenderTask = null;
      }

      // Render Text Layer for text selection and copying
      try {
        textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = `${displayWidth}px`;
        textLayerDiv.style.height = `${displayHeight}px`;
        textLayerDiv.style.position = 'absolute';
        textLayerDiv.style.top = '0';
        textLayerDiv.style.left = '0';
        textLayerDiv.style.lineHeight = '1';
        pageCard.appendChild(textLayerDiv);

        if ((pdfjsLib as any).TextLayer) {
          const textLayer = new (pdfjsLib as any).TextLayer({
            textContentSource: page.streamTextContent(),
            container: textLayerDiv,
            viewport,
          });
          await textLayer.render();
        }
      } catch (err) {
        // Non-fatal text layer notice
        console.debug('[PdfPlugin] TextLayer notice:', err);
      }
    };

    renderPage(1);

    // Auto-refit on container resize (window resize, thumbnail panel toggle, fullscreen)
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Auto-refit if zoom is near 1.0
        if (Math.abs(zoomScale - 1.0) < 0.05) {
          renderPage(currentPage);
        }
      }, 120);
    });
    resizeObserver.observe(container);

    // Ctrl + Wheel / Trackpad Pinch Zoom
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        zoomScale = Math.max(0.25, Math.min(4.0, Math.round((zoomScale + delta) * 100) / 100));
        renderPage(currentPage);
      }
    };
    container.addEventListener('wheel', onWheel, { passive: false });

    // Keyboard navigation (Left/Right arrows, PageUp/PageDown, Home/End)
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentPage < totalPages) {
          e.preventDefault();
          container.scrollTop = 0;
          renderPage(currentPage + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPage > 1) {
          e.preventDefault();
          container.scrollTop = 0;
          renderPage(currentPage - 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        container.scrollTop = 0;
        renderPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        container.scrollTop = 0;
        renderPage(totalPages);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const cleanup = () => {
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('wheel', onWheel);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (currentRenderTask) {
        try { currentRenderTask.cancel(); } catch {}
      }
      try {
        pdfDoc.destroy();
      } catch {}
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    const instance: PreviewInstance = {
      destroy: cleanup,
      zoomIn: () => {
        zoomScale = Math.min(4.0, Math.round((zoomScale + 0.2) * 10) / 10);
        renderPage(currentPage);
      },
      zoomOut: () => {
        zoomScale = Math.max(0.25, Math.round((zoomScale - 0.2) * 10) / 10);
        renderPage(currentPage);
      },
      getZoom: () => zoomScale,
      setZoom: (level: number) => {
        zoomScale = Math.max(0.25, Math.min(4.0, level));
        renderPage(currentPage);
      },
      fitToPage: () => {
        fitMode = 'page';
        zoomScale = 1.0;
        renderPage(currentPage);
      },
      resetZoom: () => {
        fitMode = 'page';
        zoomScale = 1.0;
        rotation = 0;
        container.scrollTop = 0;
        container.scrollLeft = 0;
        renderPage(currentPage);
      },
      fitToWidth: () => {
        fitMode = 'width';
        zoomScale = 1.0;
        renderPage(currentPage);
      },
      rotateCW: () => {
        rotation = (rotation + 90) % 360;
        renderPage(currentPage);
      },
      rotateCCW: () => {
        rotation = (rotation - 90 + 360) % 360;
        renderPage(currentPage);
      },
      getRotation: () => rotation,
      getPageCount: () => totalPages,
      getCurrentPage: () => currentPage,
      goToPage: (page: number) => {
        container.scrollTop = 0;
        renderPage(page);
      },
      toggleThumbnails: () => {
        (ctx as any)?.toggleThumbnails?.();
      },
      download: () => {
        const blob = new Blob([ctx.buffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'document.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        const blob = new Blob([ctx.buffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const hiddenIframe = document.createElement('iframe');
        hiddenIframe.style.position = 'fixed';
        hiddenIframe.style.right = '0';
        hiddenIframe.style.bottom = '0';
        hiddenIframe.style.width = '0';
        hiddenIframe.style.height = '0';
        hiddenIframe.style.border = '0';
        document.body.appendChild(hiddenIframe);
        hiddenIframe.src = url;
        hiddenIframe.onload = () => {
          setTimeout(() => {
            hiddenIframe.contentWindow?.print();
            setTimeout(() => {
              hiddenIframe.remove();
              URL.revokeObjectURL(url);
            }, 1000);
          }, 300);
        };
      },
      getThumbnails: async (): Promise<Thumbnail[]> => {
        const thumbnails: Thumbnail[] = [];
        const count = totalPages;

        for (let i = 1; i <= count; i++) {
          thumbnails.push({
            index: i,
            label: `Page ${i}`,
            render: async (thumbCanvas: HTMLCanvasElement) => {
              try {
                const p = await pdfDoc.getPage(i);
                const baseVp = p.getViewport({ scale: 1.0, rotation });
                const targetW = thumbCanvas.width || 130;
                const thumbScale = targetW / baseVp.width;
                const thumbVp = p.getViewport({ scale: thumbScale, rotation });
                thumbCanvas.height = Math.floor(thumbVp.height);

                const tCtx = thumbCanvas.getContext('2d');
                if (tCtx) {
                  await p.render({ canvasContext: tCtx, viewport: thumbVp }).promise;
                }
              } catch (e) {
                console.warn(`[PdfPlugin] Error generating thumbnail for page ${i}:`, e);
              }
            }
          });
        }
        return thumbnails;
      }
    };

    return instance;
  }
}

export function pdfPlugin(): PdfPlugin {
  return new PdfPlugin();
}

export default PdfPlugin;
