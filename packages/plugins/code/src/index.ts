import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import hljs from 'highlight.js';

const CODE_EXTENSIONS = [
  '.txt', '.json', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.less',
  '.md', '.xml', '.yml', '.yaml', '.sh', '.bash', '.py', 
  '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.sql', '.php'
];

export class CodePlugin implements PreviewPlugin {
  id = 'code';
  name = 'Code/Text Preview';
  extensions = CODE_EXTENSIONS;
  mimeTypes = ['text/plain', 'application/json', 'text/javascript', 'text/html', 'text/css'];
  weight = 50; 

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    
    if (ext && this.extensions.includes(ext)) return true;
    if (mime && (mime.startsWith('text/') || this.mimeTypes.includes(mime))) return true;
    
    return false;
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    const totalPages = instance.getPageCount?.() ?? 1;
    const actions: ToolbarAction[] = [];

    if (totalPages > 1) {
      actions.push({
        id: 'page-nav',
        icon: '',
        label: 'Page Navigation',
        type: 'page-nav',
        group: 'navigation',
        value: instance.getCurrentPage?.() ?? 1,
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
      });
    }

    actions.push(
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
        id: 'copy',
        icon: 'copy',
        label: 'Copy Content',
        type: 'button',
        group: 'actions',
        execute: () => {
          (instance as any).copy?.();
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
    );

    return actions;
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const decoder = new TextDecoder('utf-8');
    const fullText = decoder.decode(ctx.buffer);

    // Check for Form Feed \f (\x0C) or explicit page breaks
    const pageSplitRegex = /(?:\f|\x0C|(?:\r?\n|^)\s*[-=_]{3,}\s*(?:PAGE|Page|page break|Page Break)[\s\d\w-]*[-=_]{3,}\s*(?:\r?\n|$))/i;
    const rawPages = fullText.split(pageSplitRegex).map(p => p.trim()).filter(p => p.length > 0);
    const totalPages = Math.max(1, rawPages.length);
    let currentPage = 1;
    
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'auto';
    container.style.backgroundColor = '#1e1e1e';
    container.style.color = '#d4d4d4';
    container.style.padding = '16px';
    container.style.boxSizing = 'border-box';
    
    let fontSize = 13;
    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.fontFamily = 'Consolas, Menlo, Monaco, monospace';
    pre.style.fontSize = `${fontSize}px`;
    pre.style.lineHeight = '1.5';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-all';

    const code = document.createElement('code');
    const ext = (ctx.metadata.extension || '').replace('.', '');

    const renderCodePage = (text: string) => {
      try {
        if (ext && hljs.getLanguage(ext)) {
          code.innerHTML = hljs.highlight(text, { language: ext }).value;
        } else {
          code.innerHTML = hljs.highlightAuto(text).value;
        }
      } catch {
        code.textContent = text;
      }
    };

    renderCodePage(rawPages[0] || fullText);
    
    pre.appendChild(code);
    container.appendChild(pre);

    let indicator: HTMLElement | null = null;
    if (totalPages > 1) {
      indicator = document.createElement('div');
      indicator.className = 'fp-code-page-indicator';
      indicator.style.position = 'sticky';
      indicator.style.bottom = '16px';
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
      indicator.style.textAlign = 'center';
      indicator.style.width = 'fit-content';
      indicator.style.margin = '16px auto 0';
      container.appendChild(indicator);
    }

    const showPage = (pageNum: number) => {
      currentPage = Math.max(1, Math.min(totalPages, pageNum));
      renderCodePage(rawPages[currentPage - 1] || fullText);
      if (indicator) {
        indicator.textContent = `Page ${currentPage} of ${totalPages}`;
      }
      ctx.emit('page-change', { page: currentPage, total: totalPages });
    };

    if (totalPages > 1) {
      showPage(1);
    }

    ctx.container.appendChild(container);

    const cleanup = () => {
      indicator?.remove();
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      getPageCount: () => totalPages,
      getCurrentPage: () => currentPage,
      goToPage: (page: number) => showPage(page),
      zoomIn: () => {
        fontSize = Math.min(32, fontSize + 2);
        pre.style.fontSize = `${fontSize}px`;
      },
      zoomOut: () => {
        fontSize = Math.max(8, fontSize - 2);
        pre.style.fontSize = `${fontSize}px`;
      },
      getZoom: () => fontSize / 13,
      setZoom: (level: number) => {
        fontSize = Math.round(13 * level);
        pre.style.fontSize = `${fontSize}px`;
      },
      download: () => {
        const mimeType = ctx.metadata.mimeType || 'text/plain';
        const blob = new Blob([ctx.buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'code.txt';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        window.print();
      },
      copy: () => {
        navigator.clipboard?.writeText(fullText);
      }
    };
  }
}

export function codePlugin(): CodePlugin {
  return new CodePlugin();
}

export default CodePlugin;
