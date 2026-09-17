import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import * as docx from 'docx-preview';
import { unzipSync, strFromU8 } from 'fflate';
import DOMPurify from 'dompurify';

export class DocxPlugin implements PreviewPlugin {
  id = 'docx';
  name = 'Word Document Preview (.docx, .docm, .dotx, .dotm)';
  extensions = ['.docx', '.docm', '.dotx', '.dotm'];
  mimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-word.document.macroEnabled.12',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    'application/vnd.ms-word.template.macroEnabled.12'
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
    const wrapper = document.createElement('div');
    wrapper.className = 'fp-docx-wrapper';
    wrapper.style.transformOrigin = 'top center';
    wrapper.style.transition = 'transform 0.2s ease';
    wrapper.style.padding = '24px 16px';
    wrapper.style.maxWidth = '900px';
    wrapper.style.margin = '0 auto';
    wrapper.style.boxSizing = 'border-box';
    
    ctx.container.style.overflow = 'auto';
    ctx.container.style.backgroundColor = '#f1f5f9';
    ctx.container.appendChild(wrapper);

    let scale = 1.0;
    let renderedSuccessfully = false;

    // Step 1: Try high-fidelity docx-preview with safe options
    try {
      await docx.renderAsync(ctx.buffer, wrapper, ctx.container, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: true, // Avoid crashes on embedded obfuscated fonts
        breakPages: true,
        experimental: true,
      });

      // Verify if docx-preview rendered actual visible content
      if (wrapper.children.length > 0 && (wrapper.textContent?.trim().length ?? 0) > 0) {
        renderedSuccessfully = true;
      }
    } catch (err) {
      console.warn('[DocxPlugin] docx-preview failed, triggering native XML fallback:', err);
    }

    // Step 2: Graceful Native OpenXML Fallback (100% client-side guarantee)
    if (!renderedSuccessfully) {
      try {
        wrapper.innerHTML = '';
        this.renderXmlFallback(ctx, wrapper);
        renderedSuccessfully = true;
      } catch (fallbackErr) {
        console.error('[DocxPlugin] XML fallback failed:', fallbackErr);
        wrapper.innerHTML = `
          <div style="text-align:center; padding: 48px; background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
            <div style="font-size:48px; margin-bottom: 16px;">📄</div>
            <h3 style="margin: 0 0 8px; color: #1e293b;">${ctx.metadata.name || 'Word Document'}</h3>
            <p style="color: #64748b; margin: 0;">Could not parse document content</p>
          </div>
        `;
      }
    }

    const cleanup = () => {
      wrapper.remove();
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
      download: () => {
        const blob = new Blob([ctx.buffer], { type: this.mimeTypes[0] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'document.docx';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        window.print();
      }
    };
  }

  private renderXmlFallback(ctx: RenderContext, wrapper: HTMLElement): void {
    const unzipped = unzipSync(new Uint8Array(ctx.buffer));
    const docXmlEntry = unzipped['word/document.xml'];
    if (!docXmlEntry) throw new Error('Missing word/document.xml in DOCX package');

    const xmlStr = strFromU8(docXmlEntry);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'application/xml');

    const card = document.createElement('div');
    card.className = 'fp-docx-page-card';
    card.style.backgroundColor = '#ffffff';
    card.style.borderRadius = '6px';
    card.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
    card.style.padding = '48px 56px';
    card.style.fontFamily = 'Calibri, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    card.style.color = '#1e293b';
    card.style.lineHeight = '1.6';

    const body = doc.getElementsByTagNameNS('*', 'body')[0] || doc.documentElement;
    let html = '';

    for (const child of Array.from(body.children)) {
      const tag = child.localName || child.nodeName.split(':').pop();

      if (tag === 'p') {
        const pStyle = child.getElementsByTagNameNS('*', 'pStyle')[0];
        const styleVal = pStyle?.getAttribute('w:val') || pStyle?.getAttribute('val') || '';
        const numPr = child.getElementsByTagNameNS('*', 'numPr')[0];

        const textContent = this.extractParagraphHtml(child);
        if (!textContent.trim()) {
          html += '<div style="height: 10px;"></div>';
          continue;
        }

        const lowerStyle = styleVal.toLowerCase();
        if (lowerStyle.includes('title')) {
          html += `<h1 style="font-size: 28px; font-weight: 700; color: #1e3a8a; margin: 24px 0 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">${textContent}</h1>`;
        } else if (lowerStyle.includes('heading1') || styleVal === '1') {
          html += `<h2 style="font-size: 22px; font-weight: 700; color: #1e40af; margin: 20px 0 10px;">${textContent}</h2>`;
        } else if (lowerStyle.includes('heading2') || styleVal === '2') {
          html += `<h3 style="font-size: 18px; font-weight: 600; color: #2563eb; margin: 16px 0 8px;">${textContent}</h3>`;
        } else if (lowerStyle.includes('heading3') || styleVal === '3') {
          html += `<h4 style="font-size: 15px; font-weight: 600; color: #334155; margin: 12px 0 6px;">${textContent}</h4>`;
        } else if (numPr) {
          html += `<div style="display: flex; gap: 8px; margin: 4px 0 4px 20px;"><span style="color: #2563eb; font-weight: bold;">•</span><span>${textContent}</span></div>`;
        } else {
          html += `<p style="margin: 8px 0; font-size: 14px;">${textContent}</p>`;
        }
      } else if (tag === 'tbl') {
        html += '<table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #cbd5e1;">';
        const rows = Array.from(child.getElementsByTagNameNS('*', 'tr'));
        rows.forEach((tr, rIdx) => {
          html += `<tr style="${rIdx === 0 ? 'background-color: #f8fafc; font-weight: 600;' : ''}">`;
          const cells = Array.from(tr.getElementsByTagNameNS('*', 'tc'));
          cells.forEach((tc) => {
            const cellText = this.extractParagraphHtml(tc);
            html += `<td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 13px;">${cellText || '&nbsp;'}</td>`;
          });
          html += '</tr>';
        });
        html += '</table>';
      }
    }

    card.innerHTML = DOMPurify.sanitize(html, {
      ADD_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'table', 'tr', 'td', 'span', 'b', 'i', 'u', 'img', 'div'],
      ADD_ATTR: ['style', 'src', 'alt', 'colspan', 'rowspan']
    });

    wrapper.appendChild(card);
  }

  private extractParagraphHtml(pElement: Element): string {
    let result = '';
    const runs = Array.from(pElement.getElementsByTagNameNS('*', 'r'));

    if (runs.length === 0) {
      return DOMPurify.sanitize(pElement.textContent || '');
    }

    for (const r of runs) {
      const rPr = r.getElementsByTagNameNS('*', 'rPr')[0];
      const isBold = !!(rPr?.getElementsByTagNameNS('*', 'b')[0]);
      const isItalic = !!(rPr?.getElementsByTagNameNS('*', 'i')[0]);
      const isUnderline = !!(rPr?.getElementsByTagNameNS('*', 'u')[0]);
      const colorNode = rPr?.getElementsByTagNameNS('*', 'color')[0];
      const colorVal = colorNode?.getAttribute('w:val') || colorNode?.getAttribute('val');

      const texts = Array.from(r.getElementsByTagNameNS('*', 't'));
      let text = texts.map(t => t.textContent || '').join('');

      if (!text) continue;
      text = DOMPurify.sanitize(text);

      let styles = '';
      if (isBold) styles += 'font-weight: bold; ';
      if (isItalic) styles += 'font-style: italic; ';
      if (isUnderline) styles += 'text-decoration: underline; ';
      if (colorVal && colorVal !== 'auto') styles += `color: #${colorVal}; `;

      if (styles) {
        result += `<span style="${styles}">${text}</span>`;
      } else {
        result += text;
      }
    }

    return result;
  }
}

export function docxPlugin(): DocxPlugin {
  return new DocxPlugin();
}

export default DocxPlugin;
