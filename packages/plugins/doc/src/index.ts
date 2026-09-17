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
    ];
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

      wrapper.innerHTML = this.formatDocToHtml(text, ctx.metadata.name || 'Document');
    } catch (err) {
      console.warn('[DocPlugin] Binary parsing error, fallback text:', err);
      // Fallback: search for readable strings directly in the buffer
      const fallback = this.heuristicTextExtraction(ctx.buffer);
      extractedRawText = fallback;
      wrapper.innerHTML = `
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 6px; font-size: 20px; color: #334155;">${ctx.metadata.name || 'Word Document (.doc)'}</h2>
          <span style="font-size: 12px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">Legacy Word 97-2003 Binary Preview</span>
        </div>
        ${this.formatDocToHtml(fallback, ctx.metadata.name || 'Document')}
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
    const chars: string[] = [];
    const len = bytes.length;

    for (let i = 0; i < len; i++) {
      const b = bytes[i];
      // Check printable ASCII and common control codes
      if (b === 0x0D || b === 0x0A || b === 0x09 || (b >= 0x20 && b <= 0x7E) || (b >= 0xA0 && b <= 0xFF)) {
        chars.push(String.fromCharCode(b));
      } else if (b === 0x00 && i + 1 < len && bytes[i + 1] >= 0x20 && bytes[i + 1] <= 0x7E) {
        // UTF-16LE pattern where ASCII is second byte
        chars.push(String.fromCharCode(bytes[i + 1]));
        i++;
      } else if (b === 0x07) {
        // Table cell divider in Word
        chars.push('\t');
      } else if (b === 0x0C) {
        // Page break
        chars.push('\n\n---PAGE---\n\n');
      }
    }

    return chars.join('');
  }

  private heuristicTextExtraction(buffer: ArrayBuffer): string {
    return this.extractStringsFromBytes(new Uint8Array(buffer));
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
      .replace(/\x0C/g, '\n\n') // Page break
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
