import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import { downloadFile } from '@patel.sumit51/core';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

export class MarkdownPlugin implements PreviewPlugin {
  id = 'markdown';
  name = 'Markdown Preview';
  extensions = ['.md', '.markdown', '.mdown', '.mkd'];
  mimeTypes = ['text/markdown', 'text/x-markdown'];
  weight = 90; // Higher than generic text/code plugin

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
        label: 'Copy Markdown',
        type: 'button',
        group: 'actions',
        execute: () => (instance as any).copy?.()
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download Markdown',
        type: 'button',
        group: 'actions',
        execute: () => instance.download?.()
      },
      {
        id: 'print',
        icon: 'print',
        label: 'Print Document',
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
    const text = new TextDecoder('utf-8', { fatal: false }).decode(ctx.buffer);
    
    // Parse markdown to HTML
    const rawHtml = await marked.parse(text, {
      gfm: true,
      breaks: true,
    });

    // Sanitize generated HTML for security
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true }
    });

    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'fp-markdown-scroll-wrapper';
    scrollWrapper.style.minWidth = '100%';
    scrollWrapper.style.minHeight = '100%';
    scrollWrapper.style.width = 'max-content';
    scrollWrapper.style.height = 'max-content';
    scrollWrapper.style.display = 'flex';
    scrollWrapper.style.justifyContent = 'center';
    scrollWrapper.style.alignItems = 'flex-start';
    scrollWrapper.style.padding = '24px 16px';
    scrollWrapper.style.boxSizing = 'border-box';

    const sizer = document.createElement('div');
    sizer.className = 'fp-markdown-sizer';
    sizer.style.position = 'relative';
    sizer.style.flexShrink = '0';
    sizer.style.display = 'flex';
    sizer.style.justifyContent = 'center';
    sizer.style.alignItems = 'flex-start';

    const docCard = document.createElement('div');
    docCard.className = 'fp-markdown-doc-card';
    docCard.style.cssText = `
      width: 860px;
      min-height: 600px;
      padding: 40px 48px;
      box-sizing: border-box;
      line-height: 1.6;
      font-size: 15px;
      color: var(--fp-text, #24292f);
      background: var(--fp-bg, #ffffff);
      border-radius: 6px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      transform-origin: top center;
      transition: transform 0.15s ease;
      flex-shrink: 0;
    `;

    docCard.innerHTML = `
      <style>
        .fp-markdown-doc-card h1, .fp-markdown-doc-card h2, .fp-markdown-doc-card h3,
        .fp-markdown-doc-card h4, .fp-markdown-doc-card h5, .fp-markdown-doc-card h6 {
          margin-top: 24px;
          margin-bottom: 16px;
          font-weight: 600;
          line-height: 1.25;
          color: var(--fp-text, #1f2328);
        }
        .fp-markdown-doc-card h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--fp-border, #d0d7de); }
        .fp-markdown-doc-card h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--fp-border, #d0d7de); }
        .fp-markdown-doc-card h3 { font-size: 1.25em; }
        .fp-markdown-doc-card p { margin-top: 0; margin-bottom: 16px; }
        .fp-markdown-doc-card table {
          border-spacing: 0;
          border-collapse: collapse;
          margin-top: 0;
          margin-bottom: 16px;
          width: 100%;
          overflow: auto;
        }
        .fp-markdown-doc-card table th, .fp-markdown-doc-card table td {
          padding: 6px 13px;
          border: 1px solid var(--fp-border, #d0d7de);
        }
        .fp-markdown-doc-card table tr:nth-child(2n) {
          background-color: var(--fp-toolbar-bg, #f6f8fa);
        }
        .fp-markdown-doc-card blockquote {
          margin: 0 0 16px 0;
          padding: 0 1em;
          color: var(--fp-text-muted, #59636e);
          border-left: 0.25em solid var(--fp-border, #d0d7de);
        }
        .fp-markdown-doc-card pre {
          padding: 16px;
          overflow: auto;
          font-size: 85%;
          line-height: 1.45;
          background-color: var(--fp-toolbar-bg, #f6f8fa);
          border-radius: 6px;
          border: 1px solid var(--fp-border, #d0d7de);
        }
        .fp-markdown-doc-card code {
          padding: 0.2em 0.4em;
          margin: 0;
          font-size: 85%;
          background-color: rgba(175, 184, 193, 0.2);
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        }
        .fp-markdown-doc-card pre code {
          padding: 0;
          background: transparent;
        }
        .fp-markdown-doc-card ul, .fp-markdown-doc-card ol {
          padding-left: 2em;
          margin-top: 0;
          margin-bottom: 16px;
        }
        .fp-markdown-doc-card hr {
          height: 0.25em;
          padding: 0;
          margin: 24px 0;
          background-color: var(--fp-border, #d0d7de);
          border: 0;
        }
      </style>
      <div class="fp-markdown-body">
        ${cleanHtml}
      </div>
    `;

    // Apply syntax highlighting to pre code blocks
    docCard.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });

    sizer.appendChild(docCard);
    scrollWrapper.appendChild(sizer);

    ctx.container.innerHTML = '';
    ctx.container.style.overflow = 'auto';
    ctx.container.style.backgroundColor = '#f1f5f9';
    ctx.container.appendChild(scrollWrapper);

    let scale = 1.0;
    let isUserZoomed = false;

    const calculateFitScale = () => {
      const availW = Math.max(280, ctx.container.clientWidth - 48);
      // Fit 860px card to container width if container is smaller than 900px
      if (availW < 860) {
        return Math.max(0.35, availW / 860);
      }
      return 1.0;
    };

    const applyTransform = () => {
      const baseW = 860;
      const baseH = docCard.offsetHeight || 600;
      const scaledW = Math.round(baseW * scale);
      const scaledH = Math.round(baseH * scale);

      sizer.style.width = `${scaledW}px`;
      sizer.style.height = `${scaledH}px`;

      docCard.style.width = `${baseW}px`;
      docCard.style.transform = `scale(${scale})`;
      docCard.style.transformOrigin = (scaledW > (ctx.container.clientWidth - 32)) ? 'top left' : 'top center';
    };

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (!isUserZoomed) {
            scale = calculateFitScale();
            applyTransform();
          }
        })
      : null;
    ro?.observe(ctx.container);

    requestAnimationFrame(() => {
      if (!isUserZoomed) {
        scale = calculateFitScale();
      }
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
        isUserZoomed = true;
        scale = Math.min(3.5, scale + 0.15);
        applyTransform();
      },
      zoomOut: () => {
        isUserZoomed = true;
        scale = Math.max(0.25, scale - 0.15);
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
        scale = calculateFitScale();
        applyTransform();
      },
      fitToWidth: () => {
        isUserZoomed = false;
        scale = calculateFitScale();
        applyTransform();
      },
      resetZoom: () => {
        isUserZoomed = false;
        scale = calculateFitScale();
        ctx.container.scrollTop = 0;
        ctx.container.scrollLeft = 0;
        applyTransform();
      },
      openInSeparateWindow: () => {
        (ctx as any)?.openInSeparateWindow?.();
      },
      download: () => {
        downloadFile(ctx.buffer, ctx.metadata.name || 'document.md', 'text/markdown');
      },
      print: () => {
        window.print();
      },
      copy: () => {
        navigator.clipboard?.writeText(text);
      }
    };
  }
}

export function markdownPlugin(): MarkdownPlugin {
  return new MarkdownPlugin();
}

export default MarkdownPlugin;
