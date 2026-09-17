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
  extensions = ['.pptx', '.ppsx'];
  mimeTypes = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow'
  ];
  weight = 80;

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
        execute: (page: unknown) => instance.goToPage?.(Number(page))
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

    const wrapper = document.createElement('div');
    wrapper.className = 'fp-pptx-wrapper';
    wrapper.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 24px;
      box-sizing: border-box;
      background: var(--fp-bg-canvas, #525659);
    `;

    const slideContainer = document.createElement('div');
    slideContainer.className = 'fp-slide-container';
    slideContainer.style.cssText = `
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
      border-radius: 4px;
      overflow: hidden;
      background: #ffffff;
      transform-origin: top center;
      transition: transform 0.2s ease;
    `;

    const canvas = document.createElement('canvas');
    slideContainer.appendChild(canvas);
    wrapper.appendChild(slideContainer);

    ctx.container.innerHTML = '';
    ctx.container.style.overflow = 'auto';
    ctx.container.appendChild(wrapper);

    const renderCurrentSlide = async () => {
      try {
        await renderer.renderSlide(currentSlide - 1, canvas, 1280);
        ctx.emit('page-change', { page: currentSlide, totalPages: slideCount });
      } catch (err) {
        console.error('[PptxPlugin] Failed to render slide:', err);
      }
    };

    await renderCurrentSlide();

    const cleanup = () => {
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
        scale += 0.1;
        slideContainer.style.transform = `scale(${scale})`;
      },
      zoomOut: () => {
        scale = Math.max(0.2, scale - 0.1);
        slideContainer.style.transform = `scale(${scale})`;
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        slideContainer.style.transform = `scale(${scale})`;
      },
      fitToPage: () => {
        scale = 1.0;
        slideContainer.style.transform = 'scale(1)';
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
