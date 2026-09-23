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
        label: 'Decrease Font',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomOut?.()
      },
      {
        id: 'zoom-in',
        icon: 'zoom-in',
        label: 'Increase Font',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomIn?.()
      },
      {
        id: 'fit-page',
        icon: 'fit-page',
        label: 'Default Size',
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

    const wrapper = document.createElement('div');
    wrapper.className = 'fp-markdown-wrapper';
    wrapper.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: auto;
      padding: 32px 40px;
      box-sizing: border-box;
      line-height: 1.6;
      font-size: 15px;
      color: var(--fp-text, #24292f);
      background: var(--fp-bg, #ffffff);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
    `;

    wrapper.innerHTML = `
      <style>
        .fp-markdown-wrapper h1, .fp-markdown-wrapper h2, .fp-markdown-wrapper h3,
        .fp-markdown-wrapper h4, .fp-markdown-wrapper h5, .fp-markdown-wrapper h6 {
          margin-top: 24px;
          margin-bottom: 16px;
          font-weight: 600;
          line-height: 1.25;
          color: var(--fp-text, #1f2328);
        }
        .fp-markdown-wrapper h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--fp-border, #d0d7de); }
        .fp-markdown-wrapper h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--fp-border, #d0d7de); }
        .fp-markdown-wrapper h3 { font-size: 1.25em; }
        .fp-markdown-wrapper p { margin-top: 0; margin-bottom: 16px; }
        .fp-markdown-wrapper table {
          border-spacing: 0;
          border-collapse: collapse;
          margin-top: 0;
          margin-bottom: 16px;
          width: 100%;
          overflow: auto;
        }
        .fp-markdown-wrapper table th, .fp-markdown-wrapper table td {
          padding: 6px 13px;
          border: 1px solid var(--fp-border, #d0d7de);
        }
        .fp-markdown-wrapper table tr:nth-child(2n) {
          background-color: var(--fp-toolbar-bg, #f6f8fa);
        }
        .fp-markdown-wrapper blockquote {
          margin: 0 0 16px 0;
          padding: 0 1em;
          color: var(--fp-text-muted, #59636e);
          border-left: 0.25em solid var(--fp-border, #d0d7de);
        }
        .fp-markdown-wrapper pre {
          padding: 16px;
          overflow: auto;
          font-size: 85%;
          line-height: 1.45;
          background-color: var(--fp-toolbar-bg, #f6f8fa);
          border-radius: 6px;
          border: 1px solid var(--fp-border, #d0d7de);
        }
        .fp-markdown-wrapper code {
          padding: 0.2em 0.4em;
          margin: 0;
          font-size: 85%;
          background-color: rgba(175, 184, 193, 0.2);
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        }
        .fp-markdown-wrapper pre code {
          padding: 0;
          background: transparent;
        }
        .fp-markdown-wrapper ul, .fp-markdown-wrapper ol {
          padding-left: 2em;
          margin-top: 0;
          margin-bottom: 16px;
        }
        .fp-markdown-wrapper hr {
          height: 0.25em;
          padding: 0;
          margin: 24px 0;
          background-color: var(--fp-border, #d0d7de);
          border: 0;
        }
      </style>
      <div class="fp-markdown-content" style="max-width: 860px; margin: 0 auto;">
        ${cleanHtml}
      </div>
    `;

    // Apply syntax highlighting to pre code blocks
    wrapper.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });

    ctx.container.innerHTML = '';
    ctx.container.style.overflow = 'auto';
    ctx.container.appendChild(wrapper);

    let fontSize = 15;

    const cleanup = () => {
      wrapper.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        fontSize = Math.min(28, fontSize + 2);
        wrapper.style.fontSize = `${fontSize}px`;
      },
      zoomOut: () => {
        fontSize = Math.max(10, fontSize - 2);
        wrapper.style.fontSize = `${fontSize}px`;
      },
      getZoom: () => fontSize / 15,
      setZoom: (level: number) => {
        fontSize = Math.round(15 * level);
        wrapper.style.fontSize = `${fontSize}px`;
      },
      fitToPage: () => {
        fontSize = 15;
        wrapper.style.fontSize = '15px';
      },
      resetZoom: () => {
        fontSize = 15;
        wrapper.style.fontSize = '15px';
        ctx.container.scrollTop = 0;
        ctx.container.scrollLeft = 0;
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
