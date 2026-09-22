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
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, ' ')
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

      const isNewTable = !currentTable || (segmentStart - currentTable.lastEnd > 2500);
      if (isNewTable) {
        currentTable = {
          id: `RTF_TABLE_${rawTables.length}`,
          startPos: segmentStart,
          lastEnd: segmentEnd,
          rows: [],
          columnWidths: cellWidths
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

  return rawTables.map(tbl => {
    const totalW = (tbl.columnWidths || []).reduce((a, b) => a + b, 0);
    const colPercents = totalW > 0
      ? tbl.columnWidths.map(w => Math.round((w / totalW) * 100))
      : [];

    return {
      id: tbl.id,
      rows: tbl.rows.map(r => r.cells),
      colPercents
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
  tableEl.style.backgroundColor = '#ffffff';

  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  table.rows.forEach((rowCells, rIdx) => {
    const tr = document.createElement('tr');
    const isHeader = rIdx === 0;

    if (isHeader) {
      tr.style.backgroundColor = '#f8fafc';
    }

    rowCells.forEach((cellText, cIdx) => {
      const cellEl = document.createElement(isHeader ? 'th' : 'td');
      cellEl.style.padding = '8px 12px';
      cellEl.style.border = '1px solid #cbd5e1';
      cellEl.style.verticalAlign = 'top';

      if (table.colPercents && table.colPercents[cIdx]) {
        cellEl.style.width = `${table.colPercents[cIdx]}%`;
      }

      if (/^\d+$/.test(cellText.trim()) || cellText.trim() === '#') {
        cellEl.style.textAlign = 'center';
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

function isHeadingElement(el: HTMLElement): boolean {
  if (['H1', 'H2', 'H3', 'H4'].includes(el.tagName)) return true;
  const spans = el.querySelectorAll ? Array.from(el.querySelectorAll('span, b, strong, div')) : [];
  for (const s of spans) {
    const hEl = s as HTMLElement;
    const fs = parseFloat(hEl.style.fontSize) || 0;
    const isBold = hEl.style.fontWeight === 'bold' || parseInt(hEl.style.fontWeight, 10) >= 600 || ['B', 'STRONG'].includes(hEl.tagName);
    if (isBold && fs >= 14) return true;
  }
  const elFs = parseFloat(el.style.fontSize) || 0;
  const elBold = el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight, 10) >= 600;
  if (elBold && elFs >= 14) return true;
  return false;
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
    const rawRtf = new TextDecoder('latin1').decode(ctx.buffer);

    // --- 1. DYNAMIC PAGE SETUP FROM RTF STREAM ---
    const paperwMatch = rawRtf.match(/\\paperw(\d+)/);
    const paperhMatch = rawRtf.match(/\\paperh(\d+)/);
    const marglMatch = rawRtf.match(/\\margl(\d+)/);
    const margrMatch = rawRtf.match(/\\margr(\d+)/);
    const margtMatch = rawRtf.match(/\\margt(\d+)/);
    const margbMatch = rawRtf.match(/\\margb(\d+)/);

    const paperwTwips = paperwMatch ? parseInt(paperwMatch[1], 10) : 11906;
    const paperhTwips = paperhMatch ? parseInt(paperhMatch[1], 10) : 16838;
    const marglTwips = marglMatch ? parseInt(marglMatch[1], 10) : 1134;
    const margrTwips = margrMatch ? parseInt(margrMatch[1], 10) : 1134;
    const margtTwips = margtMatch ? parseInt(margtMatch[1], 10) : 1134;
    const margbTwips = margbMatch ? parseInt(margbMatch[1], 10) : 1134;

    const pageWidth = Math.round(paperwTwips / 15);
    const pageHeight = Math.round(paperhTwips / 15);
    const padLeft = Math.round(marglTwips / 15);
    const padRight = Math.round(margrTwips / 15);
    const padTop = Math.round(margtTwips / 15);
    const padBottom = Math.round(margbTwips / 15);
    const printableHeight = pageHeight - padTop - padBottom;

    // --- 2. DYNAMIC RAW IMAGE EXTRACTION ---
    const extractedImages: { mime: string; dataUrl: string; offset: number }[] = [];
    let p = 0;
    while ((p = rawRtf.indexOf('\\pict', p)) !== -1) {
      const startP = p;
      p += 5;
      const header = rawRtf.substring(startP, startP + 600);
      let mime = '';
      let magic = '';
      if (header.includes('\\pngblip')) {
        mime = 'image/png';
        magic = '89504e47';
      } else if (header.includes('\\jpegblip')) {
        mime = 'image/jpeg';
        magic = 'ffd8ff';
      }
      if (!mime || !magic) continue;
      const magicPos = rawRtf.indexOf(magic, startP);
      if (magicPos === -1 || magicPos - startP > 3000) continue;
      let endP = magicPos;
      while (endP < rawRtf.length && /[0-9a-fA-F\r\n\s]/.test(rawRtf[endP])) {
        endP++;
      }
      const cleanHex = rawRtf.substring(magicPos, endP).replace(/[\r\n\s]/g, '');
      if (cleanHex.length < 100) continue;
      const hexLen = cleanHex.length / 2;
      const u8 = new Uint8Array(hexLen);
      for (let k = 0; k < hexLen; k++) {
        u8[k] = parseInt(cleanHex.substr(k * 2, 2), 16);
      }
      let bStr = '';
      for (let k = 0; k < u8.length; k += 8192) {
        bStr += String.fromCharCode.apply(null, Array.from(u8.subarray(k, k + 8192)));
      }
      extractedImages.push({ mime, dataUrl: `data:${mime};base64,${btoa(bStr)}`, offset: startP });
    }

    // --- 3. PARSE DYNAMIC TABLES ---
    const tables = parseRtfTables(rawRtf);

    const wrapper = document.createElement('div');
    wrapper.className = 'fp-rtf-wrapper';
    wrapper.style.padding = '0';
    wrapper.style.width = `${pageWidth}px`;
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
      const elW = pageWidth;
      const singlePageH = pageHeight;
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
      const baseH = pageHeight;
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

      // Render document with RTFJS
      const doc = new (RTFJS as any).Document(ctx.buffer, {
        onPicture: (isLegacy: boolean | null, createPic: () => HTMLElement) => {
          if (isLegacy === true) return null;
          return createPic();
        }
      });
      const elements: HTMLElement[] = await doc.render();

      // Replace [Unsupported image format] with extracted high-res raw images
      let unsupportedIndex = 1;
      const usedTables = new Set<number>();

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const text = el.textContent || '';

        if (text.includes('[Unsupported image format]')) {
          if (extractedImages[unsupportedIndex]) {
            const img = document.createElement('img');
            img.src = extractedImages[unsupportedIndex].dataUrl;
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.maxHeight = '430px';
            img.style.objectFit = 'contain';
            img.style.display = 'block';
            img.style.margin = '12px auto';
            el.innerHTML = '';
            el.appendChild(img);
            unsupportedIndex++;
          }
        }

        // Replace flattened table elements at their natural position
        if (tables.length > 0) {
          for (let t = 0; t < tables.length; t++) {
            if (usedTables.has(t)) continue;
            const tbl = tables[t];
            if (tbl.rows.length >= 2) {
              const sampleCell1 = tbl.rows[1]?.[1] || tbl.rows[0]?.[1] || '';
              const sampleCell2 = tbl.rows[2]?.[1] || tbl.rows[1]?.[0] || '';
              const match1 = sampleCell1 && text.includes(sampleCell1.slice(0, 15).trim());
              const match2 = sampleCell2 && text.includes(sampleCell2.slice(0, 15).trim());
              if (match1 && match2) {
                el.innerHTML = '';
                el.appendChild(renderRtfTableElement(tbl));
                usedTables.add(t);
                break;
              }
            }
          }
        }
      }

      // Constrain SVGs and images to standard page boundaries and aspect ratio
      elements.forEach(el => {
        const svgs = el.querySelectorAll ? Array.from(el.querySelectorAll('svg')) : [];
        svgs.forEach(svg => {
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.style.maxWidth = '100%';
          svg.style.maxHeight = '430px';
          svg.style.height = 'auto';
          svg.style.display = 'block';
          svg.style.margin = '12px auto';
        });
        const imgs = el.querySelectorAll ? Array.from(el.querySelectorAll('img')) : [];
        imgs.forEach(img => {
          img.style.maxWidth = '100%';
          img.style.maxHeight = '430px';
          img.style.height = 'auto';
          img.style.objectFit = 'contain';
          img.style.display = 'block';
          img.style.margin = '12px auto';
        });
      });

      // Await all image decodes for exact geometry measurement
      const allImgs = Array.from(document.querySelectorAll('img')).concat(
        elements.flatMap(el => Array.from(el.querySelectorAll ? el.querySelectorAll('img') : []))
      );
      await Promise.all(allImgs.map(img => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        if (img.decode) return img.decode().catch(() => {});
        return new Promise(r => { img.onload = r as any; img.onerror = r as any; });
      }));

      // Format bullet items
      elements.forEach(el => {
        const text = el.textContent || '';
        if (text.includes('\uf0b7')) {
          const cleanText = text.replace(/^[\s\uf0b7\t]+/, '');
          el.style.display = 'flex';
          el.style.alignItems = 'flex-start';
          el.style.margin = '6px 0 6px 28px';
          el.style.fontSize = '11pt';
          el.style.lineHeight = '1.5';
          el.innerHTML = `<span style="margin-right:10px; user-select:none;">&#9633;</span><span>${cleanText}</span>`;
        }
      });

      // Apply typography styles
      elements.forEach(el => {
        const text = (el.textContent || '').trim();
        const hasMedia = el.querySelector('img, svg, canvas, table') !== null || ['IMG', 'SVG', 'TABLE'].includes(el.tagName);
        if (isHeadingElement(el)) {
          el.style.marginTop = '20px';
          el.style.marginBottom = '10px';
          el.style.lineHeight = '1.25';
        } else if (text.length > 0 && !hasMedia) {
          el.style.marginBottom = '12px';
          el.style.lineHeight = '1.45';
        }
      });

      // --- 4. MEASURE & DYNAMICALLY LAYOUT ---
      const measureCard = document.createElement('div');
      measureCard.style.width = `${pageWidth}px`;
      measureCard.style.padding = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
      measureCard.style.boxSizing = 'border-box';
      measureCard.style.fontFamily = 'Calibri, "Segoe UI", Arial, sans-serif';
      measureCard.style.lineHeight = '1.45';
      measureCard.style.visibility = 'hidden';
      measureCard.style.position = 'absolute';
      measureCard.style.top = '-99999px';
      document.body.appendChild(measureCard);

      const createPageCard = (num: number) => {
        const card = document.createElement('div');
        card.className = 'fp-rtf-page-card';
        card.setAttribute('data-page-number', String(num));
        card.style.backgroundColor = '#ffffff';
        card.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)';
        card.style.borderRadius = '4px';
        card.style.width = `${pageWidth}px`;
        card.style.height = `${pageHeight}px`;
        card.style.padding = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
        card.style.boxSizing = 'border-box';
        card.style.overflow = 'hidden';
        card.style.marginBottom = '24px';
        card.style.color = '#1e293b';
        card.style.fontFamily = 'Calibri, "Segoe UI", Arial, sans-serif';
        card.style.lineHeight = '1.45';
        card.style.position = 'relative';
        card.style.textAlign = 'left';
        return card;
      };

      const pages: HTMLElement[] = [];
      let curCard = createPageCard(1);
      pages.push(curCard);
      let curHeight = 0;

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (!el || !(el instanceof HTMLElement)) continue;

        const text = (el.textContent || '').trim();
        const hasMedia = el.querySelector('img, svg, canvas, table') !== null || ['IMG', 'SVG', 'TABLE'].includes(el.tagName);
        const isEmptyPar = !hasMedia && text.length === 0;

        if (isEmptyPar) {
          const emptyH = 35;
          if (curHeight + emptyH > printableHeight) {
            if (curCard.childNodes.length > 0) {
              curCard = createPageCard(pages.length + 1);
              pages.push(curCard);
              curHeight = 0;
            }
          }
          const spacer = document.createElement('div');
          spacer.style.height = `${emptyH}px`;
          curCard.appendChild(spacer);
          curHeight += emptyH;
          continue;
        }

        measureCard.innerHTML = '';
        const clone = el.cloneNode(true) as HTMLElement;
        measureCard.appendChild(clone);
        const compStyle = window.getComputedStyle(clone);
        const mt = parseFloat(compStyle.marginTop) || 0;
        const mb = parseFloat(compStyle.marginBottom) || 0;
        const elH = clone.offsetHeight + mt + mb;

        const isHeading = isHeadingElement(el);

        // Lookahead for Keep-With-Next
        let nextContentH = 0;
        if (isHeading || hasMedia) {
          for (let j = i + 1; j < elements.length; j++) {
            const nextEl = elements[j];
            if (nextEl && (nextEl.textContent || '').trim().length > 0) {
              measureCard.innerHTML = '';
              const nClone = nextEl.cloneNode(true) as HTMLElement;
              measureCard.appendChild(nClone);
              const nStyle = window.getComputedStyle(nClone);
              nextContentH = nClone.offsetHeight + (parseFloat(nStyle.marginTop) || 0) + (parseFloat(nStyle.marginBottom) || 0);
              break;
            }
          }
        }

        const remainingSpace = printableHeight - curHeight;
        const isLargeMedia = hasMedia && elH > 300;
        const keepWithNextOverflow = isHeading && nextContentH > 0 && (elH + nextContentH + 20 > remainingSpace);
        const largeMediaOverflow = isLargeMedia && curHeight > 0 && (elH + 80 > remainingSpace);
        const shouldBreak = (curHeight + elH > printableHeight || keepWithNextOverflow || largeMediaOverflow) && curCard.childNodes.length > 0;

        if (shouldBreak) {
          curCard = createPageCard(pages.length + 1);
          pages.push(curCard);
          curHeight = 0;
        }

        curCard.appendChild(el);
        curHeight += elH;
      }

      measureCard.remove();

      pageElements = pages.filter(card => {
        const hasText = (card.textContent || '').trim().length > 0;
        const hasCardMedia = card.querySelector('table, img, svg, canvas') !== null;
        return hasText || hasCardMedia;
      });

      if (pageElements.length === 0) {
        pageElements = [curCard];
      }

      wrapper.innerHTML = '';
      pageElements.forEach((card, idx) => {
        card.setAttribute('data-page-number', String(idx + 1));
        card.style.display = idx === 0 ? 'block' : 'none';
        wrapper.appendChild(card);
      });

    } catch (err) {
      console.warn('[RtfPlugin] RTF render error, fallback text:', err);
      const text = rawRtf;
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
        pageCard.style.padding = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
        pageCard.style.width = `${pageWidth}px`;
        pageCard.style.minHeight = `${pageHeight}px`;
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
      pageElements.forEach((el, idx) => {
        el.style.display = idx + 1 === currentPage ? 'block' : 'none';
      });
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
