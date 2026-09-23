import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance,
  Thumbnail 
} from '@patel.sumit51/core';
import * as XLSX from 'xlsx';

export class ExcelPlugin implements PreviewPlugin {
  id = 'excel';
  name = 'Spreadsheet Preview (Excel / OpenDocument)';
  extensions = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.xltx', '.xltm', '.ods'];
  mimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    'application/vnd.ms-excel.template.macroEnabled.12',
    'application/vnd.oasis.opendocument.spreadsheet'
  ];
  weight = 85;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    if (ext) {
      return this.extensions.includes(ext);
    }
    return this.mimeTypes.includes(mime || '');
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    const totalSheets = instance.getPageCount?.() ?? 1;
    const actions: ToolbarAction[] = [];

    actions.push({
      id: 'thumbnails',
      icon: 'thumbnails',
      label: 'Sheet Thumbnails',
      type: 'button',
      group: 'navigation',
      execute: () => (instance as any).toggleThumbnails?.()
    });

    if (totalSheets > 1) {
      actions.push({
        id: 'page-nav',
        icon: '',
        label: 'Sheet Navigation',
        type: 'page-nav',
        group: 'navigation',
        value: instance.getCurrentPage?.() ?? 1,
        max: totalSheets,
        execute: (action: unknown, sheet?: unknown) => {
          const cur = instance.getCurrentPage?.() ?? 1;
          const max = instance.getPageCount?.() ?? 1;
          if (action === 'prev') {
            if (cur > 1) instance.goToPage?.(cur - 1);
          } else if (action === 'next') {
            if (cur < max) instance.goToPage?.(cur + 1);
          } else if (typeof sheet === 'number') {
            instance.goToPage?.(sheet);
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
    const container = document.createElement('div');
    container.className = 'fp-excel-container';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'hidden';

    const contentArea = document.createElement('div');
    contentArea.className = 'fp-excel-content';
    contentArea.style.flex = '1';
    contentArea.style.overflow = 'auto';
    contentArea.style.padding = '16px';
    contentArea.style.boxSizing = 'border-box';

    const tabsArea = document.createElement('div');
    tabsArea.className = 'fp-excel-tabs';
    tabsArea.style.display = 'flex';
    tabsArea.style.gap = '6px';
    tabsArea.style.padding = '8px 16px';
    tabsArea.style.borderTop = '1px solid #e0e0e0';
    tabsArea.style.backgroundColor = '#fafafa';
    tabsArea.style.overflowX = 'auto';
    tabsArea.style.flexShrink = '0';

    container.appendChild(contentArea);
    container.appendChild(tabsArea);
    ctx.container.appendChild(container);

    let scale = 1.0;
    let isUserZoomed = false;
    let currentSheetIndex = 1;
    let sheetNames: string[] = [];
    let wb: XLSX.WorkBook | null = null;

    const applyTransform = () => {
      const sizer = contentArea.querySelector('.fp-excel-sizer') as HTMLElement;
      const table = contentArea.querySelector('table');
      if (!sizer || !table) return;

      if (!(table as any)._baseWidth && table.offsetWidth > 0) {
        (table as any)._baseWidth = table.offsetWidth;
        (table as any)._baseHeight = table.offsetHeight;
      }
      const baseW = (table as any)._baseWidth || table.offsetWidth || 800;
      const baseH = (table as any)._baseHeight || table.offsetHeight || 600;
      const scaledW = Math.round(baseW * scale);
      const scaledH = Math.round(baseH * scale);

      sizer.style.width = `${scaledW}px`;
      sizer.style.height = `${scaledH}px`;
      table.style.position = 'absolute';
      table.style.top = '0';
      table.style.left = '0';
      table.style.transform = `scale(${scale})`;
      table.style.transformOrigin = 'top left';
    };

    const calculateFitScale = () => {
      const table = contentArea.querySelector('table');
      if (!table) return 1.0;
      const availW = Math.max(280, container.clientWidth - 48);
      const tW = (table as any)._baseWidth || table.offsetWidth || 800;
      // Automatically fit table to visible page width
      return Math.max(0.4, Math.min(1.0, availW / tW));
    };

    try {
      wb = XLSX.read(new Uint8Array(ctx.buffer), { type: 'array', cellDates: true });
      sheetNames = wb.SheetNames || [];
    } catch (err) {
      console.warn('[ExcelPlugin] SheetJS parse failed, rendering fallback:', err);
    }

    const tabButtons: HTMLButtonElement[] = [];

    const renderSheet = (index: number) => {
      if (!wb || index < 1 || index > sheetNames.length) return;
      currentSheetIndex = index;
      const sheetName = sheetNames[index - 1];
      const ws = wb.Sheets[sheetName];

      contentArea.innerHTML = '';

      if (!ws) {
        contentArea.innerHTML = '<div style="padding: 24px; color: #888;">Empty sheet</div>';
        return;
      }

      const sizer = document.createElement('div');
      sizer.className = 'fp-excel-sizer';
      sizer.style.position = 'relative';

      const html = XLSX.utils.sheet_to_html(ws, { id: 'fp-sheet-table', editable: false });
      sizer.innerHTML = html;
      contentArea.appendChild(sizer);

      // Style the table
      const table = sizer.querySelector('table');
      if (table) {
        table.style.borderCollapse = 'collapse';
        table.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        table.style.fontSize = '13px';
        table.style.minWidth = '100%';
        table.style.border = '1px solid #d0d7de';
        table.style.background = '#fff';

        table.querySelectorAll('td, th').forEach((cell) => {
          const el = cell as HTMLElement;
          el.style.border = '1px solid #d0d7de';
          el.style.padding = '6px 12px';
          el.style.whiteSpace = 'nowrap';
        });

        table.querySelectorAll('tr:first-child td, th').forEach((cell) => {
          const el = cell as HTMLElement;
          el.style.fontWeight = '600';
          el.style.backgroundColor = '#f6f8fa';
        });
      }

      // Update active tab button
      tabButtons.forEach((b, i) => {
        if (i === index - 1) {
          b.style.backgroundColor = '#2563eb';
          b.style.color = '#fff';
          b.style.borderColor = '#2563eb';
          b.style.fontWeight = '600';
        } else {
          b.style.backgroundColor = '#fff';
          b.style.color = '#333';
          b.style.borderColor = '#ccc';
          b.style.fontWeight = 'normal';
        }
      });

      ctx.emit('page-change', { page: currentSheetIndex, total: sheetNames.length });

      // Automatically set fit to page by default
      requestAnimationFrame(() => {
        if (!isUserZoomed) {
          scale = calculateFitScale();
        }
        applyTransform();
      });
    };

    const ro = new ResizeObserver(() => {
      if (!isUserZoomed) {
        scale = calculateFitScale();
        applyTransform();
      }
    });
    ro.observe(container);

    if (sheetNames.length > 0) {
      sheetNames.forEach((name, idx) => {
        const btn = document.createElement('button');
        btn.textContent = name;
        btn.style.padding = '4px 12px';
        btn.style.fontSize = '12px';
        btn.style.cursor = 'pointer';
        btn.style.border = '1px solid #ccc';
        btn.style.borderRadius = '4px';
        btn.style.backgroundColor = '#fff';
        btn.style.transition = 'all 0.15s ease';
        btn.onclick = () => renderSheet(idx + 1);
        tabsArea.appendChild(btn);
        tabButtons.push(btn);
      });

      renderSheet(1);
    } else {
      contentArea.innerHTML = `
        <div style="text-align:center; padding: 40px; color: #666;">
          <div style="font-size:48px; margin-bottom: 16px;">📊</div>
          <h3>${ctx.metadata.name || 'Spreadsheet'}</h3>
          <p>Unable to load sheet data</p>
        </div>
      `;
    }

    const cleanup = () => {
      ro.disconnect();
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        isUserZoomed = true;
        scale += 0.15;
        applyTransform();
      },
      zoomOut: () => {
        isUserZoomed = true;
        scale = Math.max(0.2, scale - 0.15);
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
        contentArea.scrollTop = 0;
        contentArea.scrollLeft = 0;
        applyTransform();
      },
      rotateCW: () => {},
      rotateCCW: () => {},
      goToPage: (page: number) => {
        if (page > 0 && page <= sheetNames.length) {
          renderSheet(page);
        }
      },
      getPageCount: () => sheetNames.length,
      getCurrentPage: () => currentSheetIndex,
      getThumbnails: (): Thumbnail[] => {
        return sheetNames.map((name, idx) => ({
          index: idx,
          label: name,
          render: async (canvas: HTMLCanvasElement) => {
            canvas.width = 140;
            canvas.height = 100;
            const c = canvas.getContext('2d');
            if (!c) return;

            // Sheet Paper Background
            c.fillStyle = '#ffffff';
            c.fillRect(0, 0, canvas.width, canvas.height);

            // Top Header Bar (Excel Green)
            c.fillStyle = '#107c41';
            c.fillRect(0, 0, canvas.width, 16);

            // Tab icon & name
            c.fillStyle = '#ffffff';
            c.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            c.fillText(`📊 ${name.slice(0, 16)}`, 6, 11);

            // Grid header row (Columns A, B, C, D)
            const startY = 17;
            const rowH = 13;
            const colW = 30;
            const colHeaders = ['A', 'B', 'C', 'D'];

            c.fillStyle = '#f1f5f9';
            c.fillRect(0, startY, canvas.width, rowH);
            c.strokeStyle = '#cbd5e1';
            c.lineWidth = 0.8;
            c.strokeRect(0, startY, canvas.width, rowH);

            c.fillStyle = '#64748b';
            c.font = 'bold 7px sans-serif';
            for (let ci = 0; ci < colHeaders.length; ci++) {
              c.fillText(colHeaders[ci], 14 + ci * colW, startY + 9);
            }

            // Grid rows
            const ws = wb?.Sheets[name];
            for (let ri = 1; ri <= 5; ri++) {
              const y = startY + ri * rowH;
              if (y > canvas.height - 2) break;

              // Row number cell
              c.fillStyle = '#f8fafc';
              c.fillRect(0, y, 12, rowH);
              c.fillStyle = '#94a3b8';
              c.font = '6px sans-serif';
              c.fillText(String(ri), 3, y + 9);

              // Row border
              c.strokeStyle = '#e2e8f0';
              c.strokeRect(0, y, canvas.width, rowH);

              // Cell contents
              c.fillStyle = '#334155';
              c.font = '6px sans-serif';
              for (let ci = 0; ci < colHeaders.length; ci++) {
                const cellRef = `${colHeaders[ci]}${ri}`;
                const cellVal = ws?.[cellRef]?.w || ws?.[cellRef]?.v;
                if (cellVal !== undefined) {
                  c.fillText(String(cellVal).slice(0, 6), 14 + ci * colW, y + 9);
                }
              }
            }

            // Overall border
            c.strokeStyle = '#cbd5e1';
            c.lineWidth = 1;
            c.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
          }
        }));
      },
      download: () => {
        const blob = new Blob([ctx.buffer], { type: this.mimeTypes[0] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'spreadsheet.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        window.print();
      }
    };
  }
}

export function excelPlugin(): ExcelPlugin {
  return new ExcelPlugin();
}

export default ExcelPlugin;
