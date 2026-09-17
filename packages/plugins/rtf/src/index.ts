import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
// @ts-ignore - rtf.js bundle has no individual d.ts
import * as RTFJS from 'rtf.js/dist/RTFJS.bundle.js';

export class RtfPlugin implements PreviewPlugin {
  id = 'rtf';
  name = 'Rich Text Format (RTF)';
  extensions = ['.rtf'];
  mimeTypes = ['text/rtf', 'application/rtf'];
  weight = 80;

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
    const wrapper = document.createElement('div');
    wrapper.className = 'fp-rtf-wrapper';
    wrapper.style.padding = '32px';
    wrapper.style.maxWidth = '850px';
    wrapper.style.margin = '0 auto';
    wrapper.style.backgroundColor = '#fff';
    wrapper.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    wrapper.style.borderRadius = '4px';
    wrapper.style.minHeight = '100%';
    wrapper.style.transformOrigin = 'top center';
    wrapper.style.transition = 'transform 0.2s ease';

    ctx.container.style.overflow = 'auto';
    ctx.container.style.padding = '24px';
    ctx.container.style.backgroundColor = '#f1f5f9';
    ctx.container.appendChild(wrapper);

    let scale = 1.0;

    try {
      if (typeof (RTFJS as any).loggingEnabled === 'function') {
        (RTFJS as any).loggingEnabled(false);
      }
      const doc = new (RTFJS as any).Document(ctx.buffer, {});
      const htmlElements = await doc.render();
      for (const el of htmlElements) {
        wrapper.appendChild(el);
      }
    } catch (err) {
      console.warn('[RtfPlugin] RTF render error, fallback text:', err);
      const text = new TextDecoder('latin1').decode(ctx.buffer);
      const clean = text.replace(/\\par[d]?/g, '\n').replace(/\\[a-zA-Z0-9\-]+/g, '').replace(/[{}]/g, '');
      wrapper.innerHTML = `<pre style="white-space: pre-wrap; font-family: serif; color: #333;">${clean}</pre>`;
    }

    const cleanup = () => {
      wrapper.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        scale += 0.1;
        wrapper.style.transform = `scale(${scale})`;
      },
      zoomOut: () => {
        scale = Math.max(0.2, scale - 0.1);
        wrapper.style.transform = `scale(${scale})`;
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        wrapper.style.transform = `scale(${scale})`;
      },
      fitToPage: () => {
        scale = 1.0;
        wrapper.style.transform = 'scale(1)';
      },
      download: () => {
        const blob = new Blob([ctx.buffer], { type: 'application/rtf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'document.rtf';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        window.print();
      }
    };
  }
}

export function rtfPlugin(): RtfPlugin {
  return new RtfPlugin();
}

export default RtfPlugin;
