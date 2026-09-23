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
      }
    ];
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const renderer = new PptxRenderer();
    await renderer.load(ctx.buffer);

    const slideCount = (renderer as any).slidePaths?.length || 1;
    let currentSlide = 1;
    let scale = 1.0;
    let rotation = 0;

    const wrapper = document.createElement('div');
    wrapper.className = 'fp-pptx-wrapper';
    wrapper.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
      background: var(--fp-bg-canvas, #525659);
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
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
      border-radius: 4px;
      overflow: hidden;
      background: #ffffff;
      transform-origin: center center;
      transition: transform 0.2s ease;
      flex-shrink: 0;
    `;

    const canvas = document.createElement('canvas');
    slideContainer.appendChild(canvas);
    sizer.appendChild(slideContainer);
    scrollWrapper.appendChild(sizer);
    wrapper.appendChild(scrollWrapper);

    ctx.container.innerHTML = '';
    ctx.container.style.overflow = 'auto';
    ctx.container.appendChild(wrapper);

    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'width';
    let isUserZoomed = false;

    const calculateFitScale = (mode: 'width' | 'page' = fitMode) => {
      const availW = Math.max(200, ctx.container.clientWidth - 32);
      const availH = Math.max(200, ctx.container.clientHeight - 32);
      const cW = canvas.offsetWidth || 1280;
      const cH = canvas.offsetHeight || 720;
      if (mode === 'page') {
        return Math.min(2.5, Math.min(availW / cW, availH / cH));
      }
      return Math.min(2.5, availW / cW);
    };

    const applyTransform = () => {
      const cW = canvas.offsetWidth || 1280;
      const cH = canvas.offsetHeight || 720;
      const isRotated90 = (rotation % 180 !== 0);
      const boxW = Math.round((isRotated90 ? cH : cW) * scale);
      const boxH = Math.round((isRotated90 ? cW : cH) * scale);

      sizer.style.width = `${boxW}px`;
      sizer.style.height = `${boxH}px`;

      slideContainer.style.width = `${cW}px`;
      slideContainer.style.height = `${cH}px`;
      slideContainer.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
      slideContainer.style.transformOrigin = 'center center';
    };

    const renderCurrentSlide = async () => {
      try {
        await renderer.renderSlide(currentSlide - 1, canvas, 1280);
        ctx.emit('page-change', { page: currentSlide, totalPages: slideCount });
        if (!isUserZoomed) {
          scale = calculateFitScale(fitMode);
        }
        applyTransform();
      } catch (err) {
        console.error('[PptxPlugin] Failed to render slide:', err);
      }
    };

    await renderCurrentSlide();

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
        isUserZoomed = false;
        fitMode = ((ctx as any)?.options?.fitMode as any) || 'width';
        scale = calculateFitScale(fitMode);
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
        for (let i = 0; i < slideCount; i++) {
          const slideIdx = i;
          list.push({
            index: slideIdx,
            label: `Slide ${slideIdx + 1}`,
            render: async (thumbCanvas: HTMLCanvasElement) => {
              await renderer.renderSlide(slideIdx, thumbCanvas, 240);
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
