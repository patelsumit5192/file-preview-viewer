import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance, 
  Thumbnail 
} from '@patel.sumit51/core';

export class PdfPlugin implements PreviewPlugin {
  id = 'pdf';
  name = 'PDF Preview';
  extensions = ['.pdf'];
  mimeTypes = ['application/pdf'];
  weight = 100;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    return ext === '.pdf' || mime === 'application/pdf';
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    return [
      {
        id: 'zoom-out',
        icon: 'zoom-out',
        label: 'Zoom Out',
        type: 'button',
        group: 'zoom',
        execute: () => {
          instance.zoomOut?.();
        }
      },
      {
        id: 'zoom-in',
        icon: 'zoom-in',
        label: 'Zoom In',
        type: 'button',
        group: 'zoom',
        execute: () => {
          instance.zoomIn?.();
        }
      },
      {
        id: 'fit-page',
        icon: 'fit-page',
        label: 'Fit to Page',
        type: 'button',
        group: 'zoom',
        execute: () => {
          instance.fitToPage?.();
        }
      },
      {
        id: 'rotate-cw',
        icon: 'rotate-cw',
        label: 'Rotate',
        type: 'button',
        group: 'view',
        execute: () => {
          instance.rotateCW?.();
        }
      },
      {
        id: 'page-nav',
        icon: 'page-nav',
        label: 'Page Navigation',
        type: 'page-nav',
        group: 'navigation',
        execute: (page?: unknown) => {
          if (typeof page === 'number') instance.goToPage?.(page);
        }
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download',
        type: 'button',
        group: 'actions',
        execute: () => {
          instance.download?.();
        }
      },
      {
        id: 'print',
        icon: 'print',
        label: 'Print',
        type: 'button',
        group: 'actions',
        execute: () => {
          instance.print?.();
        }
      }
    ];
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const blob = new Blob([ctx.buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.overflow = 'hidden';
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'center';

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    
    wrapper.appendChild(iframe);
    ctx.container.appendChild(wrapper);
    
    let currentPage = 1;
    let currentZoom = 1.0;
    let rotation = 0;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      wrapper.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        currentZoom += 0.1;
        iframe.style.transform = `scale(${currentZoom}) rotate(${rotation}deg)`;
      },
      zoomOut: () => {
        currentZoom = Math.max(0.2, currentZoom - 0.1);
        iframe.style.transform = `scale(${currentZoom}) rotate(${rotation}deg)`;
      },
      getZoom: () => currentZoom,
      setZoom: (level: number) => {
        currentZoom = level;
        iframe.style.transform = `scale(${currentZoom}) rotate(${rotation}deg)`;
      },
      fitToPage: () => {
        currentZoom = 1.0;
        iframe.style.transform = `scale(1) rotate(${rotation}deg)`;
      },
      rotateCW: () => {
        rotation = (rotation + 90) % 360;
        iframe.style.transform = `scale(${currentZoom}) rotate(${rotation}deg)`;
      },
      rotateCCW: () => {
        rotation = (rotation - 90 + 360) % 360;
        iframe.style.transform = `scale(${currentZoom}) rotate(${rotation}deg)`;
      },
      getRotation: () => rotation,
      goToPage: (page: number) => {
        currentPage = page;
        // In iframe viewer, appending #page=N to the hash navigates in native PDF viewer
        iframe.src = `${url}#page=${page}`;
      },
      getCurrentPage: () => currentPage,
      download: () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'document.pdf';
        a.click();
      },
      print: () => {
        iframe.contentWindow?.print();
      },
      getThumbnails: async (): Promise<Thumbnail[]> => {
        return [
          {
            index: 1,
            label: 'Page 1',
            render: async (canvas: HTMLCanvasElement) => {
              const context = canvas.getContext('2d');
              if (context) {
                context.fillStyle = '#fff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = '#333';
                context.font = '12px sans-serif';
                context.fillText('PDF Preview', 10, 20);
              }
            }
          }
        ];
      }
    };
  }
}

export function pdfPlugin(): PdfPlugin {
  return new PdfPlugin();
}

export default PdfPlugin;
