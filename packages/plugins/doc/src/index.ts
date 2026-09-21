import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import { CfbfReader } from '@patel.sumit51/core';
import DOMPurify from 'dompurify';
import * as fflate from 'fflate';

export class DocPlugin implements PreviewPlugin {
  id = 'doc';
  name = 'Legacy Word Document Preview (.doc, .dot)';
  extensions = ['.doc', '.dot'];
  mimeTypes = ['application/msword', 'application/vnd.ms-word'];
  weight = 75;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    if (ext) {
      return this.extensions.includes(ext);
    }
    return this.mimeTypes.includes(mime || '');
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
        id: 'copy',
        icon: 'copy',
        label: 'Copy Text',
        type: 'button',
        group: 'actions',
        execute: () => (instance as any).copy?.()
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
    const container = document.createElement('div');
    container.className = 'fp-doc-container';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflowX = 'hidden';
    container.style.overflowY = 'auto';
    container.style.padding = '16px 8px';
    container.style.backgroundColor = '#f1f5f9';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'flex-start';

    ctx.container.appendChild(container);

    let scale = 1.0;
    let extractedRawText = '';
    let isFallback = false;
    let chartSvg = '';

    try {
      const cfbf = new CfbfReader(ctx.buffer);
      
      // Check for embedded OLE OpenDocument chart package
      try {
        const pkg = cfbf.readStream('package_stream');
        if (pkg && pkg.length > 100) {
          chartSvg = this.parseOdfChartToSvg(pkg);
        }
      } catch (chartErr) {
        console.warn('[DocPlugin] Chart stream parsing info:', chartErr);
      }

      const wordDocStream = cfbf.readStream('WordDocument');

      if (!wordDocStream || wordDocStream.length < 512) {
        throw new Error('WordDocument stream not found or invalid in CFBF archive');
      }

      // Check FIB to identify table stream
      const view = new DataView(wordDocStream.buffer, wordDocStream.byteOffset, wordDocStream.byteLength);
      const flags = view.getUint16(0x000A, true);
      const is1Table = (flags & 0x0200) !== 0;
      const tableName = is1Table ? '1Table' : '0Table';
      const tableStream = cfbf.readStream(tableName);

      const text = this.extractDocText(wordDocStream, tableStream);
      extractedRawText = text;
    } catch (err) {
      console.warn('[DocPlugin] Binary parsing error, fallback text:', err);
      // Fallback: search for readable strings directly in the buffer
      const fallback = this.heuristicTextExtraction(ctx.buffer);
      extractedRawText = fallback;
      isFallback = true;
    }

    const rawPages = this.splitIntoPages(extractedRawText, chartSvg);
    const totalPages = Math.max(1, rawPages.length);
    let currentPage = 1;

    const pageCards: HTMLElement[] = [];

    for (let i = 0; i < totalPages; i++) {
      const pageCard = document.createElement('div');
      pageCard.className = 'fp-doc-page-card';
      pageCard.style.width = '816px';
      pageCard.style.minHeight = '1056px';
      pageCard.style.backgroundColor = '#ffffff';
      pageCard.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
      pageCard.style.borderRadius = '4px';
      pageCard.style.padding = '72px 56px';
      pageCard.style.boxSizing = 'border-box';
      pageCard.style.display = i === 0 ? 'block' : 'none';
      pageCard.style.transformOrigin = 'top center';
      pageCard.style.transition = 'transform 0.15s ease';
      pageCard.style.fontFamily = 'Calibri, "Segoe UI", Arial, sans-serif';
      pageCard.style.color = '#1e293b';

      if (isFallback && i === 0) {
        pageCard.innerHTML = `
          <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 6px; font-size: 20px; color: #334155;">${DOMPurify.sanitize(ctx.metadata.name || 'Word Document (.doc)')}</h2>
            <span style="font-size: 12px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">Legacy Word 97-2003 Binary Preview</span>
          </div>
          ${this.formatDocToHtml(rawPages[i], ctx.metadata.name || 'Document')}
        `;
      } else {
        pageCard.innerHTML = this.formatDocToHtml(rawPages[i], ctx.metadata.name || 'Document');
      }

      container.appendChild(pageCard);
      pageCards.push(pageCard);
    }

    let rotation = 0;

    const applyTransform = () => {
      const activeCard = pageCards[currentPage - 1];
      if (activeCard) {
        activeCard.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
        const baseH = activeCard.offsetHeight || 1056;
        const scaledH = baseH * scale;
        const extraH = Math.max(0, scaledH - baseH);
        activeCard.style.marginBottom = `${extraH + 32}px`;
      }
    };

    const showPage = (pageNum: number) => {
      currentPage = Math.max(1, Math.min(totalPages, pageNum));
      pageCards.forEach((card, idx) => {
        if (idx + 1 === currentPage) {
          card.style.display = 'block';
          card.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
        } else {
          card.style.display = 'none';
        }
      });
      container.scrollTop = 0;
      ctx.emit('page-change', { page: currentPage, total: totalPages });
    };

    if (totalPages > 1) {
      showPage(1);
    }

    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'width';
    let isUserZoomed = false;

    const calculateFitScale = (mode: 'width' | 'page' = fitMode) => {
      const elW = 816;
      const elH = 1056;
      // Minimal side margins (16px on each side, safe from vertical scrollbar)
      const availW = Math.max(280, ctx.container.clientWidth - 32);
      const availH = Math.max(280, ctx.container.clientHeight - 32);

      const sW = availW / elW;
      const sH = availH / elH;

      if (mode === 'page') {
        return Math.max(0.35, Math.min(3.0, Math.min(sW, sH)));
      }
      return Math.max(0.4, Math.min(3.0, sW));
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

    const cleanup = () => {
      resizeObserver?.disconnect();
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      getPageCount: () => totalPages,
      getCurrentPage: () => currentPage,
      goToPage: (page: number) => showPage(page),
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
      copy: () => {
        navigator.clipboard.writeText(extractedRawText);
      },
      download: () => {
        const blob = new Blob([ctx.buffer], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'document.doc';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        window.print();
      }
    } as any;
  }

  /**
   * Extract document text from WordDocument stream and Table stream
   */
  private extractDocText(wordDoc: Uint8Array, tableStream: Uint8Array | null): string {
    const view = new DataView(wordDoc.buffer, wordDoc.byteOffset, wordDoc.byteLength);

    // Read fcClx offset and lcbClx length from FIB
    // In Word 97-2003, fcClx is at offset 0x01A2 (418), lcbClx is at 0x01A6 (422)
    let fcClx = 0;
    let lcbClx = 0;
    if (wordDoc.length >= 0x01AA) {
      fcClx = view.getUint32(0x01A2, true);
      lcbClx = view.getUint32(0x01A6, true);
    }

    // If CLX is found in table stream, parse Piece Table
    if (tableStream && fcClx > 0 && lcbClx > 0 && fcClx + lcbClx <= tableStream.length) {
      try {
        const text = this.parsePieceTable(wordDoc, tableStream, fcClx, lcbClx);
        if (text && text.trim().length > 0) return text;
      } catch (err) {
        console.warn('[DocPlugin] Error in piece table parsing:', err);
      }
    }

    // Fallback: Word 97-2003 documents place the main text beginning at offset 0x0A00 (2560)
    // up to the table stream or end of main stream.
    if (wordDoc.length > 0x0A00) {
      const textChunk = wordDoc.subarray(0x0A00);
      const extracted = this.extractStringsFromBytes(textChunk);
      if (extracted.trim().length > 0) return extracted;
    }

    return this.extractStringsFromBytes(wordDoc);
  }

  /**
   * Parse the CLX and Piece Table (Plcfpcd) according to [MS-DOC]
   */
  private parsePieceTable(wordDoc: Uint8Array, table: Uint8Array, fcClx: number, lcbClx: number): string {
    let offset = fcClx;
    const end = fcClx + lcbClx;

    // Skip PRC records until we find clxt = 0x02 (Pcdt)
    while (offset < end) {
      const clxt = table[offset];
      if (clxt === 0x01) {
        // Grpprl
        const cb = new DataView(table.buffer, table.byteOffset + offset + 1).getUint16(0, true);
        offset += 3 + cb;
      } else if (clxt === 0x02) {
        // Pcdt (Piece table descriptor)
        offset += 1;
        const lcb = new DataView(table.buffer, table.byteOffset + offset).getUint32(0, true);
        offset += 4;
        return this.readPlcfpcd(wordDoc, table, offset, lcb);
      } else {
        break;
      }
    }

    return '';
  }

  private readPlcfpcd(wordDoc: Uint8Array, table: Uint8Array, offset: number, lcb: number): string {
    const view = new DataView(table.buffer, table.byteOffset + offset);
    // Number of pieces: lcb = 4*(n+1) + 8*n  =>  12*n + 4 = lcb  =>  n = (lcb - 4) / 12
    const n = Math.floor((lcb - 4) / 12);
    if (n <= 0) return '';

    const cpOffsets: number[] = [];
    for (let i = 0; i <= n; i++) {
      cpOffsets.push(view.getUint32(i * 4, true));
    }

    const pcdOffset = (n + 1) * 4;
    let fullText = '';

    for (let i = 0; i < n; i++) {
      const fc = view.getUint32(pcdOffset + i * 8 + 2, true);
      const isCompressed = (fc & 0x40000000) !== 0;
      const byteOffset = (fc & 0x3fffffff) >> (isCompressed ? 1 : 0);
      const charCount = cpOffsets[i + 1] - cpOffsets[i];

      if (isCompressed) {
        // 8-bit ANSI characters
        const slice = wordDoc.subarray(byteOffset, byteOffset + charCount);
        fullText += new TextDecoder('latin1').decode(slice);
      } else {
        // 16-bit UTF-16LE characters
        const slice = wordDoc.subarray(byteOffset, byteOffset + charCount * 2);
        fullText += new TextDecoder('utf-16le').decode(slice);
      }
    }

    return fullText;
  }

  /**
   * Scans a byte array for continuous sequences of readable characters (ANSI and UTF-16LE)
   */
  private extractStringsFromBytes(bytes: Uint8Array): string {
    const rawAnsi = new TextDecoder('latin1').decode(bytes);
    const rawUtf16 = new TextDecoder('utf-16le', { fatal: false }).decode(bytes);

    // Extract meaningful runs of ASCII text (length >= 4)
    const ansiRuns = rawAnsi.match(/[\x20-\x7E\t\r\n]{4,}/g) || [];
    const utf16Runs = rawUtf16.match(/[\x20-\x7E\t\r\n]{4,}/g) || [];

    const candidateLines: string[] = [];
    const seen = new Set<string>();

    for (const run of [...ansiRuns, ...utf16Runs]) {
      const trimmed = run.trim();
      // Must contain at least one letter and have reasonable length
      if (trimmed.length >= 4 && /[a-zA-Z]/.test(trimmed) && !seen.has(trimmed)) {
        // Exclude internal Word structures / headers
        if (
          !trimmed.includes('Normal.dot') &&
          !trimmed.includes('Microsoft Word') &&
          !trimmed.includes('Times New Roman') &&
          !trimmed.startsWith('ÐÏà¡±á') &&
          !/^EMBED\b/i.test(trimmed) &&
          !trimmed.includes('ChartDocument') &&
          !/^[\W_0-9]+$/.test(trimmed)
        ) {
          seen.add(trimmed);
          candidateLines.push(trimmed);
        }
      }
    }

    return candidateLines.join('\n\n');
  }

  private heuristicTextExtraction(buffer: ArrayBuffer): string {
    return this.extractStringsFromBytes(new Uint8Array(buffer));
  }

  /**
   * Parses an embedded OpenDocument Chart package into a vector SVG bar/column chart
   */
  private parseOdfChartToSvg(zipBytes: Uint8Array): string {
    try {
      const unzipped = fflate.unzipSync(zipBytes);
      const contentXml = unzipped['content.xml'] ? new TextDecoder('utf-8').decode(unzipped['content.xml']) : '';
      if (!contentXml) return '';

      // Extract categories and series data from local-table
      const rowsMatch = contentXml.match(/<table:table-row[\s\S]*?<\/table:table-row>/g) || [];
      if (rowsMatch.length < 2) return '';

      // Header row has series names
      const headers: string[] = [];
      const firstRow = rowsMatch[0];
      const headerCells = firstRow ? (firstRow.match(/<text:p>([^<]+)<\/text:p>/g) || []) : [];
      for (const h of headerCells) {
        headers.push(h.replace(/<\/?text:p>/g, '').trim());
      }

      // Data rows
      const categories: string[] = [];
      const seriesValues: number[][] = headers.map(() => []);

      for (let r = 1; r < rowsMatch.length; r++) {
        const rowStr = rowsMatch[r];
        if (!rowStr) continue;
        const cells = rowStr.match(/<table:table-cell[\s\S]*?<\/table:table-cell>/g) || [];
        if (cells.length > 0 && cells[0]) {
          const catMatch = cells[0].match(/<text:p>([^<]+)<\/text:p>/);
          categories.push(catMatch ? catMatch[1] : 'Row ' + r);

          for (let c = 1; c < cells.length && (c - 1) < headers.length; c++) {
            const cellStr = cells[c];
            if (!cellStr) continue;
            const valMatch = cellStr.match(/office:value="([0-9.]+)"/) || cellStr.match(/<text:p>([0-9.]+)<\/text:p>/);
            const series = seriesValues[c - 1];
            if (series) {
              series.push(valMatch ? parseFloat(valMatch[1]) : 0);
            }
          }
        }
      }

      // Extract colors from styles or use standard palette
      const colors = ['#004586', '#ff420e', '#ffd320', '#579d1c', '#7e0021'];
      const colorMatches = contentXml.matchAll(/draw:fill-color="(#[0-9a-fA-F]{6})"/g);
      let cIdx = 0;
      for (const cm of colorMatches) {
        if (cIdx < colors.length) colors[cIdx] = cm[1];
        cIdx++;
      }

      // Find max value
      let maxVal = 10;
      for (const s of seriesValues) {
        for (const v of s) {
          if (v > maxVal) maxVal = v;
        }
      }
      maxVal = Math.ceil(maxVal * 1.15);

      // Build SVG
      const width = 560;
      const height = 280;
      const padLeft = 45;
      const padRight = 100;
      const padTop = 20;
      const padBottom = 40;
      const chartW = width - padLeft - padRight;
      const chartH = height - padTop - padBottom;

      let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="max-width: 560px; height: 280px; margin: 16px auto; display: block; font-family: Calibri, sans-serif; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);">`;

      // Grid lines & Y axis labels (4 steps)
      for (let step = 0; step <= 4; step++) {
        const yVal = ((maxVal / 4) * step).toFixed(1);
        const yPos = padTop + chartH - (step / 4) * chartH;
        svg += `<line x1="${padLeft}" y1="${yPos}" x2="${padLeft + chartW}" y2="${yPos}" stroke="#e2e8f0" stroke-dasharray="2,2" />`;
        svg += `<text x="${padLeft - 8}" y="${yPos + 4}" font-size="11" fill="#64748b" text-anchor="end">${yVal}</text>`;
      }

      // Bars
      const numCats = categories.length;
      const numSeries = headers.length;
      const groupW = chartW / numCats;
      const barW = Math.max(8, (groupW * 0.7) / numSeries);
      const groupPad = (groupW - (barW * numSeries)) / 2;

      for (let catIdx = 0; catIdx < numCats; catIdx++) {
        const groupX = padLeft + catIdx * groupW + groupPad;

        for (let sIdx = 0; sIdx < numSeries; sIdx++) {
          const val = seriesValues[sIdx][catIdx] || 0;
          const barH = (val / maxVal) * chartH;
          const barX = groupX + sIdx * barW;
          const barY = padTop + chartH - barH;
          const col = colors[sIdx % colors.length];

          svg += `<rect x="${barX}" y="${barY}" width="${barW - 2}" height="${barH}" fill="${col}" rx="2"><title>${headers[sIdx]}: ${val}</title></rect>`;
        }

        // X axis category label
        const catX = padLeft + catIdx * groupW + (groupW / 2);
        svg += `<text x="${catX}" y="${padTop + chartH + 18}" font-size="11" fill="#475569" text-anchor="middle">${categories[catIdx]}</text>`;
      }

      // Legend on the right
      let legendY = padTop + 20;
      for (let sIdx = 0; sIdx < numSeries; sIdx++) {
        const col = colors[sIdx % colors.length];
        svg += `<rect x="${padLeft + chartW + 15}" y="${legendY}" width="12" height="12" fill="${col}" rx="2" />`;
        svg += `<text x="${padLeft + chartW + 32}" y="${legendY + 10}" font-size="11" fill="#334155">${headers[sIdx]}</text>`;
        legendY += 20;
      }

      svg += '</svg>';
      return svg;
    } catch (e) {
      console.warn('[DocPlugin] Error generating chart SVG:', e);
      return '';
    }
  }

  private cleanWordDocFields(text: string, chartSvg: string = ''): string {
    if (!text) return '';

    // 1. Replace EMBED fields with vector SVG chart or remove
    let cleaned = text.replace(
      /\x13\s*EMBED\b[\s\S]*?\x15/gi,
      () => chartSvg ? `\n\n${chartSvg}\n\n` : ''
    );

    // 2. Convert hyperlinks: \x13 HYPERLINK "url" \x14 display text \x15
    cleaned = cleaned.replace(
      /\x13\s*HYPERLINK\s*"?([^"\x14]+)"?\s*\x14([\s\S]*?)\x15/gi,
      (_match, url, label) => {
        const cleanUrl = url.trim();
        const cleanLabel = label.trim() || cleanUrl;
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${cleanLabel}</a>`;
      }
    );

    // 3. For other fields (PAGE, NUMPAGES, DATE, etc.): keep result only if printable
    cleaned = cleaned.replace(/\x13[^\x14\x15]*\x14([^\x15]*)\x15/g, (_m, res) => {
      if (/[\x00-\x1F]/.test(res)) return '';
      return res.trim();
    });

    // 4. Remove any remaining raw field instructions
    cleaned = cleaned.replace(/\x13[^\x15]*\x15/g, '');
    cleaned = cleaned.replace(/[\x13\x14\x15]/g, '');

    // 5. Remove any unprintable control characters except \t, \n, \r
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // 6. Clean any raw leftover "EMBED LibreOffice.ChartDocument..."
    cleaned = cleaned.replace(/EMBED\s+LibreOffice\.ChartDocument\.[0-9]+/gi, chartSvg || '');

    return cleaned;
  }

  private splitIntoPages(text: string, chartSvg: string = ''): string[] {
    if (!text) return [''];
    
    const cleanedText = this.cleanWordDocFields(text, chartSvg);

    // Normalize \r\n, \r, and Word 97 table marks (\x07)
    const normalized = cleanedText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\x0B/g, '\n')
      .replace(/\x07\n/g, '\n')
      .replace(/\x07/g, '\t');

    // Split by explicit form feeds or page break text first
    const explicitParts = normalized.split(/[\x0C\f]|\n\s*[-=_]{3,}\s*(?:PAGE|Page|page break)[\s\d\w-]*[-=_]{3,}\s*\n/i)
      .map(p => p.trim())
      .filter(p => p.length > 0);
      
    if (explicitParts.length === 0) explicitParts.push(normalized);
    
    const maxLinesPerPage = 34;
    const charsPerLine = 80;
    const finalPages: string[] = [];
    
    for (const part of explicitParts) {
      const lines = part.split('\n');
      let currentLines: string[] = [];
      let count = 0;
      
      for (const line of lines) {
        // If this line contains the SVG chart, account for its height
        const isSvg = line.includes('<svg');
        const vLines = isSvg ? 12 : Math.max(1, Math.ceil((line.replace(/<[^>]+>/g, '').length || 1) / charsPerLine));
        if (count + vLines > maxLinesPerPage && currentLines.length > 0) {
          finalPages.push(currentLines.join('\n'));
          currentLines = [];
          count = 0;
        }
        currentLines.push(line);
        count += vLines;
      }
      if (currentLines.length > 0) {
        finalPages.push(currentLines.join('\n'));
      }
    }
    
    return finalPages.length > 0 ? finalPages : [normalized];
  }

  /**
   * Format cleaned extracted text into attractive HTML paragraphs, headings, and lists
   */
  private formatDocToHtml(text: string, filename: string): string {
    // Normalize newlines and replace word internal codes
    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\x0B/g, '\n')
      .replace(/\x07\n/g, '\n')
      .replace(/\x07/g, '\t')
      .split('\n');

    let html = '';
    let inList = false;
    let tableLines: string[] = [];
    
    const flushTable = () => {
      if (tableLines.length > 0) {
        html += '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; font-family: Calibri, sans-serif;">';
        for (let rIdx = 0; rIdx < tableLines.length; rIdx++) {
          const tLine = tableLines[rIdx];
          const isHeader = rIdx === 0;
          html += `<tr style="${isHeader ? 'background-color: #f8fafc; font-weight: 600;' : ''}">`;
          const cols = tLine.split('\t').filter(c => c.trim().length > 0);
          for (const col of cols) {
            html += `<td style="border: 1px solid #cbd5e1; padding: 8px 12px;">${DOMPurify.sanitize(col.trim())}</td>`;
          }
          html += '</tr>';
        }
        html += '</table>';
        tableLines = [];
      }
    };

    const sanitizeOptions = {
      ADD_TAGS: ['a', 'svg', 'g', 'path', 'line', 'rect', 'circle', 'text', 'title'],
      ADD_ATTR: [
        'href', 'target', 'rel', 'style', 'viewBox', 'width', 'height', 'x', 'y',
        'x1', 'y1', 'x2', 'y2', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray',
        'rx', 'font-size', 'text-anchor'
      ]
    };

    let i = 0;
    while (i < lines.length) {
      let line = lines[i];

      // If line contains embedded SVG chart, insert it directly
      if (line.includes('<svg')) {
        if (inList) { html += '</ul>'; inList = false; }
        flushTable();
        html += line;
        i++;
        continue;
      }

      let tabCount = (line.match(/\t/g) || []).length;
      
      // Table detection: line contains tabs
      if (tabCount > 0) {
        let j = i;
        while (j < lines.length && (lines[j].match(/\t/g) || []).length > 0) {
          j++;
        }
        if (inList) { html += '</ul>'; inList = false; }
        tableLines = lines.slice(i, j);
        flushTable();
        i = j;
        continue;
      }
      
      line = line.trim();
      
      if (!line) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<div style="height: 1.15em;"></div>';
        i++;
        continue;
      }

      if (/^[\x00-\x1F\x7F-\x9F]+$/.test(line)) { i++; continue; }
      if ((line.includes('Normal.dot') || line.includes('Microsoft Word') || line.includes('Times New Roman')) && line.length < 30) {
        i++; continue;
      }

      // Drop stray single numbers (leftover field codes or font size tokens like '11')
      if (/^\d{1,2}$/.test(line.trim())) { i++; continue; }

      const isShortLine = line.length < 60 && !line.endsWith('.') && !line.endsWith(',');
      const isTitleLike = isShortLine && (
        /^[A-Z0-9\s:_-]+$/.test(line) ||
        line.startsWith('#') ||
        /^(?:Chapter|Section|Part|\d+\.)\b/i.test(line) ||
        /^[A-Z][a-zA-Z0-9\s#:-]{2,45}$/.test(line)
      );

      if (isTitleLike) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h2 style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin: 18px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${DOMPurify.sanitize(line, sanitizeOptions)}</h2>`;
      } else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        if (!inList) {
          html += '<ul style="margin: 8px 0 12px; padding-left: 24px;">';
          inList = true;
        }
        const bulletText = line.replace(/^[•\-\*]\s*/, '');
        html += `<li style="margin: 4px 0; line-height: 1.5; font-size: 11pt; color: #1e293b;">${DOMPurify.sanitize(bulletText, sanitizeOptions)}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        // Standard Microsoft Word paragraph spacing (1.5 line height, 11pt font, 12px bottom margin)
        html += `<p style="line-height: 1.5; margin: 0 0 12px 0; font-size: 11pt; color: #1e293b; text-align: justify;">${DOMPurify.sanitize(line, sanitizeOptions)}</p>`;
      }
      
      i++;
    }

    if (inList) html += '</ul>';
    flushTable();

    return html || `<p style="color: #64748b; font-style: italic;">(No readable text found in ${DOMPurify.sanitize(filename)})</p>`;
  }
}

export function docPlugin(): DocPlugin {
  return new DocPlugin();
}

export default DocPlugin;
