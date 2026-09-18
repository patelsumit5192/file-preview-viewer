import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import { CfbfReader } from '@patel.sumit51/core';
import DOMPurify from 'dompurify';

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
      }
    );

    return actions;
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const container = document.createElement('div');
    container.className = 'fp-doc-container';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'auto';
    container.style.padding = '32px 16px';
    container.style.backgroundColor = '#f1f5f9';

    const wrapper = document.createElement('div');
    wrapper.className = 'fp-doc-wrapper';
    wrapper.style.maxWidth = '850px';
    wrapper.style.margin = '0 auto';
    wrapper.style.backgroundColor = '#ffffff';
    wrapper.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
    wrapper.style.borderRadius = '4px';
    wrapper.style.padding = '56px 48px';
    wrapper.style.minHeight = '100%';
    wrapper.style.transformOrigin = 'top center';
    wrapper.style.transition = 'transform 0.2s ease';
    wrapper.style.fontFamily = 'Calibri, "Segoe UI", Arial, sans-serif';
    wrapper.style.color = '#1e293b';

    container.appendChild(wrapper);
    ctx.container.appendChild(container);

    let scale = 1.0;
    let extractedRawText = '';
    let isFallback = false;

    try {
      const cfbf = new CfbfReader(ctx.buffer);
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

    const rawPages = this.splitIntoPages(extractedRawText);
    const totalPages = Math.max(1, rawPages.length);
    let currentPage = 1;

    wrapper.innerHTML = '';
    const pageCards: HTMLElement[] = [];

    for (let i = 0; i < totalPages; i++) {
      const pageCard = document.createElement('div');
      pageCard.className = 'fp-doc-page-card';
      pageCard.style.backgroundColor = '#ffffff';
      pageCard.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
      pageCard.style.borderRadius = '4px';
      pageCard.style.padding = '56px 48px';
      pageCard.style.minHeight = '100%';
      pageCard.style.display = i === 0 ? 'block' : 'none';

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

      wrapper.appendChild(pageCard);
      pageCards.push(pageCard);
    }

    let indicator: HTMLElement | null = null;
    if (totalPages > 1) {
      indicator = document.createElement('div');
      indicator.className = 'fp-doc-page-indicator';
      indicator.style.position = 'sticky';
      indicator.style.bottom = '16px';
      indicator.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
      indicator.style.backdropFilter = 'blur(8px)';
      indicator.style.color = '#f8fafc';
      indicator.style.fontSize = '12px';
      indicator.style.fontWeight = '600';
      indicator.style.padding = '5px 14px';
      indicator.style.borderRadius = '20px';
      indicator.style.border = '1px solid rgba(255, 255, 255, 0.15)';
      indicator.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      indicator.style.zIndex = '10';
      indicator.style.userSelect = 'none';
      indicator.style.pointerEvents = 'none';
      indicator.style.textAlign = 'center';
      indicator.style.width = 'fit-content';
      indicator.style.margin = '16px auto 0';
      container.appendChild(indicator);
    }

    const showPage = (pageNum: number) => {
      currentPage = Math.max(1, Math.min(totalPages, pageNum));
      if (totalPages > 1) {
        pageCards.forEach((card, idx) => {
          card.style.display = idx + 1 === currentPage ? 'block' : 'none';
        });
      }
      if (indicator) {
        indicator.textContent = `Page ${currentPage} of ${totalPages}`;
      }
      ctx.emit('page-change', { page: currentPage, total: totalPages });
    };

    if (totalPages > 1) {
      showPage(1);
    }

    const cleanup = () => {
      indicator?.remove();
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
        scale += 0.1;
        wrapper.style.transform = `scale(${scale})`;
      },
      zoomOut: () => {
        scale = Math.max(0.2, scale - 0.1);
        wrapper.style.transform = `scale(${scale})`;
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        wrapper.style.transform = `scale(${scale})`;
      },
      fitToPage: () => {
        scale = 1.0;
        wrapper.style.transform = 'scale(1)';
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

  private splitIntoPages(text: string): string[] {
    if (!text) return [''];
    const parts = text.split(/[\x0C\f]|\r?\n\s*[-=_]{3,}\s*(?:PAGE|Page|page break)[\s\d\w-]*[-=_]{3,}\s*\r?\n/i)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    return parts.length > 0 ? parts : [text];
  }

  /**
   * Format cleaned extracted text into attractive HTML paragraphs, headings, and lists
   */
  private formatDocToHtml(text: string, filename: string): string {
    // Normalize newlines and replace word internal codes
    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\x0B/g, '\n') // Line break
      .split('\n');

    let html = '';
    let inList = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        continue;
      }

      // Filter out binary noise strings (e.g. font tables, internal IDs)
      if (/^[\x00-\x1F\x7F-\x9F]+$/.test(line)) continue;
      if (line.includes('Normal.dot') || line.includes('Microsoft Word') || line.includes('Times New Roman') && line.length < 30) {
        continue;
      }

      // Check if heading (short, all caps or title style)
      if (line.length < 60 && !line.endsWith('.') && (/^[A-Z0-9\s:_-]+$/.test(line) || line.startsWith('#'))) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<h2 style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${DOMPurify.sanitize(line)}</h2>`;
      } else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        if (!inList) {
          html += '<ul style="margin: 8px 0; padding-left: 24px;">';
          inList = true;
        }
        const bulletText = line.replace(/^[•\-\*]\s*/, '');
        html += `<li style="margin: 4px 0; line-height: 1.6;">${DOMPurify.sanitize(bulletText)}</li>`;
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<p style="line-height: 1.7; margin: 10px 0; font-size: 14px; text-align: justify;">${DOMPurify.sanitize(line)}</p>`;
      }
    }

    if (inList) html += '</ul>';

    return html || `<p style="color: #64748b; font-style: italic;">(No readable text found in ${DOMPurify.sanitize(filename)})</p>`;
  }
}

export function docPlugin(): DocPlugin {
  return new DocPlugin();
}

export default DocPlugin;
