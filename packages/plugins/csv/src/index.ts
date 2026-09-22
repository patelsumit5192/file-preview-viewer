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
    const totalPages = instance.getPageCount?.() ?? 1;
    const actions: ToolbarAction[] = [];

    actions.push({
      id: 'thumbnails',
      icon: 'thumbnails',
      label: 'Page Thumbnails',
      type: 'button',
      group: 'navigation',
      execute: () => (instance as any).toggleThumbnails?.()
    });

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
        id: 'fit-page',
        icon: 'fit-page',
        label: 'Fit to View',
        type: 'button',
        group: 'zoom',
        execute: () => {
          instance.fitToPage?.();
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
    container.style.transformOrigin = 'top left';
    
    const delimiter = ctx.metadata.extension === '.tsv' ? '\t' : ',';
    const allLines = text.split(/\r?\n/).filter(r => r.trim().length > 0);
    const headerLine = allLines[0] || '';
    const headerCells = headerLine.split(delimiter);
    const dataLines = allLines.slice(1);

    const ROWS_PER_PAGE = 100;
    const totalPages = Math.max(1, Math.ceil(dataLines.length / ROWS_PER_PAGE));
    let currentPage = 1;

    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    table.style.fontSize = '13px';
    
    const renderPage = (pageNum: number) => {
      currentPage = Math.max(1, Math.min(totalPages, pageNum));
      table.innerHTML = '';

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

      // Data rows for current page
      const start = (currentPage - 1) * ROWS_PER_PAGE;
      const end = Math.min(dataLines.length, start + ROWS_PER_PAGE);
      const pageRows = dataLines.slice(start, end);

      pageRows.forEach((row, idx) => {
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

      container.scrollTop = 0;
      ctx.emit('page-change', { page: currentPage, total: totalPages });
    };

    renderPage(1);
    container.appendChild(table);
    ctx.container.appendChild(container);

    let scale = 1.0;

    const applyScale = () => {
      container.style.transform = `scale(${scale})`;
      container.style.transformOrigin = 'top left';
    };

    const cleanup = () => {
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      getPageCount: () => totalPages,
      getCurrentPage: () => currentPage,
      goToPage: (page: number) => renderPage(page),
      getThumbnails: (): Thumbnail[] => {
        const thumbnails: Thumbnail[] = [];
        for (let i = 0; i < totalPages; i++) {
          const pageIdx = i;
          const startRow = pageIdx * ROWS_PER_PAGE + 1;
          const endRow = Math.min(dataLines.length, (pageIdx + 1) * ROWS_PER_PAGE);
          const label = totalPages === 1 ? 'Table' : `Page ${pageIdx + 1} (${startRow}-${endRow})`;

          thumbnails.push({
            index: pageIdx,
            label,
            render: async (canvas: HTMLCanvasElement) => {
              canvas.width = 140;
              canvas.height = 100;
              const c = canvas.getContext('2d');
              if (!c) return;

              // White Background
              c.fillStyle = '#ffffff';
              c.fillRect(0, 0, canvas.width, canvas.height);

              // Top Header Bar (Blue)
              c.fillStyle = '#2563eb';
              c.fillRect(0, 0, canvas.width, 16);

              // Tab text
              c.fillStyle = '#ffffff';
              c.font = 'bold 8px sans-serif';
              c.fillText(`📈 ${label.slice(0, 18)}`, 6, 11);

              // Grid header row
              const startY = 17;
              const rowH = 13;
              const colW = 28;
              const cols = Math.min(4, headerCells.length || 4);

              c.fillStyle = '#f1f5f9';
              c.fillRect(0, startY, canvas.width, rowH);
              c.strokeStyle = '#cbd5e1';
              c.lineWidth = 0.8;
              c.strokeRect(0, startY, canvas.width, rowH);

              c.fillStyle = '#64748b';
              c.font = 'bold 7px sans-serif';
              for (let ci = 0; ci < cols; ci++) {
                const hName = headerCells[ci] || `Col ${ci + 1}`;
                c.fillText(hName.slice(0, 5), 8 + ci * colW, startY + 9);
              }

              // Sample rows
              const rowsToPreview = dataLines.slice(pageIdx * ROWS_PER_PAGE, pageIdx * ROWS_PER_PAGE + 5);
              for (let ri = 0; ri < rowsToPreview.length; ri++) {
                const y = startY + (ri + 1) * rowH;
                if (y > canvas.height - 2) break;

                c.strokeStyle = '#e2e8f0';
                c.strokeRect(0, y, canvas.width, rowH);

                const cVals = rowsToPreview[ri].split(delimiter);
                c.fillStyle = '#334155';
                c.font = '6px sans-serif';
                for (let ci = 0; ci < cols; ci++) {
                  const val = cVals[ci] || '';
                  c.fillText(val.trim().slice(0, 6), 8 + ci * colW, y + 9);
                }
              }

              // Border
              c.strokeStyle = '#cbd5e1';
              c.lineWidth = 1;
              c.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
            }
          });
        }
        return thumbnails;
      },
      zoomIn: () => {
        scale += 0.1;
        applyScale();
      },
      zoomOut: () => {
        scale = Math.max(0.2, scale - 0.1);
        applyScale();
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        applyScale();
      },
      fitToPage: () => {
        const availW = Math.max(280, (ctx.container.clientWidth || window.innerWidth) - 48);
        const tW = table.offsetWidth || 600;
        scale = Math.max(0.35, Math.min(1.0, availW / tW));
        applyScale();
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
