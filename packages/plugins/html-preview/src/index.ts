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
        id: 'fit-page',
        icon: 'fit-page',
        label: 'Fit to Page',
        type: 'button',
        group: 'zoom',
        execute: () => instance.fitToPage?.()
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
    const rawHtml = new TextDecoder('utf-8').decode(ctx.buffer);
    const sanitized = DOMPurify.sanitize(rawHtml, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ['style', 'link'],
      ADD_ATTR: ['target', 'rel']
    });

    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'fp-html-scroll-wrapper';
    scrollWrapper.style.minWidth = '100%';
    scrollWrapper.style.minHeight = '100%';
    scrollWrapper.style.width = 'max-content';
    scrollWrapper.style.height = 'max-content';
    scrollWrapper.style.display = 'flex';
    scrollWrapper.style.justifyContent = 'flex-start';
    scrollWrapper.style.alignItems = 'flex-start';
    scrollWrapper.style.boxSizing = 'border-box';

    const sizer = document.createElement('div');
    sizer.className = 'fp-html-sizer';
    sizer.style.position = 'relative';
    sizer.style.flexShrink = '0';

    const iframe = document.createElement('iframe');
    iframe.className = 'fp-html-iframe';
    iframe.style.border = 'none';
    iframe.style.backgroundColor = '#ffffff';
    iframe.style.transformOrigin = 'top left';
    iframe.style.transition = 'transform 0.15s ease';
    // Sandbox without allow-scripts ensures no malicious JS can execute
    iframe.sandbox.add('allow-same-origin');

    sizer.appendChild(iframe);
    scrollWrapper.appendChild(sizer);

    ctx.container.style.overflow = 'auto';
    ctx.container.style.width = '100%';
    ctx.container.style.height = '100%';
    ctx.container.innerHTML = '';
    ctx.container.appendChild(scrollWrapper);

    // Set sanitized content via srcdoc
    iframe.srcdoc = sanitized;

    let scale = 1.0;
    let baseW = Math.max(600, ctx.container.clientWidth || 800);
    let baseH = Math.max(400, ctx.container.clientHeight || 600);

    const applyTransform = () => {
      const scaledW = Math.round(baseW * scale);
      const scaledH = Math.round(baseH * scale);

      sizer.style.width = `${scaledW}px`;
      sizer.style.height = `${scaledH}px`;

      iframe.style.position = 'absolute';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = `${baseW}px`;
      iframe.style.height = `${baseH}px`;
      iframe.style.transform = `scale(${scale})`;
      iframe.style.transformOrigin = 'top left';
    };

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (Math.abs(scale - 1.0) < 0.05) {
            baseW = Math.max(600, ctx.container.clientWidth || 800);
            baseH = Math.max(400, ctx.container.clientHeight || 600);
            applyTransform();
          }
        })
      : null;
    ro?.observe(ctx.container);

    requestAnimationFrame(() => {
      baseW = Math.max(600, ctx.container.clientWidth || 800);
      baseH = Math.max(400, ctx.container.clientHeight || 600);
      applyTransform();
    });

    const cleanup = () => {
      ro?.disconnect();
      scrollWrapper.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        scale = Math.min(3.5, scale + 0.15);
        applyTransform();
      },
      zoomOut: () => {
        scale = Math.max(0.25, scale - 0.15);
        applyTransform();
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        applyTransform();
      },
      fitToPage: () => {
        scale = 1.0;
        applyTransform();
      },
      fitToWidth: () => {
        scale = 1.0;
        applyTransform();
      },
      resetZoom: () => {
        scale = 1.0;
        ctx.container.scrollTop = 0;
        ctx.container.scrollLeft = 0;
        applyTransform();
      },
      openInSeparateWindow: () => {
        (ctx as any)?.openInSeparateWindow?.();
      },
      copy: () => {
        navigator.clipboard?.writeText(rawHtml);
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
