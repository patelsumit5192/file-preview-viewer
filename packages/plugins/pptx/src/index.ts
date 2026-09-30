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
    await renderer.load(ctx.buffer);

    const slideCount = renderer.slideCount || (renderer as any).slidePaths?.length || 1;
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
    const emuH = renderer.slideSize?.cy || 6858000;
    const slideAspect = emuW / emuH;
    const baseW = 1280;
    const baseH = Math.round(baseW / slideAspect);

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
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
      border-radius: 4px;
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

    // Presentations should fit cleanly inside the screen by default
    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'page';
    let isUserZoomed = typeof (ctx.options as any)?.zoom === 'number' && (ctx.options as any).zoom > 0;

    const calculateFitScale = (mode: 'width' | 'page' = fitMode) => {
      const availW = Math.max(200, (wrapper.clientWidth || ctx.container.clientWidth) - 64);
      const availH = Math.max(200, (wrapper.clientHeight || ctx.container.clientHeight) - 64);
      if (mode === 'page') {
        return Math.min(2.5, Math.min(availW / baseW, availH / baseH));
      }
      return Math.min(2.5, availW / baseW);
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

    const renderCurrentSlide = async () => {
      try {
        // Render canvas with high-DPI awareness
        const dpr = typeof window !== 'undefined' ? Math.min(2, Math.max(1, window.devicePixelRatio || 1)) : 1;
        const renderW = Math.round(baseW * dpr);
        await renderer.renderSlide(currentSlide - 1, canvas, renderW);
        canvas.style.width = `${baseW}px`;
        canvas.style.height = `${baseH}px`;

        ctx.emit('page-change', { page: currentSlide, total: slideCount, totalPages: slideCount });
        if (!isUserZoomed) {
          scale = calculateFitScale(fitMode);
        }
        applyTransform();
      } catch (err) {
        console.error('[PptxPlugin] Failed to render slide:', err);
      }
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
      renderer.destroy();
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
        scale += 0.15;
        applyTransform();
      },
      zoomOut: () => {
        isUserZoomed = true;
        scale = Math.max(0.2, scale - 0.15);
        applyTransform();
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        isUserZoomed = true;
        scale = level;
        applyTransform();
      },
      fitToPage: () => {
        isUserZoomed = false;
        fitMode = 'page';
        scale = calculateFitScale('page');
        rotation = 0;
        applyTransform();
      },
      fitToWidth: () => {
        isUserZoomed = false;
        fitMode = 'width';
        scale = calculateFitScale('width');
        rotation = 0;
        applyTransform();
      },
      resetZoom: () => {
        isUserZoomed = true;
        fitMode = 'page';
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
        const thumbH = Math.round(thumbW / slideAspect);
        for (let i = 0; i < slideCount; i++) {
          const slideIdx = i;
          list.push({
            index: slideIdx,
            label: `Slide ${slideIdx + 1}`,
            render: async (thumbCanvas: HTMLCanvasElement) => {
              thumbCanvas.width = thumbW;
              thumbCanvas.height = thumbH;
              await renderer.renderSlide(slideIdx, thumbCanvas, thumbW);
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
