import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';

export class CsvPlugin implements PreviewPlugin {
  id = 'csv';
  name = 'CSV Preview';
  extensions = ['.csv', '.tsv'];
  mimeTypes = ['text/csv', 'text/tab-separated-values'];
  weight = 80;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    return ext === '.csv' || ext === '.tsv' || mime === 'text/csv' || mime === 'text/tab-separated-values';
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
    container.style.padding = '16px';
    container.style.boxSizing = 'border-box';
    container.style.transformOrigin = 'top left';
    
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.fontFamily = 'monospace';
    table.style.fontSize = '13px';
    
    const delimiter = ctx.metadata.extension === '.tsv' ? '\t' : ',';
    const rows = text.split(/\r?\n/).slice(0, 500); 
    
    rows.forEach((row, rowIndex) => {
      if (!row.trim()) return;
      const tr = document.createElement('tr');
      const cells = row.split(delimiter);
      
      cells.forEach(cell => {
        const td = document.createElement(rowIndex === 0 ? 'th' : 'td');
        td.textContent = cell.trim();
        td.style.border = '1px solid #d0d7de';
        td.style.padding = '6px 12px';
        if (rowIndex === 0) {
          td.style.backgroundColor = '#f6f8fa';
          td.style.fontWeight = 'bold';
        }
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    
    container.appendChild(table);
    ctx.container.appendChild(container);

    let scale = 1.0;

    const cleanup = () => {
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        scale += 0.1;
        container.style.transform = `scale(${scale})`;
      },
      zoomOut: () => {
        scale = Math.max(0.2, scale - 0.1);
        container.style.transform = `scale(${scale})`;
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        container.style.transform = `scale(${scale})`;
      },
      fitToPage: () => {
        scale = 1.0;
        container.style.transform = `scale(1)`;
      },
      download: () => {
        const blob = new Blob([ctx.buffer], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'data.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        window.print();
      }
    };
  }
}

export function csvPlugin(): CsvPlugin {
  return new CsvPlugin();
}

export default CsvPlugin;
