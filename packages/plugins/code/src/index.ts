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
    const actions: ToolbarAction[] = [];

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

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'auto';
    container.style.boxSizing = 'border-box';

    let fontSize = 13;
    const pre = document.createElement('pre');
    const code = document.createElement('code');

    if (isTxt) {
      container.style.backgroundColor = '#f8fafc';
      container.style.padding = '24px 16px';
      container.style.display = 'flex';
      container.style.justifyContent = 'center';

      pre.style.margin = '0';
      pre.style.fontFamily = "Consolas, 'Courier New', monospace";
      pre.style.fontSize = `${fontSize}px`;
      pre.style.color = '#1e293b';
      pre.style.lineHeight = '1.6';
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.wordBreak = 'break-word';
      pre.style.backgroundColor = '#ffffff';
      pre.style.width = '100%';
      pre.style.maxWidth = '900px';
      pre.style.minHeight = '100%';
      pre.style.padding = '36px';
      pre.style.boxSizing = 'border-box';
      pre.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.06)';
      pre.style.borderRadius = '6px';
      pre.style.border = '1px solid #e2e8f0';

      code.textContent = fullText;
    } else {
      container.style.backgroundColor = '#1e1e1e';
      container.style.color = '#d4d4d4';
      container.style.padding = '16px';

      pre.style.margin = '0';
      pre.style.fontFamily = 'Consolas, Menlo, Monaco, monospace';
      pre.style.fontSize = `${fontSize}px`;
      pre.style.lineHeight = '1.5';
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.wordBreak = 'break-all';

      const ext = (ctx.metadata.extension || '').replace('.', '');
      try {
        if (ext && hljs.getLanguage(ext)) {
          code.innerHTML = hljs.highlight(fullText, { language: ext }).value;
        } else {
          code.innerHTML = hljs.highlightAuto(fullText).value;
        }
      } catch {
        code.textContent = fullText;
      }
    }

    pre.appendChild(code);
    container.appendChild(pre);
    ctx.container.appendChild(container);

    const updateFont = () => {
      pre.style.fontSize = `${fontSize}px`;
    };

    const cleanup = () => {
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      getPageCount: () => 1,
      getCurrentPage: () => 1,
      goToPage: () => {},
      getThumbnails: (): Thumbnail[] => [],
      zoomIn: () => {
        fontSize = Math.min(32, fontSize + 2);
        updateFont();
      },
      zoomOut: () => {
        fontSize = Math.max(9, fontSize - 2);
        updateFont();
      },
      getZoom: () => fontSize / 13,
      setZoom: (level: number) => {
        fontSize = Math.max(9, Math.min(32, Math.round(13 * level)));
        updateFont();
      },
      fitToPage: () => {
        fontSize = 13;
        updateFont();
      },
      rotateCW: () => {},
      rotateCCW: () => {},
      download: () => {
        const mimeType = ctx.metadata.mimeType || 'text/plain';
        const blob = new Blob([ctx.buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'document.txt';
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
