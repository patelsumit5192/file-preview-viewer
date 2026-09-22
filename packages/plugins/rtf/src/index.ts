import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance,
  Thumbnail
} from '@patel.sumit51/core';
// @ts-ignore - rtf.js bundle has no individual d.ts
import * as RTFJS from 'rtf.js/dist/RTFJS.bundle.js';

interface ParsedRtfTable {
  id: string;
  rows: string[][];
  colPercents: number[];
  anchorBefore?: string;
  anchorAfter?: string;
}

function cleanRtfText(raw: string): string {
  return raw
    .replace(/\\bin\d+\s/g, '')
    .replace(/{\\\*[^}]+}/g, '')
    .replace(/\\u(-?\d+)\??/g, (_, code) => {
      let num = parseInt(code, 10);
      if (num < 0) num += 65536;
      return String.fromCharCode(num);
    })
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    })
    .replace(/\\tab\b/g, ' ')
    .replace(/\\emdash\b/g, '—')
    .replace(/\\endash\b/g, '–')
    .replace(/\\bullet\b/g, '•')
    .replace(/\\lquote\b/g, '‘')
    .replace(/\\rquote\b/g, '’')
    .replace(/\\ldblquote\b/g, '“')
    .replace(/\\rdblquote\b/g, '”')
    .replace(/\\\w+(?:-?\d+)?\s?/g, ' ')
    .replace(/[{}\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRtfTables(rtfText: string): ParsedRtfTable[] {
  const rowSegments = rtfText.split(/\\row\b/);
  if (rowSegments.length <= 1) return [];

  interface RawTable {
    id: string;
    startPos: number;
    lastEnd: number;
    rows: { cells: string[]; widths: number[] }[];
    columnWidths: number[];
    anchorBefore: string;
    anchorAfter: string;
  }

  const rawTables: RawTable[] = [];
  let currentTable: RawTable | null = null;
  let charOffset = 0;

  for (let i = 0; i < rowSegments.length - 1; i++) {
    const segment = rowSegments[i];
    const segmentStart = charOffset;
    const segmentEnd = charOffset + segment.length + 4; // + \row

    const cellParts = segment.split(/\\cell\b/);
    if (cellParts.length > 1) {
      // Extract cellx definitions for column widths
      const cellxMatches = [...segment.matchAll(/\\cellx(\d+)/g)].map(m => parseInt(m[1], 10));
      let cellWidths: number[] = [];
      if (cellxMatches.length > 0) {
        let seq = [cellxMatches[0]];
        for (let k = 1; k < cellxMatches.length; k++) {
          if (cellxMatches[k] > cellxMatches[k - 1]) seq.push(cellxMatches[k]);
          else break;
        }
        let prev = 0;
        cellWidths = seq.map(x => {
          const w = x - prev;
          prev = x;
          return w;
        });
      }

      const cells: string[] = [];
      for (let c = 0; c < cellParts.length - 1; c++) {
        let rawCell = cellParts[c];
        if (c === 0) {
          const lastTrowd = rawCell.lastIndexOf('\\trowd');
          if (lastTrowd !== -1) rawCell = rawCell.slice(lastTrowd);
        }
        cells.push(cleanRtfText(rawCell));
      }

      // Check if this row belongs to currentTable
      const isNewTable = !currentTable || (segmentStart - currentTable.lastEnd > 2500);
      if (isNewTable) {
        const prevTextSlice = rtfText.slice(Math.max(0, segmentStart - 4000), segmentStart);
        const cleanPrev = cleanRtfText(prevTextSlice);
        const anchorBefore = cleanPrev.slice(-80).trim();

        currentTable = {
          id: `RTF_TABLE_${rawTables.length}`,
          startPos: segmentStart,
          lastEnd: segmentEnd,
          rows: [],
          columnWidths: cellWidths,
          anchorBefore,
          anchorAfter: ''
        };
        rawTables.push(currentTable);
      }

      if (currentTable) {
        currentTable.rows.push({
          cells,
          widths: cellWidths.length === cells.length ? cellWidths : currentTable.columnWidths
        });
        currentTable.lastEnd = segmentEnd;
      }
    }

    charOffset += segment.length + 4;
  }

  rawTables.forEach(tbl => {
    const afterSlice = rtfText.slice(tbl.lastEnd, Math.min(rtfText.length, tbl.lastEnd + 2000));
    const cleanAfter = cleanRtfText(afterSlice);
    tbl.anchorAfter = cleanAfter.slice(0, 80).trim();
  });

  return rawTables.map(tbl => {
    const totalW = (tbl.columnWidths || []).reduce((a, b) => a + b, 0);
    const colPercents = totalW > 0
      ? tbl.columnWidths.map(w => Math.round((w / totalW) * 100))
      : [];

    return {
      id: tbl.id,
      rows: tbl.rows.map(r => r.cells),
      colPercents,
      anchorBefore: tbl.anchorBefore,
      anchorAfter: tbl.anchorAfter
    };
  });
}

function renderRtfTableElement(table: ParsedRtfTable): HTMLElement {
  const tableEl = document.createElement('table');
  tableEl.className = 'fp-rtf-table';
  tableEl.style.width = '100%';
  tableEl.style.borderCollapse = 'collapse';
  tableEl.style.margin = '16px 0 20px';
  tableEl.style.fontSize = '10pt';
  tableEl.style.lineHeight = '1.5';
  tableEl.style.border = '1px solid #cbd5e1';
  tableEl.style.borderRadius = '4px';
  tableEl.style.boxSizing = 'border-box';
  tableEl.style.backgroundColor = '#ffffff';

  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  table.rows.forEach((rowCells, rIdx) => {
    const tr = document.createElement('tr');
    const isHeader = rIdx === 0;

    if (isHeader) {
      tr.style.backgroundColor = '#f8fafc';
      tr.style.borderBottom = '2px solid #cbd5e1';
    } else {
      tr.style.borderBottom = '1px solid #e2e8f0';
      if (rIdx % 2 === 0) {
        tr.style.backgroundColor = '#fcfdfe';
      }
    }

    rowCells.forEach((cellText, cIdx) => {
      const cellEl = document.createElement(isHeader ? 'th' : 'td');
      cellEl.style.padding = '8px 12px';
      cellEl.style.border = '1px solid #cbd5e1';
      cellEl.style.verticalAlign = 'top';
      cellEl.style.color = isHeader ? '#0f172a' : '#1e293b';
      cellEl.style.fontWeight = isHeader ? '600' : 'normal';

      if (table.colPercents && table.colPercents[cIdx]) {
        cellEl.style.width = `${table.colPercents[cIdx]}%`;
      }

      if (/^\d+$/.test(cellText.trim()) || cellText.trim() === '#') {
        cellEl.style.textAlign = 'center';
      } else {
        cellEl.style.textAlign = 'left';
      }

      cellEl.textContent = cellText;
      tr.appendChild(cellEl);
    });

    if (isHeader) {
      thead.appendChild(tr);
    } else {
      tbody.appendChild(tr);
    }
  });

  tableEl.appendChild(thead);
  tableEl.appendChild(tbody);
  return tableEl;
}

export class RtfPlugin implements PreviewPlugin {
  id = 'rtf';
  name = 'Rich Text Format (RTF)';
  extensions = ['.rtf'];
  mimeTypes = ['text/rtf', 'application/rtf'];
  weight = 80;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    return this.extensions.includes(ext || '') || this.mimeTypes.includes(mime || '');
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    const totalPages = instance.getPageCount?.() ?? 1;
    const actions: ToolbarAction[] = [];

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

    actions.push(
      {
        id: 'thumbnails',
        icon: 'thumbnails',
        label: 'Thumbnails',
        type: 'button',
        group: 'view',
        execute: () => (instance as any).toggleThumbnails?.()
      },
      {
        id: 'zoom-out',
        icon: 'zoom-out',
        label: 'Zoom Out',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomOut?.()
      },
      {
        id: 'zoom-in',
        icon: 'zoom-in',
        label: 'Zoom In',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomIn?.()
      },
      {
        id: 'fit-page',
        icon: 'fit-page',
        label: 'Fit to Page',
        type: 'button',
        group: 'zoom',
        execute: () => instance.fitToPage?.()
      },
      {
        id: 'rotate-cw',
        icon: 'rotate-cw',
        label: 'Rotate',
        type: 'button',
        group: 'view',
        execute: () => instance.rotateCW?.()
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download',
        type: 'button',
        group: 'actions',
        execute: () => instance.download?.()
      },
      {
        id: 'copy',
        icon: 'copy',
        label: 'Copy Text',
        type: 'button',
        group: 'actions',
        execute: () => (instance as any).copy?.()
      },
      {
        id: 'print',
        icon: 'print',
        label: 'Print',
        type: 'button',
        group: 'actions',
        execute: () => instance.print?.()
      },
      {
        id: 'open-window',
        icon: 'open-window',
        label: 'Open in Separate Full Window',
        type: 'button',
        group: 'actions',
        execute: () => (instance as any).openInSeparateWindow?.()
      }
    );

    return actions;
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const wrapper = document.createElement('div');
    wrapper.className = 'fp-rtf-wrapper';
    wrapper.style.padding = '0';
    wrapper.style.width = '816px';
    wrapper.style.margin = '0 auto';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.backgroundColor = 'transparent';
    wrapper.style.transformOrigin = 'top center';
    wrapper.style.transition = 'transform 0.15s ease';

    ctx.container.style.overflowX = 'hidden';
    ctx.container.style.overflowY = 'auto';
    ctx.container.style.padding = '16px 8px';
    ctx.container.style.backgroundColor = '#f1f5f9';
    ctx.container.appendChild(wrapper);

    let scale = 1.0;
    let rotation = 0;
    let pageElements: HTMLElement[] = [];
    let isUserZoomed = false;

    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'width';

    const calculateFitScale = (mode: 'width' | 'page' = fitMode) => {
      const activeEl = pageElements[currentPage - 1] || wrapper;
      const elW = 816;
      const singlePageH = activeEl?.offsetHeight || 1056;
      const availW = Math.max(280, ctx.container.clientWidth - 32);
      const availH = Math.max(280, ctx.container.clientHeight - 32);

      const sW = availW / elW;
      const sH = availH / singlePageH;

      if (mode === 'page') {
        return Math.max(0.35, Math.min(3.0, Math.min(sW, sH)));
      }
      return Math.max(0.4, Math.min(3.0, sW));
    };

    const applyTransform = () => {
      wrapper.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
      wrapper.style.transformOrigin = 'top center';
      const activeEl = pageElements[currentPage - 1];
      const baseH = activeEl?.offsetHeight || 1056;
      const scaledH = baseH * scale;
      const extraH = Math.max(0, scaledH - baseH);
      wrapper.style.marginBottom = `${extraH + 32}px`;
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (!isUserZoomed) {
            scale = calculateFitScale(fitMode);
            applyTransform();
          }
        })
      : null;
    resizeObserver?.observe(ctx.container);

    setTimeout(() => {
      scale = calculateFitScale(fitMode);
      applyTransform();
    }, 60);

    try {
      if (typeof (RTFJS as any).loggingEnabled === 'function') {
        (RTFJS as any).loggingEnabled(false);
      }

      // Pre-extract tables from RTF
      const rawText = new TextDecoder('latin1').decode(ctx.buffer);
      const tables = parseRtfTables(rawText);

      // Render document with RTFJS
      const doc = new (RTFJS as any).Document(ctx.buffer, {});
      const htmlElements = await doc.render();

      // Collect block-level elements without flattening paragraphs into raw inline spans
      const contentNodes: HTMLElement[] = [];
      const extractBlocks = (nodes: any[]) => {
        for (const item of nodes) {
          if (!item || !(item instanceof HTMLElement)) continue;
          const tag = item.tagName.toLowerCase();
          
          const hasChildBlocks = Array.from(item.children).some(c => {
            const ct = c.tagName.toLowerCase();
            return ['p', 'div', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'ul', 'ol'].includes(ct);
          });

          if (hasChildBlocks && !['table', 'tr', 'td', 'th', 'ul', 'ol', 'li'].includes(tag)) {
            extractBlocks(Array.from(item.children));
          } else {
            // Constrain images/SVGs to standard page width and reasonable height
            const svgs = item.querySelectorAll('svg, img');
            svgs.forEach(s => {
              const el = s as HTMLElement;
              el.style.maxWidth = '100%';
              el.style.maxHeight = '360px';
              el.style.display = 'block';
              el.style.margin = '12px auto';
              if (s.tagName.toLowerCase() === 'svg') {
                s.removeAttribute('width');
                s.removeAttribute('height');
                el.style.width = '100%';
                el.style.maxHeight = '360px';
              }
            });

            if (tag === 'p' || tag === 'div') {
              item.style.display = 'block';
              item.style.marginBottom = '12px';
              item.style.lineHeight = '1.6';
            }
            contentNodes.push(item);
          }
        }
      };

      extractBlocks(htmlElements);

      // Insert parsed tables at their semantic positions in contentNodes
      tables.forEach(table => {
        const tableEl = renderRtfTableElement(table);
        let inserted = false;

        // Try anchorBefore match: find node whose text contains part of anchorBefore
        if (table.anchorBefore && table.anchorBefore.length > 10) {
          const keyword = table.anchorBefore.slice(-35).trim();
          for (let i = 0; i < contentNodes.length; i++) {
            if (contentNodes[i].textContent?.includes(keyword)) {
              contentNodes.splice(i + 1, 0, tableEl);
              inserted = true;
              break;
            }
          }
        }

        // Try anchorAfter match if not inserted: find node whose text contains start of anchorAfter
        if (!inserted && table.anchorAfter && table.anchorAfter.length > 10) {
          const keyword = table.anchorAfter.slice(0, 35).trim();
          for (let i = 0; i < contentNodes.length; i++) {
            if (contentNodes[i].textContent?.includes(keyword)) {
              contentNodes.splice(i, 0, tableEl);
              inserted = true;
              break;
            }
          }
        }

        // Fallback: insert after first major block
        if (!inserted) {
          if (contentNodes.length > 2) {
            contentNodes.splice(2, 0, tableEl);
          } else {
            contentNodes.push(tableEl);
          }
        }
      });

      // Temporarily mount to wrapper to measure real layout heights
      wrapper.innerHTML = '';
      contentNodes.forEach(node => wrapper.appendChild(node));

      const childHeights = contentNodes.map(c => {
        const rectH = c.getBoundingClientRect ? c.getBoundingClientRect().height : 0;
        const offH = c.offsetHeight || 0;
        const realH = Math.max(rectH, offH);
        if (realH > 0) return realH;
        const textLen = c.textContent?.trim().length || 0;
        return Math.max(24, Math.ceil(textLen / 95) * 22 + 12);
      });

      wrapper.innerHTML = '';

      const createRtfCard = () => {
        const card = document.createElement('div');
        card.className = 'fp-rtf-page-card';
        card.style.backgroundColor = '#ffffff';
        card.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
        card.style.borderRadius = '4px';
        card.style.padding = '64px 56px';
        card.style.width = '816px';
        card.style.minHeight = '1056px';
        card.style.boxSizing = 'border-box';
        card.style.marginBottom = '24px';
        card.style.fontFamily = 'Calibri, "Segoe UI", Arial, sans-serif';
        card.style.lineHeight = '1.6';
        card.style.color = '#1e293b';
        return card;
      };

      let curCard = createRtfCard();
      wrapper.appendChild(curCard);
      pageElements = [curCard];
      let curH = 0;
      const maxH = 928; // 1056px - 128px margins

      for (let i = 0; i < contentNodes.length; i++) {
        const child = contentNodes[i];
        const chH = childHeights[i];
        const isChildEmpty = (child.textContent || '').trim().length === 0 && !child.querySelector('table, img, svg, canvas');

        if (curH === 0 && isChildEmpty) {
          continue;
        }

        if (curH + chH > maxH && curCard.childNodes.length > 0) {
          curCard = createRtfCard();
          wrapper.appendChild(curCard);
          pageElements.push(curCard);
          curH = 0;
        }

        curCard.appendChild(child);
        curH += chH;
      }

      // Eliminate empty trailing cards / ghost pages
      pageElements = pageElements.filter(card => {
        const hasText = (card.textContent || '').trim().length > 0;
        const hasMedia = card.querySelector('table, img, svg, canvas') !== null;
        return hasText || hasMedia;
      });

      if (pageElements.length === 0) {
        pageElements = [curCard];
      }
    } catch (err) {
      console.warn('[RtfPlugin] RTF render error, fallback text:', err);
      const text = new TextDecoder('latin1').decode(ctx.buffer);
      const tables = parseRtfTables(text);

      const rawPages = text.split(/\\page\b/).map(segment => {
        return segment.replace(/\\par[d]?/g, '\n').replace(/\\[a-zA-Z0-9\-]+/g, '').replace(/[{}]/g, '').trim();
      }).filter(p => p.length > 0);

      const pages = rawPages.length > 0 ? rawPages : [text.replace(/\\par[d]?/g, '\n').replace(/\\[a-zA-Z0-9\-]+/g, '').replace(/[{}]/g, '').trim()];
      
      for (let i = 0; i < pages.length; i++) {
        const pageCard = document.createElement('div');
        pageCard.className = 'fp-rtf-page-card';
        pageCard.style.backgroundColor = '#ffffff';
        pageCard.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
        pageCard.style.borderRadius = '4px';
        pageCard.style.padding = '64px 56px';
        pageCard.style.width = '816px';
        pageCard.style.minHeight = '1056px';
        pageCard.style.boxSizing = 'border-box';
        pageCard.style.fontFamily = 'Calibri, "Segoe UI", Arial, sans-serif';
        pageCard.style.fontSize = '12pt';
        pageCard.style.lineHeight = '1.6';
        pageCard.style.color = '#1e293b';
        pageCard.style.whiteSpace = 'pre-wrap';
        pageCard.style.display = i === 0 ? 'block' : 'none';
        pageCard.textContent = pages[i];

        if (i === 1 && tables.length > 0) {
          tables.forEach(tbl => pageCard.appendChild(renderRtfTableElement(tbl)));
        }

        wrapper.appendChild(pageCard);
        pageElements.push(pageCard);
      }
    }

    const totalPages = Math.max(1, pageElements.length);
    let currentPage = 1;

    const showPage = (pageNum: number) => {
      currentPage = Math.max(1, Math.min(totalPages, pageNum));
      if (totalPages > 1) {
        pageElements.forEach((el, idx) => {
          el.style.display = idx + 1 === currentPage ? 'block' : 'none';
        });
      }
      ctx.container.scrollTop = 0;
      ctx.emit('page-change', { page: currentPage, total: totalPages });
    };

    if (totalPages > 1) {
      showPage(1);
    }

    const cleanup = () => {
      resizeObserver?.disconnect();
      wrapper.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      getPageCount: () => totalPages,
      getCurrentPage: () => currentPage,
      goToPage: (page: number) => showPage(page),
      getThumbnails: async (): Promise<Thumbnail[]> => {
        const items: Thumbnail[] = [];
        for (let idx = 0; idx < totalPages; idx++) {
          const pageIdx = idx;
          items.push({
            index: pageIdx,
            label: `Page ${pageIdx + 1}`,
            render: async (canvas: HTMLCanvasElement) => {
              const ctx2d = canvas.getContext('2d');
              if (!ctx2d) return;
              canvas.width = 140;
              canvas.height = 180;
              ctx2d.fillStyle = '#ffffff';
              ctx2d.fillRect(0, 0, 140, 180);
              ctx2d.strokeStyle = '#cbd5e1';
              ctx2d.lineWidth = 1;
              ctx2d.strokeRect(0.5, 0.5, 139, 179);
              ctx2d.fillStyle = '#334155';
              ctx2d.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx2d.textAlign = 'center';
              ctx2d.fillText(`Page ${pageIdx + 1}`, 70, 95);
            }
          });
        }
        return items;
      },
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
        fitMode = 'width';
        scale = calculateFitScale('width');
        rotation = 0;
        applyTransform();
      },
      rotateCW: () => {
        rotation = (rotation + 90) % 360;
        applyTransform();
      },
      rotateCCW: () => {
        rotation = (rotation - 90 + 360) % 360;
        applyTransform();
      },
      download: () => {
        const blob = new Blob([ctx.buffer], { type: 'application/rtf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'document.rtf';
        a.click();
        URL.revokeObjectURL(url);
      },
      copy: () => {
        const text = wrapper.textContent || '';
        navigator.clipboard?.writeText(text);
      },
      print: () => {
        window.print();
      }
    };
  }
}

export function rtfPlugin(): RtfPlugin {
  return new RtfPlugin();
}

export default RtfPlugin;
