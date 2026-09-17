import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import ExcelJS from 'exceljs';

export class ExcelPlugin implements PreviewPlugin {
  id = 'excel';
  name = 'Excel Spreadsheet Preview';
  extensions = ['.xlsx', '.xls'];
  mimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  weight = 80;

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
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'hidden';

    const contentArea = document.createElement('div');
    contentArea.style.flex = '1';
    contentArea.style.overflow = 'auto';
    contentArea.style.padding = '16px';
    contentArea.style.transformOrigin = 'top left';

    const tabsArea = document.createElement('div');
    tabsArea.style.display = 'flex';
    tabsArea.style.gap = '8px';
    tabsArea.style.padding = '8px 16px';
    tabsArea.style.borderTop = '1px solid #e0e0e0';
    tabsArea.style.backgroundColor = '#fafafa';
    tabsArea.style.overflowX = 'auto';

    container.appendChild(contentArea);
    container.appendChild(tabsArea);
    ctx.container.appendChild(container);

    let scale = 1.0;
    let currentSheetIndex = 1;
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(ctx.buffer);
    } catch {
      // Fallback
    }

    const renderSheet = (index: number) => {
      contentArea.innerHTML = '';
      const sheet = workbook.getWorksheet(index);
      if (!sheet) return;

      const table = document.createElement('table');
      table.style.borderCollapse = 'collapse';
      table.style.fontFamily = 'sans-serif';
      table.style.fontSize = '13px';
      table.style.minWidth = '100%';

      sheet.eachRow({ includeEmpty: false }, (row) => {
        const tr = document.createElement('tr');
        row.eachCell({ includeEmpty: true }, (cell) => {
          const td = document.createElement('td');
          td.style.border = '1px solid #d0d7de';
          td.style.padding = '6px 12px';
          td.textContent = cell.text || '';
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });

      contentArea.appendChild(table);
      currentSheetIndex = index;
    };

    workbook.worksheets.forEach((sheet, idx) => {
      const btn = document.createElement('button');
      btn.textContent = sheet.name;
      btn.style.padding = '4px 12px';
      btn.style.fontSize = '12px';
      btn.style.cursor = 'pointer';
      btn.style.border = '1px solid #ccc';
      btn.style.borderRadius = '4px';
      btn.style.backgroundColor = '#fff';
      btn.onclick = () => renderSheet(idx + 1);
      tabsArea.appendChild(btn);
    });

    if (workbook.worksheets.length > 0) {
      renderSheet(1);
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
        if (page > 0 && page <= workbook.worksheets.length) {
          renderSheet(page);
        }
      },
      getPageCount: () => workbook.worksheets.length,
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
