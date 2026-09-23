import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance,
  Thumbnail 
} from '@patel.sumit51/core';
import hljs from 'highlight.js';

const CODE_EXTENSIONS = [
  '.txt', '.log', '.ini', '.cfg', '.conf', '.env',
  '.json', '.jsonc', '.json5',
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.mts', '.cts', '.tsx',
  '.html', '.htm', '.xhtml',
  '.css', '.scss', '.sass', '.less',
  '.md', '.markdown',
  '.xml', '.svg', '.xaml',
  '.yml', '.yaml', '.toml',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
  '.py', '.pyw',
  '.java', '.class',
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
  '.cs', '.csx',
  '.go',
  '.rs',
  '.sql',
  '.php', '.phtml',
  '.rb',
  '.swift',
  '.kt', '.kts',
  '.scala',
  '.r',
  '.lua',
  '.pl', '.pm',
  '.dart',
  '.graphql', '.gql',
  '.proto',
  '.diff', '.patch',
  '.dockerfile', '.properties', '.gradle'
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
        id: 'thumbnails',
        icon: 'thumbnails',
        label: 'Page Thumbnails',
        type: 'button',
        group: 'navigation',
        execute: () => (instance as any).toggleThumbnails?.()
      });

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
        id: 'reset-zoom',
        icon: 'reset-zoom',
        label: 'Reset Zoom',
        type: 'button',
        group: 'zoom',
        execute: () => {
          instance.resetZoom?.();
        }
      },
      {
        id: 'fit-width',
        icon: 'fit-width',
        label: 'Fit to Width',
        type: 'button',
        group: 'zoom',
        execute: () => {
          instance.fitToWidth?.();
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
      },
      {
        id: 'open-window',
        icon: 'open-window',
        label: 'Open in Separate Full Window',
        type: 'button',
        group: 'actions',
        execute: () => {
          (instance as any).openInSeparateWindow?.();
        }
      }
    );

    return actions;
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const decoder = new TextDecoder('utf-8');
    const fullText = decoder.decode(ctx.buffer);

    const extRaw = ctx.metadata.extension?.toLowerCase();
    const mimeRaw = ctx.metadata.mimeType?.toLowerCase();
    const isTxt = extRaw === '.txt' || (mimeRaw === 'text/plain' && (!extRaw || !this.extensions.filter(e => e !== '.txt').includes(extRaw)));

    let rawPages: string[] = [];
    if (isTxt) {
      const explicitPages = fullText.split(/(?:\f|\x0C)/);
      const charsPerLine = 85;
      const maxVisualLines = 45;
      const charsPerPage = charsPerLine * maxVisualLines; // ~3825 characters per page

      for (const ep of explicitPages) {
        const lines = ep.split(/\r?\n/);
        let currentChunk: string[] = [];
        let currentLines = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const vLines = Math.max(1, Math.ceil((line.length || 1) / charsPerLine));

          if (currentLines + vLines > maxVisualLines && currentChunk.length > 0) {
            rawPages.push(currentChunk.join('\n'));
            currentChunk = [];
            currentLines = 0;
          }

          if (vLines > maxVisualLines) {
            // Large uninterrupted paragraph: break cleanly at word boundaries
            let remaining = line;
            while (remaining.length > charsPerPage) {
              let splitIdx = remaining.lastIndexOf(' ', charsPerPage);
              if (splitIdx < charsPerPage * 0.75) splitIdx = charsPerPage;
              rawPages.push(remaining.slice(0, splitIdx));
              remaining = remaining.slice(splitIdx).trimStart();
            }
            if (remaining.length > 0) {
              currentChunk.push(remaining);
              currentLines = Math.ceil(remaining.length / charsPerLine);
            }
          } else {
            currentChunk.push(line);
            currentLines += vLines;
          }
        }
        if (currentChunk.length > 0) {
          rawPages.push(currentChunk.join('\n'));
        }
      }
      if (rawPages.length === 0) rawPages = [''];
    } else {
      const pageSplitRegex = /(?:\f|\x0C|(?:\r?\n|^)\s*[-=_]{3,}\s*(?:PAGE|Page|page break|Page Break)[\s\d\w-]*[-=_]{3,}\s*(?:\r?\n|$))/i;
      rawPages = fullText.split(pageSplitRegex).map(p => p.trim()).filter(p => p.length > 0);
    }
    
    const totalPages = Math.max(1, rawPages.length);
    let currentPage = 1;
    
    let fontSize = 13;
    let rotation = 0;
    let zoomLevel = 1;
    let isUserZoomed = false;
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    const sizer = document.createElement('div');
    const scrollWrapper = document.createElement('div');
    const lineGutter = document.createElement('div');

    ctx.container.style.overflow = 'auto';

    if (isTxt) {
      ctx.container.style.backgroundColor = '#f1f5f9';

      scrollWrapper.className = 'fp-code-scroll-wrapper';
      scrollWrapper.style.minWidth = '100%';
      scrollWrapper.style.minHeight = '100%';
      scrollWrapper.style.width = 'max-content';
      scrollWrapper.style.height = 'max-content';
      scrollWrapper.style.display = 'flex';
      scrollWrapper.style.justifyContent = 'center';
      scrollWrapper.style.alignItems = 'flex-start';
      scrollWrapper.style.padding = '16px 8px';
      scrollWrapper.style.boxSizing = 'border-box';

      sizer.className = 'fp-code-sizer';
      sizer.style.position = 'relative';
      sizer.style.flexShrink = '0';
      sizer.style.display = 'flex';
      sizer.style.justifyContent = 'center';
      sizer.style.alignItems = 'center';

      pre.style.margin = '0 auto';
      pre.style.fontFamily = "Consolas, 'Courier New', monospace";
      pre.style.fontSize = '13px';
      pre.style.color = '#1e293b';
      pre.style.lineHeight = '1.5';
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.wordBreak = 'break-word';
      
      pre.style.backgroundColor = '#ffffff';
      pre.style.width = '816px';
      pre.style.minHeight = '1056px';
      pre.style.padding = '72px 56px';
      pre.style.boxSizing = 'border-box';
      pre.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.08)';
      pre.style.borderRadius = '4px';
      pre.style.transformOrigin = 'center center';
      pre.style.transition = 'transform 0.15s ease';
      pre.style.flexShrink = '0';
    } else {
      ctx.container.style.backgroundColor = '#1e1e1e';
      ctx.container.style.color = '#d4d4d4';

      scrollWrapper.className = 'fp-code-scroll-wrapper';
      scrollWrapper.style.minWidth = '100%';
      scrollWrapper.style.minHeight = '100%';
      scrollWrapper.style.width = 'max-content';
      scrollWrapper.style.height = 'max-content';
      scrollWrapper.style.display = 'flex';
      scrollWrapper.style.alignItems = 'flex-start';
      scrollWrapper.style.padding = '16px';
      scrollWrapper.style.boxSizing = 'border-box';

      const lineCount = (fullText.split(/\r?\n/).length) || 1;
      const gutterLines: string[] = [];
      for (let i = 1; i <= lineCount; i++) {
        gutterLines.push(String(i));
      }
      lineGutter.className = 'fp-code-gutter';
      lineGutter.style.userSelect = 'none';
      lineGutter.style.textAlign = 'right';
      lineGutter.style.paddingRight = '16px';
      lineGutter.style.marginRight = '16px';
      lineGutter.style.borderRight = '1px solid #333333';
      lineGutter.style.color = '#858585';
      lineGutter.style.fontFamily = "Consolas, Menlo, Monaco, 'Courier New', monospace";
      lineGutter.style.fontSize = `${fontSize}px`;
      lineGutter.style.lineHeight = '1.6';
      lineGutter.style.flexShrink = '0';
      lineGutter.textContent = gutterLines.join('\n');

      pre.style.margin = '0';
      pre.style.fontFamily = "Consolas, Menlo, Monaco, 'Courier New', monospace";
      pre.style.fontSize = `${fontSize}px`;
      pre.style.lineHeight = '1.6';
      pre.style.whiteSpace = 'pre';
      pre.style.wordBreak = 'normal';
      pre.style.overflowWrap = 'normal';
      pre.style.flex = '1';
    }

    const ext = (ctx.metadata.extension || '').replace('.', '');

    const renderCodePage = (text: string) => {
      if (isTxt) {
        code.textContent = text;
      } else {
        try {
          if (ext && hljs.getLanguage(ext)) {
            code.innerHTML = hljs.highlight(text, { language: ext }).value;
          } else {
            code.innerHTML = hljs.highlightAuto(text).value;
          }
        } catch {
          code.textContent = text;
        }
      }
    };

    renderCodePage(rawPages[0] || (isTxt ? '' : fullText));
    
    pre.appendChild(code);
    ctx.container.innerHTML = '';
    if (isTxt) {
      sizer.appendChild(pre);
      scrollWrapper.appendChild(sizer);
      ctx.container.appendChild(scrollWrapper);
    } else {
      scrollWrapper.appendChild(lineGutter);
      scrollWrapper.appendChild(pre);
      ctx.container.appendChild(scrollWrapper);
    }

    const showPage = (pageNum: number) => {
      currentPage = Math.max(1, Math.min(totalPages, pageNum));
      renderCodePage(rawPages[currentPage - 1] || (isTxt ? '' : fullText));
      ctx.container.scrollTop = 0;
      ctx.emit('page-change', { page: currentPage, total: totalPages });
    };

    if (totalPages > 1) {
      showPage(1);
    }

    const calculateTxtFit = () => {
      // Minimal side margins (16px on each side, safe from vertical scrollbar)
      const availW = Math.max(280, ctx.container.clientWidth - 32);
      return Math.max(0.4, Math.min(3.0, availW / 816));
    };

    const updateTransform = () => {
      if (isTxt) {
        const elW = 816;
        const baseH = pre.offsetHeight || 1056;
        const isRotated90 = (rotation % 180 !== 0);
        const boxW = Math.round((isRotated90 ? baseH : elW) * zoomLevel);
        const boxH = Math.round((isRotated90 ? elW : baseH) * zoomLevel);

        sizer.style.width = `${boxW}px`;
        sizer.style.height = `${boxH}px`;

        pre.style.width = `${elW}px`;
        pre.style.transform = `scale(${zoomLevel}) rotate(${rotation}deg)`;
        pre.style.transformOrigin = 'center center';
      } else {
        pre.style.transform = `rotate(${rotation}deg)`;
        pre.style.fontSize = `${fontSize}px`;
        lineGutter.style.fontSize = `${fontSize}px`;
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (isTxt) {
      setTimeout(() => {
        zoomLevel = calculateTxtFit();
        updateTransform();
      }, 60);

      resizeObserver = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!isUserZoomed) {
              zoomLevel = calculateTxtFit();
              updateTransform();
            }
          })
        : null;
      resizeObserver?.observe(ctx.container);
    }

    const cleanup = () => {
      resizeObserver?.disconnect();
      scrollWrapper.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      getPageCount: () => totalPages,
      getCurrentPage: () => currentPage,
      goToPage: (page: number) => showPage(page),
      getThumbnails: (): Thumbnail[] => {
        return rawPages.map((pageText, idx) => ({
          index: idx,
          label: `Page ${idx + 1}`,
          render: async (canvas: HTMLCanvasElement) => {
            canvas.width = 140;
            canvas.height = 180;
            const c = canvas.getContext('2d');
            if (!c) return;

            // Page Background
            c.fillStyle = '#ffffff';
            c.fillRect(0, 0, canvas.width, canvas.height);

            // Subtle paper border
            c.strokeStyle = '#cbd5e1';
            c.lineWidth = 1;
            c.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

            // Miniature lines of text
            c.fillStyle = '#64748b';
            const lines = (pageText || '').split('\n').slice(0, 24);
            const lineH = 6;
            const startY = 14;
            const startX = 12;
            const maxW = canvas.width - 24;

            c.font = '5px monospace';
            for (let li = 0; li < lines.length; li++) {
              const l = lines[li].trim();
              if (!l) continue;
              const y = startY + li * lineH;
              if (y > canvas.height - 12) break;
              c.fillText(l.slice(0, 30), startX, y, maxW);
            }
          }
        }));
      },
      zoomIn: () => {
        isUserZoomed = true;
        if (isTxt) {
          zoomLevel = Math.min(3.5, zoomLevel + 0.15);
        } else {
          fontSize = Math.min(48, fontSize + 2);
        }
        updateTransform();
      },
      zoomOut: () => {
        isUserZoomed = true;
        if (isTxt) {
          zoomLevel = Math.max(0.1, zoomLevel - 0.15);
        } else {
          fontSize = Math.max(9, fontSize - 2);
        }
        updateTransform();
      },
      getZoom: () => isTxt ? zoomLevel : fontSize / 13,
      setZoom: (level: number) => {
        isUserZoomed = true;
        if (isTxt) {
          zoomLevel = level;
        } else {
          fontSize = Math.round(13 * level);
        }
        updateTransform();
      },
      fitToPage: () => {
        isUserZoomed = false;
        fontSize = 13;
        rotation = 0;
        zoomLevel = isTxt ? calculateTxtFit() : 1;
        updateTransform();
      },
      fitToWidth: () => {
        isUserZoomed = false;
        fontSize = 13;
        rotation = 0;
        zoomLevel = isTxt ? calculateTxtFit() : 1;
        updateTransform();
      },
      resetZoom: () => {
        isUserZoomed = false;
        fontSize = 13;
        rotation = 0;
        zoomLevel = isTxt ? calculateTxtFit() : 1;
        ctx.container.scrollTop = 0;
        ctx.container.scrollLeft = 0;
        updateTransform();
      },
      rotateCW: () => {
        rotation = (rotation + 90) % 360;
        updateTransform();
      },
      rotateCCW: () => {
        rotation = (rotation - 90 + 360) % 360;
        updateTransform();
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
