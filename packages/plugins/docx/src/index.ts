import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import { CfbfReader } from '@patel.sumit51/core';
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
    const wrapper = document.createElement('div');
    wrapper.className = 'fp-docx-wrapper';
    wrapper.style.transformOrigin = 'top center';
    wrapper.style.transition = 'transform 0.2s ease';
    wrapper.style.padding = '24px 16px';
    wrapper.style.maxWidth = '950px';
    wrapper.style.margin = '0 auto';
    wrapper.style.boxSizing = 'border-box';
    
    ctx.container.style.overflow = 'auto';
    ctx.container.style.backgroundColor = '#f1f5f9';
    ctx.container.appendChild(wrapper);

    // Inject override styles so docx-preview pages match our modern light theme
    const styleOverride = document.createElement('style');
    styleOverride.textContent = `
      .fp-docx-wrapper .docx-wrapper {
        background: transparent !important;
        padding: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        box-sizing: border-box !important;
      }
      .fp-docx-wrapper section.docx {
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08) !important;
        border-radius: 4px !important;
        margin-bottom: 24px !important;
        background-color: #ffffff !important;
      }
    `;
    ctx.container.appendChild(styleOverride);

    let scale = 1.0;
    let renderedSuccessfully = false;
    const createdBlobUrls: string[] = [];

    // Step 1: Try high-fidelity docx-preview
    // IMPORTANT: Pass wrapper as styleContainer (param 3) instead of ctx.container.
    // docx-preview calls removeAllElements(styleContainer), which previously deleted wrapper from ctx.container!
    try {
      await docx.renderAsync(ctx.buffer, wrapper, wrapper, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: true, // Avoid crashes on embedded obfuscated fonts
        breakPages: true,
        experimental: true,
      });

      // Ensure wrapper remains attached to container
      if (!ctx.container.contains(wrapper)) {
        ctx.container.appendChild(wrapper);
      }

      // Check if visible content was actually produced
      if (wrapper.children.length > 0 && (wrapper.textContent?.trim().length ?? 0) > 0) {
        renderedSuccessfully = true;
      }
    } catch (err) {
      console.warn('[DocxPlugin] docx-preview failed, triggering native fallback:', err);
    }

    // Step 2: Graceful Native Fallback (100% client-side guarantee)
    if (!renderedSuccessfully) {
      try {
        wrapper.innerHTML = '';
        this.renderXmlFallback(ctx, wrapper, createdBlobUrls);
        if (!ctx.container.contains(wrapper)) {
          ctx.container.appendChild(wrapper);
        }
        renderedSuccessfully = true;
      } catch (fallbackErr) {
        console.error('[DocxPlugin] Native fallback failed:', fallbackErr);
        wrapper.innerHTML = `
          <div style="text-align:center; padding: 48px; background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
            <div style="font-size:48px; margin-bottom: 16px;">📄</div>
            <h3 style="margin: 0 0 8px; color: #1e293b;">${ctx.metadata.name || 'Word Document'}</h3>
            <p style="color: #64748b; margin: 0;">Could not parse document content</p>
          </div>
        `;
        if (!ctx.container.contains(wrapper)) {
          ctx.container.appendChild(wrapper);
        }
      }
    }

    const sections = wrapper.querySelectorAll<HTMLElement>('section.docx');
    const cards = wrapper.querySelectorAll<HTMLElement>('.fp-docx-page-card');
    const pageElements = sections.length > 0 ? sections : cards;
    const totalPages = Math.max(1, pageElements.length);
    let currentPage = 1;

    let indicator: HTMLElement | null = null;
    if (totalPages > 1) {
      indicator = document.createElement('div');
      indicator.className = 'fp-docx-page-indicator';
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
      ctx.container.appendChild(indicator);
    }

    const showPage = (pageNum: number) => {
      currentPage = Math.max(1, Math.min(totalPages, pageNum));
      if (pageElements.length > 1) {
        pageElements.forEach((sec, idx) => {
          sec.style.display = (idx + 1 === currentPage) ? 'block' : 'none';
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
      for (const url of createdBlobUrls) {
        URL.revokeObjectURL(url);
      }
      wrapper.remove();
      styleOverride.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      getPageCount: () => totalPages,
      getCurrentPage: () => currentPage,
      goToPage: (page: number) => {
        showPage(page);
      },
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

  private renderXmlFallback(ctx: RenderContext, wrapper: HTMLElement, createdBlobUrls: string[]): void {
    // Check if the file is actually a legacy binary CFBF .doc file renamed to .docx
    const magic = new Uint8Array(ctx.buffer.slice(0, 8));
    if (magic[0] === 0xD0 && magic[1] === 0xCF && magic[2] === 0x11 && magic[3] === 0xE0) {
      this.renderBinaryDocFallback(ctx, wrapper);
      return;
    }

    const unzipped = unzipSync(new Uint8Array(ctx.buffer));
    const docKey = Object.keys(unzipped).find(k => k.replace(/^[./\\]+/, '').toLowerCase() === 'word/document.xml');
    const docXmlEntry = docKey ? unzipped[docKey] : undefined;
    if (!docXmlEntry) throw new Error('Missing word/document.xml in DOCX package');

    const xmlStr = strFromU8(docXmlEntry);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'application/xml');

    // Parse image relationships if present
    const imageMap: Record<string, string> = {};
    const relsKey = Object.keys(unzipped).find(k => k.replace(/^[./\\]+/, '').toLowerCase() === 'word/_rels/document.xml.rels');
    if (relsKey && unzipped[relsKey]) {
      try {
        const relsXml = strFromU8(unzipped[relsKey]);
        const relsDoc = parser.parseFromString(relsXml, 'application/xml');
        const relEls = Array.from(relsDoc.getElementsByTagName('Relationship'));
        for (const rel of relEls) {
          const rId = rel.getAttribute('Id');
          const target = rel.getAttribute('Target');
          if (rId && target) {
            const cleanTarget = target.replace(/^\.\.\//, '').replace(/^\//, '');
            const fullTargetKey = Object.keys(unzipped).find(k => {
              const norm = k.replace(/^[./\\]+/, '').toLowerCase();
              return norm === ('word/' + cleanTarget).toLowerCase() || norm === cleanTarget.toLowerCase();
            });
            if (fullTargetKey && unzipped[fullTargetKey]) {
              const bytes = unzipped[fullTargetKey];
              const ext = cleanTarget.split('.').pop()?.toLowerCase() || 'png';
              const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
              const blob = new Blob([bytes], { type: mime });
              const blobUrl = URL.createObjectURL(blob);
              imageMap[rId] = blobUrl;
              createdBlobUrls.push(blobUrl);
            }
          }
        }
      } catch (relsErr) {
        console.warn('[DocxPlugin] Error parsing relationships:', relsErr);
      }
    }

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

        const textContent = this.extractParagraphHtml(child, imageMap);
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
            const cellText = this.extractParagraphHtml(tc, imageMap);
            html += `<td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 13px;">${cellText || '&nbsp;'}</td>`;
          });
          html += '</tr>';
        });
        html += '</table>';
      }
    }

    card.innerHTML = DOMPurify.sanitize(html, {
      ADD_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'table', 'tr', 'td', 'span', 'b', 'i', 'u', 's', 'strike', 'img', 'div', 'br'],
      ADD_ATTR: ['style', 'src', 'alt', 'colspan', 'rowspan']
    });

    wrapper.appendChild(card);
  }

  private extractParagraphHtml(pElement: Element, imageMap: Record<string, string> = {}): string {
    let result = '';

    // Check for inline drawings in this paragraph
    const drawings = Array.from(pElement.getElementsByTagNameNS('*', 'drawing'));
    for (const drawing of drawings) {
      const blip = drawing.getElementsByTagNameNS('*', 'blip')[0];
      const rId = blip?.getAttribute('r:embed') || blip?.getAttribute('r:id');
      if (rId && imageMap[rId]) {
        result += `<div style="text-align:center; margin: 12px 0;"><img src="${imageMap[rId]}" style="max-width: 100%; height: auto; border-radius: 4px;" /></div>`;
      }
    }

    const runs = Array.from(pElement.getElementsByTagNameNS('*', 'r'));
    if (runs.length === 0 && !result) {
      return DOMPurify.sanitize(pElement.textContent || '');
    }

    for (const r of runs) {
      const blip = r.getElementsByTagNameNS('*', 'blip')[0] || r.getElementsByTagNameNS('*', 'imagedata')[0];
      const rId = blip?.getAttribute('r:embed') || blip?.getAttribute('r:id');
      if (rId && imageMap[rId]) {
        result += `<img src="${imageMap[rId]}" style="max-width: 100%; height: auto; display: inline-block; margin: 4px;" />`;
      }

      // Check for breaks <w:br/>
      const brs = r.getElementsByTagNameNS('*', 'br');
      for (let i = 0; i < brs.length; i++) {
        result += '<br/>';
      }

      // Check for tabs <w:tab/>
      const tabs = r.getElementsByTagNameNS('*', 'tab');
      if (tabs.length > 0) {
        result += '&emsp;';
      }

      const rPr = r.getElementsByTagNameNS('*', 'rPr')[0];
      const isBold = !!(rPr?.getElementsByTagNameNS('*', 'b')[0]);
      const isItalic = !!(rPr?.getElementsByTagNameNS('*', 'i')[0]);
      const isUnderline = !!(rPr?.getElementsByTagNameNS('*', 'u')[0]);
      const isStrike = !!(rPr?.getElementsByTagNameNS('*', 'strike')[0]);
      const colorNode = rPr?.getElementsByTagNameNS('*', 'color')[0];
      const colorVal = colorNode?.getAttribute('w:val') || colorNode?.getAttribute('val');
      const szNode = rPr?.getElementsByTagNameNS('*', 'sz')[0];
      const szVal = szNode?.getAttribute('w:val') || szNode?.getAttribute('val');

      const texts = Array.from(r.getElementsByTagNameNS('*', 't'));
      let text = texts.map(t => t.textContent || '').join('');
      if (!text) continue;
      text = DOMPurify.sanitize(text);

      let styles = '';
      if (isBold) styles += 'font-weight: bold; ';
      if (isItalic) styles += 'font-style: italic; ';
      if (isUnderline) styles += 'text-decoration: underline; ';
      if (isStrike) styles += 'text-decoration: line-through; ';
      if (colorVal && colorVal !== 'auto') styles += `color: #${colorVal}; `;
      if (szVal) {
        const pt = parseInt(szVal, 10) / 2;
        if (!isNaN(pt) && pt > 0) styles += `font-size: ${pt}pt; `;
      }

      if (styles) {
        result += `<span style="${styles}">${text}</span>`;
      } else {
        result += text;
      }
    }

    return result;
  }

  private renderBinaryDocFallback(ctx: RenderContext, wrapper: HTMLElement): void {
    const card = document.createElement('div');
    card.className = 'fp-docx-page-card';
    card.style.backgroundColor = '#ffffff';
    card.style.borderRadius = '6px';
    card.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
    card.style.padding = '48px 56px';
    card.style.fontFamily = 'Calibri, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    card.style.color = '#1e293b';
    card.style.lineHeight = '1.6';

    try {
      const cfbf = new CfbfReader(ctx.buffer);
      const wordDocStream = cfbf.readStream('WordDocument');
      if (wordDocStream && wordDocStream.length >= 512) {
        const text = this.extractReadableStrings(wordDocStream);
        card.innerHTML = `<div style="white-space: pre-wrap;">${DOMPurify.sanitize(text)}</div>`;
        wrapper.appendChild(card);
        return;
      }
    } catch {
      // Direct extraction fallback
    }

    const text = this.extractReadableStrings(new Uint8Array(ctx.buffer));
    card.innerHTML = `<div style="white-space: pre-wrap;">${DOMPurify.sanitize(text)}</div>`;
    wrapper.appendChild(card);
  }

  private extractReadableStrings(bytes: Uint8Array): string {
    let result = '';
    let current = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
        current += String.fromCharCode(b);
      } else if (b === 0 && i + 1 < bytes.length && bytes[i + 1] >= 32 && bytes[i + 1] <= 126) {
        continue;
      } else {
        if (current.trim().length > 3) {
          result += current.trim() + '\n\n';
        }
        current = '';
      }
    }
    if (current.trim().length > 3) {
      result += current.trim();
    }
    return result;
  }
}

export function docxPlugin(): DocxPlugin {
  return new DocxPlugin();
}

export default DocxPlugin;

