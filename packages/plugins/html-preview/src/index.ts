import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import DOMPurify from 'dompurify';

export class HtmlPreviewPlugin implements PreviewPlugin {
  id = 'html-preview';
  name = 'HTML Document Preview';
  extensions = ['.html', '.htm', '.xhtml'];
  mimeTypes = ['text/html', 'application/xhtml+xml'];
  weight = 85;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    return this.extensions.includes(ext || '') || this.mimeTypes.includes(mime || '');
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    return [
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
        id: 'copy',
        icon: 'copy',
        label: 'Copy HTML',
        type: 'button',
        group: 'actions',
        execute: () => (instance as any).copy?.()
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
    const rawHtml = new TextDecoder('utf-8').decode(ctx.buffer);
    const sanitized = DOMPurify.sanitize(rawHtml, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ['style', 'link'],
      ADD_ATTR: ['target', 'rel']
    });

    const iframe = document.createElement('iframe');
    iframe.className = 'fp-html-iframe';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.backgroundColor = '#ffffff';
    iframe.style.transformOrigin = 'top left';
    iframe.style.transition = 'transform 0.2s ease';
    // Sandbox without allow-scripts ensures no malicious JS can execute
    iframe.sandbox.add('allow-same-origin');

    ctx.container.style.overflow = 'auto';
    ctx.container.style.width = '100%';
    ctx.container.style.height = '100%';
    ctx.container.appendChild(iframe);

    // Set sanitized content via srcdoc
    iframe.srcdoc = sanitized;

    let scale = 1.0;

    const cleanup = () => {
      iframe.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        scale += 0.1;
        iframe.style.transform = `scale(${scale})`;
      },
      zoomOut: () => {
        scale = Math.max(0.2, scale - 0.1);
        iframe.style.transform = `scale(${scale})`;
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        iframe.style.transform = `scale(${scale})`;
      },
      fitToPage: () => {
        scale = 1.0;
        iframe.style.transform = 'scale(1)';
      },
      resetZoom: () => {
        scale = 1.0;
        iframe.style.transform = 'scale(1)';
        ctx.container.scrollTop = 0;
        ctx.container.scrollLeft = 0;
      },
      copy: () => {
        navigator.clipboard.writeText(rawHtml);
      },
      download: () => {
        const blob = new Blob([ctx.buffer], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'document.html';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        iframe.contentWindow?.print();
      }
    } as any;
  }
}

export function htmlPreviewPlugin(): HtmlPreviewPlugin {
  return new HtmlPreviewPlugin();
}

export default HtmlPreviewPlugin;
