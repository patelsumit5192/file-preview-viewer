import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance,
  Thumbnail
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
    const actions: ToolbarAction[] = [];

    // Sheet Thumbnails
    actions.push({
      id: 'thumbnails',
      icon: 'thumbnails',
      label: 'Sheet Thumbnails',
      type: 'button',
      group: 'navigation',
      execute: () => (instance as any).toggleThumbnails?.()
    });

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
    const text = decoder.decode(ctx.buffer);
    
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'auto';
    container.style.padding = '16px';
    container.style.boxSizing = 'border-box';

    const tableWrapper = document.createElement('div');
    tableWrapper.style.transformOrigin = 'top left';
    
    const delimiter = ctx.metadata.extension === '.tsv' ? '\t' : ',';
    const allLines = text.split(/\r?\n/).filter(r => r.trim().length > 0);
    const headerLine = allLines[0] || '';
    const headerCells = headerLine.split(delimiter);
    const dataLines = allLines.slice(1);

    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.minWidth = '100%';
    table.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    table.style.fontSize = '13px';
    table.style.background = '#ffffff';
    table.style.border = '1px solid #d0d7de';
    
    // Header row
    const headerTr = document.createElement('tr');
    headerCells.forEach(cell => {
      const th = document.createElement('th');
      th.textContent = cell.trim();
      th.style.border = '1px solid #d0d7de';
      th.style.padding = '8px 12px';
      th.style.backgroundColor = '#f6f8fa';
      th.style.fontWeight = '600';
      th.style.whiteSpace = 'nowrap';
      headerTr.appendChild(th);
    });
    table.appendChild(headerTr);

    // Single continuous load of all data rows
    dataLines.forEach((row, idx) => {
      const tr = document.createElement('tr');
      if (idx % 2 === 1) tr.style.backgroundColor = '#f8fafc';
      const cells = row.split(delimiter);
      cells.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell.trim();
        td.style.border = '1px solid #d0d7de';
        td.style.padding = '6px 12px';
        td.style.whiteSpace = 'nowrap';
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });

    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
    ctx.container.appendChild(container);

    let scale = 1.0;
    let isUserZoomed = false;

    const calculateFitScale = () => {
      const availW = Math.max(280, container.clientWidth - 48);
      const tW = (table as any)._baseWidth || table.offsetWidth || 800;
      return Math.max(0.4, Math.min(1.0, availW / tW));
    };

    const applyScale = () => {
      if (!(table as any)._baseWidth && table.offsetWidth > 0) {
        (table as any)._baseWidth = table.offsetWidth;
        (table as any)._baseHeight = table.offsetHeight;
      }
      const baseW = (table as any)._baseWidth || table.offsetWidth || 800;
      const baseH = (table as any)._baseHeight || table.offsetHeight || 600;
      const scaledW = Math.round(baseW * scale);
      const scaledH = Math.round(baseH * scale);

      tableWrapper.style.position = 'relative';
      tableWrapper.style.width = `${scaledW}px`;
      tableWrapper.style.height = `${scaledH}px`;
      table.style.position = 'absolute';
      table.style.top = '0';
      table.style.left = '0';
      table.style.transform = `scale(${scale})`;
      table.style.transformOrigin = 'top left';
    };

    // Automatically fit to page width by default
    requestAnimationFrame(() => {
      if (!isUserZoomed) {
        scale = calculateFitScale();
      }
      applyScale();
    });

    const ro = new ResizeObserver(() => {
      if (!isUserZoomed) {
        scale = calculateFitScale();
        applyScale();
      }
    });
    ro.observe(container);

    const cleanup = () => {
      ro.disconnect();
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      getPageCount: () => 1,
      getCurrentPage: () => 1,
      goToPage: () => {},
      getThumbnails: (): Thumbnail[] => {
        const sheetName = ctx.metadata.name?.replace(/\.[^/.]+$/, '') || 'Sheet1';
        return [{
          index: 0,
          label: sheetName,
          render: async (canvas: HTMLCanvasElement) => {
            canvas.width = 140;
            canvas.height = 100;
            const c = canvas.getContext('2d');
            if (!c) return;

            // Sheet Paper Background
            c.fillStyle = '#ffffff';
            c.fillRect(0, 0, canvas.width, canvas.height);

            // Top Header Bar (Excel Green - same as xlsx wise)
            c.fillStyle = '#107c41';
            c.fillRect(0, 0, canvas.width, 16);

            // Tab icon & name
            c.fillStyle = '#ffffff';
            c.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            c.fillText(`📊 ${sheetName.slice(0, 16)}`, 6, 11);

            // Grid header row
            const startY = 17;
            const rowH = 13;
            const colW = 30;
            const cols = headerCells.slice(0, 4).map(h => h.trim() || 'Col');

            c.fillStyle = '#f1f5f9';
            c.fillRect(0, startY, canvas.width, rowH);
            c.strokeStyle = '#cbd5e1';
            c.lineWidth = 0.8;
            c.strokeRect(0, startY, canvas.width, rowH);

            c.fillStyle = '#64748b';
            c.font = 'bold 7px sans-serif';
            for (let ci = 0; ci < cols.length; ci++) {
              c.fillText(cols[ci].slice(0, 5), 14 + ci * colW, startY + 9);
            }

            // Grid sample rows
            for (let ri = 0; ri < Math.min(5, dataLines.length); ri++) {
              const y = startY + (ri + 1) * rowH;
              if (y > canvas.height - 2) break;

              // Row number cell
              c.fillStyle = '#f8fafc';
              c.fillRect(0, y, 12, rowH);
              c.fillStyle = '#94a3b8';
              c.font = '6px sans-serif';
              c.fillText(String(ri + 1), 3, y + 9);

              // Row border
              c.strokeStyle = '#e2e8f0';
              c.strokeRect(0, y, canvas.width, rowH);

              // Cell contents
              const rowCells = dataLines[ri].split(delimiter);
              c.fillStyle = '#334155';
              c.font = '6px sans-serif';
              for (let ci = 0; ci < cols.length; ci++) {
                const val = (rowCells[ci] || '').trim();
                if (val) {
                  c.fillText(val.slice(0, 6), 14 + ci * colW, y + 9);
                }
              }
            }

            // Overall border
            c.strokeStyle = '#cbd5e1';
            c.lineWidth = 1;
            c.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
          }
        }];
      },
      zoomIn: () => {
        isUserZoomed = true;
        scale += 0.1;
        applyScale();
      },
      zoomOut: () => {
        isUserZoomed = true;
        scale = Math.max(0.2, scale - 0.1);
        applyScale();
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        isUserZoomed = true;
        scale = level;
        applyScale();
      },
      fitToPage: () => {
        isUserZoomed = false;
        scale = calculateFitScale();
        applyScale();
      },
      fitToWidth: () => {
        isUserZoomed = false;
        scale = calculateFitScale();
        applyScale();
      },
      resetZoom: () => {
        isUserZoomed = false;
        scale = calculateFitScale();
        container.scrollTop = 0;
        container.scrollLeft = 0;
        applyScale();
      },
      rotateCW: () => {},
      rotateCCW: () => {},
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
