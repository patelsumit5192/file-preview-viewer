import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
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
  weight = 80;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    if (ext) {
      return this.extensions.includes(ext);
    }
    return this.mimeTypes.includes(mime || '');
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
        id: 'page-nav',
        icon: 'page-nav',
        label: 'Sheet Navigation',
        type: 'page-nav',
        group: 'navigation',
        execute: (sheet?: unknown) => {
          if (typeof sheet === 'number') instance.goToPage?.(sheet);
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
    contentArea.style.transformOrigin = 'top left';

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
    let currentSheetIndex = 1;
    let sheetNames: string[] = [];
    let wb: XLSX.WorkBook | null = null;

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

      const html = XLSX.utils.sheet_to_html(ws, { id: 'fp-sheet-table', editable: false });
      contentArea.innerHTML = html;

      // Style the table
      const table = contentArea.querySelector('table');
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
    };

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
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        scale += 0.1;
        contentArea.style.transform = `scale(${scale})`;
      },
      zoomOut: () => {
        scale = Math.max(0.2, scale - 0.1);
        contentArea.style.transform = `scale(${scale})`;
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        contentArea.style.transform = `scale(${scale})`;
      },
      goToPage: (page: number) => {
        if (page > 0 && page <= sheetNames.length) {
          renderSheet(page);
        }
      },
      getPageCount: () => sheetNames.length,
      getCurrentPage: () => currentSheetIndex,
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
