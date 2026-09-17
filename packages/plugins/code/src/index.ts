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
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(ctx.buffer);
    
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

    try {
      if (ext && hljs.getLanguage(ext)) {
        code.innerHTML = hljs.highlight(text, { language: ext }).value;
      } else {
        code.innerHTML = hljs.highlightAuto(text).value;
      }
    } catch {
      code.textContent = text;
    }
    
    pre.appendChild(code);
    container.appendChild(pre);
    ctx.container.appendChild(container);

    const cleanup = () => {
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
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
      }
    };
  }
}

export function codePlugin(): CodePlugin {
  return new CodePlugin();
}

export default CodePlugin;
