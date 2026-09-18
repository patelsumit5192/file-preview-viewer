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
        id: 'rotate-cw',
        icon: 'rotate-cw',
        label: 'Rotate Clockwise',
        type: 'button',
        group: 'view',
        execute: () => instance.rotateCW?.()
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
    container.style.overflow = 'auto';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'flex-start';
    container.style.padding = '20px 16px';
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
    pageCard.style.transition = 'transform 0.15s ease';
    pageCard.style.position = 'relative';
    pageCard.style.flexShrink = '0';

    let canvas = document.createElement('canvas');
    pageCard.appendChild(canvas);
    container.appendChild(pageCard);

    const indicator = document.createElement('div');
    indicator.className = 'fp-pdf-page-indicator';
    indicator.style.position = 'sticky';
    indicator.style.bottom = '16px';
    indicator.style.marginTop = '16px';
    indicator.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
    indicator.style.backdropFilter = 'blur(8px)';
    indicator.style.color = '#f8fafc';
    indicator.style.fontSize = '12px';
    indicator.style.fontWeight = '600';
    indicator.style.padding = '5px 14px';
    indicator.style.borderRadius = '20px';
    indicator.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    indicator.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    indicator.style.zIndex = '10';
    indicator.style.userSelect = 'none';
    indicator.style.pointerEvents = 'none';
    container.appendChild(indicator);

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
    let fitMode: 'width' | 'page' = 'page';
    let currentRenderTask: any = null;

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

      currentPage = Math.max(1, Math.min(totalPages, pageNum));
      indicator.textContent = `Page ${currentPage} of ${totalPages}`;
      ctx.emit('page-change', { page: currentPage, total: totalPages });

      const page = await pdfDoc.getPage(currentPage);

      const containerWidth = container.clientWidth || 900;
      const containerHeight = container.clientHeight || 700;
      const unscaledVp = page.getViewport({ scale: 1.0, rotation });

      const availWidth = Math.max(320, containerWidth - 48);
      const availHeight = Math.max(550, containerHeight - 88);
      const scaleW = availWidth / unscaledVp.width;
      const scaleH = availHeight / unscaledVp.height;

      // In 'page' mode: fit page height & width so full document fits comfortably
      // In 'width' mode: fit page width comfortably for reading
      let fitScale: number;
      if (fitMode === 'page') {
        fitScale = Math.max(0.4, Math.min(scaleW, scaleH));
      } else {
        fitScale = Math.max(0.65, Math.min(1.25, scaleW));
      }
      const effectiveScale = (fitScale > 0 ? fitScale : 1.0) * zoomScale;

      const pixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: effectiveScale, rotation });

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

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
      } finally {
        currentRenderTask = null;
      }
    };

    renderPage(1);

    // Auto-refit on container resize (window resize, panel toggle, fullscreen)
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Only auto-refit if zoom is at default (not user-zoomed)
        if (Math.abs(zoomScale - 1.0) < 0.05) {
          renderPage(currentPage);
        }
      }, 150);
    });
    resizeObserver.observe(container);

    const cleanup = () => {
      resizeObserver.disconnect();
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
        zoomScale = Math.min(3.5, zoomScale + 0.2);
        renderPage(currentPage);
      },
      zoomOut: () => {
        zoomScale = Math.max(0.3, zoomScale - 0.2);
        renderPage(currentPage);
      },
      getZoom: () => zoomScale,
      setZoom: (level: number) => {
        zoomScale = Math.max(0.3, Math.min(3.5, level));
        renderPage(currentPage);
      },
      fitToPage: () => {
        fitMode = fitMode === 'page' ? 'width' : 'page';
        zoomScale = 1.0;
        rotation = 0;
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
        const count = Math.min(totalPages, 50);

        for (let i = 1; i <= count; i++) {
          thumbnails.push({
            index: i,
            label: `Page ${i}`,
            render: async (thumbCanvas: HTMLCanvasElement) => {
              try {
                const p = await pdfDoc.getPage(i);
                const baseVp = p.getViewport({ scale: 1.0 });
                const thumbScale = (thumbCanvas.width || 120) / baseVp.width;
                const thumbVp = p.getViewport({ scale: thumbScale });
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
