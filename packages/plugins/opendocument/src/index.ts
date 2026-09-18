import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance,
  Thumbnail
} from '@patel.sumit51/core';
import { unzipSync, strFromU8 } from 'fflate';
import DOMPurify from 'dompurify';

export class OpenDocumentPlugin implements PreviewPlugin {
  id = 'opendocument';
  name = 'OpenDocument Preview (ODT, ODP, ODS, ODG, ODF)';
  extensions = ['.odt', '.odp', '.ods', '.odg', '.odf'];
  mimeTypes = [
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.graphics',
    'application/vnd.oasis.opendocument.formula'
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
    const isPresentation = (instance as any).isPresentation;
    const totalPages = instance.getPageCount?.() ?? 1;
    const actions: ToolbarAction[] = [];

    if (isPresentation || totalPages > 1) {
      if (isPresentation) {
        actions.push({
          id: 'thumbnails',
          icon: 'thumbnails',
          label: 'Slide Thumbnails',
          type: 'button',
          group: 'navigation',
          execute: () => instance.toggleThumbnails?.()
        });
      }

      actions.push({
        id: 'page-nav',
        icon: '',
        label: isPresentation ? 'Slide Navigation' : 'Page Navigation',
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
          } else if (typeof action === 'number') {
            instance.goToPage?.(action);
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
    const ext = (ctx.metadata.extension || '').toLowerCase();
    const mime = (ctx.metadata.mimeType || '').toLowerCase();
    const isPresentation = ext === '.odp' || mime.includes('presentation');
    const isFormula = ext === '.odf' || mime.includes('formula');
    const isDrawing = ext === '.odg' || mime.includes('graphics');

    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(new Uint8Array(ctx.buffer));
    } catch {
      throw new Error('Failed to decompress OpenDocument package (invalid ZIP format)');
    }

    // Pre-cache embedded image URLs
    const imageUrls = new Map<string, string>();
    for (const [filePath, fileBytes] of Object.entries(unzipped)) {
      if (filePath.startsWith('Pictures/')) {
        const imageMime = filePath.endsWith('.png') ? 'image/png' :
                          filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? 'image/jpeg' :
                          filePath.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
        const blob = new Blob([fileBytes], { type: imageMime });
        imageUrls.set(filePath, URL.createObjectURL(blob));
      }
    }

    const contentXmlStr = unzipped['content.xml'] ? strFromU8(unzipped['content.xml']) : '';
    const stylesXmlStr = unzipped['styles.xml'] ? strFromU8(unzipped['styles.xml']) : '';

    const parser = new DOMParser();
    const contentDoc = parser.parseFromString(contentXmlStr, 'application/xml');
    const stylesDoc = stylesXmlStr ? parser.parseFromString(stylesXmlStr, 'application/xml') : null;

    // Extract styles map
    const styleMap = this.extractStyles(stylesDoc, contentDoc);

    const container = document.createElement('div');
    container.className = 'fp-odf-container';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'auto';
    container.style.padding = '24px';
    container.style.backgroundColor = '#f1f5f9';

    const wrapper = document.createElement('div');
    wrapper.className = 'fp-odf-wrapper';
    wrapper.style.margin = '0 auto';
    wrapper.style.backgroundColor = '#ffffff';
    wrapper.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)';
    wrapper.style.borderRadius = '4px';
    wrapper.style.transformOrigin = 'top center';
    wrapper.style.transition = 'transform 0.2s ease';

    container.appendChild(wrapper);
    ctx.container.appendChild(container);

    let scale = 1.0;
    let currentPage = 1;
    let totalPages = 1;
    let slides: HTMLElement[] = [];

    if (isPresentation) {
      // ODP (Presentation): render slides
      wrapper.style.maxWidth = '960px';
      wrapper.style.aspectRatio = '16 / 9';
      wrapper.style.position = 'relative';
      wrapper.style.overflow = 'hidden';

      slides = this.renderSlides(contentDoc, styleMap, imageUrls);
      totalPages = Math.max(1, slides.length);

      slides.forEach((slide, idx) => {
        slide.style.display = idx === 0 ? 'block' : 'none';
        slide.style.width = '100%';
        slide.style.height = '100%';
        slide.style.position = 'absolute';
        slide.style.top = '0';
        slide.style.left = '0';
        wrapper.appendChild(slide);
      });
    } else if (isFormula) {
      // ODF (Formula): extract MathML
      wrapper.style.maxWidth = '800px';
      wrapper.style.padding = '48px';
      wrapper.style.textAlign = 'center';
      wrapper.style.fontSize = '24px';

      const mathEl = contentDoc.querySelector('math');
      if (mathEl) {
        wrapper.innerHTML = mathEl.outerHTML;
      } else {
        wrapper.textContent = contentDoc.documentElement.textContent || 'Formula content';
      }
    } else {
      // ODT (Text), ODS (Spreadsheet fallback), ODG (Graphics)
      wrapper.style.maxWidth = '850px';
      wrapper.style.padding = '48px';
      wrapper.style.minHeight = '100%';

      const bodyHtml = this.renderOdfBody(contentDoc, styleMap, imageUrls);
      wrapper.innerHTML = DOMPurify.sanitize(bodyHtml, {
        ADD_TAGS: ['math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub'],
        ADD_ATTR: ['style', 'colspan', 'rowspan']
      });
    }

    const cleanup = () => {
      imageUrls.forEach(url => URL.revokeObjectURL(url));
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    const goToPage = (page: number) => {
      if (!isPresentation || page < 1 || page > totalPages) return;
      currentPage = page;
      slides.forEach((s, idx) => {
        s.style.display = idx === page - 1 ? 'block' : 'none';
      });
      ctx.emit('page-change', { page: currentPage, total: totalPages });
    };

    return {
      destroy: cleanup,
      isPresentation,
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
      goToPage,
      getPageCount: () => totalPages,
      getCurrentPage: () => currentPage,
      getThumbnails: async (): Promise<Thumbnail[]> => {
        if (!isPresentation) return [];
        return slides.map((_, idx) => ({
          index: idx,
          label: `Slide ${idx + 1}`,
          render: async (canvas: HTMLCanvasElement) => {
            const ctx2d = canvas.getContext('2d');
            if (!ctx2d) return;
            canvas.width = 160;
            canvas.height = 90;
            ctx2d.fillStyle = '#f8fafc';
            ctx2d.fillRect(0, 0, 160, 90);
            ctx2d.fillStyle = '#334155';
            ctx2d.font = 'bold 12px sans-serif';
            ctx2d.textAlign = 'center';
            ctx2d.fillText(`Slide ${idx + 1}`, 80, 50);
          }
        }));
      },
      download: () => {
        const mimeType = this.mimeTypes.find(m => m.includes(ext.replace('.', ''))) || 'application/octet-stream';
        const blob = new Blob([ctx.buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || `document${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        window.print();
      }
    } as any;
  }

  private extractStyles(stylesDoc: Document | null, contentDoc: Document): Map<string, string> {
    const map = new Map<string, string>();
    const styleNodes: Element[] = [];

    if (stylesDoc) {
      styleNodes.push(...Array.from(stylesDoc.querySelectorAll('style, [name]')));
    }
    styleNodes.push(...Array.from(contentDoc.querySelectorAll('style, [name]')));

    for (const node of styleNodes) {
      const name = node.getAttribute('style:name') || node.getAttribute('name');
      if (!name) continue;

      let css = '';
      const textProp = node.querySelector('text-properties, [font-weight], [font-style], [color]');
      if (textProp) {
        const weight = textProp.getAttribute('fo:font-weight') || textProp.getAttribute('font-weight');
        const style = textProp.getAttribute('fo:font-style') || textProp.getAttribute('font-style');
        const color = textProp.getAttribute('fo:color') || textProp.getAttribute('color');
        const size = textProp.getAttribute('fo:font-size') || textProp.getAttribute('font-size');

        if (weight === 'bold') css += 'font-weight: bold; ';
        if (style === 'italic') css += 'font-style: italic; ';
        if (color) css += `color: ${color}; `;
        if (size) css += `font-size: ${size}; `;
      }

      const paraProp = node.querySelector('paragraph-properties, [text-align]');
      if (paraProp) {
        const align = paraProp.getAttribute('fo:text-align') || paraProp.getAttribute('text-align');
        const mt = paraProp.getAttribute('fo:margin-top') || paraProp.getAttribute('margin-top');
        const mb = paraProp.getAttribute('fo:margin-bottom') || paraProp.getAttribute('margin-bottom');

        if (align) css += `text-align: ${align}; `;
        if (mt) css += `margin-top: ${mt}; `;
        if (mb) css += `margin-bottom: ${mb}; `;
      }

      if (css) map.set(name, css);
    }

    return map;
  }

  private renderOdfBody(contentDoc: Document, styles: Map<string, string>, images: Map<string, string>): string {
    const body = contentDoc.querySelector('body') || contentDoc.documentElement;
    let html = '';

    const walk = (node: Element) => {
      const tag = node.localName || node.tagName.toLowerCase();

      switch (tag) {
        case 'h': {
          const level = Math.min(6, Math.max(1, Number(node.getAttribute('text:outline-level') || 1)));
          const style = styles.get(node.getAttribute('text:style-name') || '') || '';
          html += `<h${level} style="${style}; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">${node.textContent || ''}</h${level}>`;
          break;
        }
        case 'p': {
          const style = styles.get(node.getAttribute('text:style-name') || '') || '';
          const inner = this.renderSpans(node, styles, images);
          html += `<p style="${style}; line-height: 1.6; margin: 8px 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">${inner}</p>`;
          break;
        }
        case 'list': {
          html += '<ul style="margin: 8px 0; padding-left: 24px;">';
          Array.from(node.children).forEach(c => walk(c));
          html += '</ul>';
          break;
        }
        case 'list-item': {
          html += '<li>';
          Array.from(node.children).forEach(c => walk(c));
          html += '</li>';
          break;
        }
        case 'table': {
          html += '<table style="border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid #d0d7de;">';
          Array.from(node.children).forEach(c => walk(c));
          html += '</table>';
          break;
        }
        case 'table-row': {
          html += '<tr>';
          Array.from(node.children).forEach(c => walk(c));
          html += '</tr>';
          break;
        }
        case 'table-cell': {
          html += '<td style="border: 1px solid #d0d7de; padding: 8px 12px; font-size: 13px;">';
          Array.from(node.children).forEach(c => walk(c));
          html += '</td>';
          break;
        }
        default:
          Array.from(node.children).forEach(c => walk(c));
      }
    };

    Array.from(body.children).forEach(c => walk(c));

    return html || '<p style="color: #666; font-style: italic;">(Document is empty)</p>';
  }

  private renderSpans(node: Element, styles: Map<string, string>, images: Map<string, string>): string {
    let result = '';

    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent || '';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.localName || el.tagName.toLowerCase();

        if (tag === 'span') {
          const style = styles.get(el.getAttribute('text:style-name') || '') || '';
          result += `<span style="${style}">${el.textContent || ''}</span>`;
        } else if (tag === 'image') {
          const href = el.getAttribute('xlink:href') || el.getAttribute('href') || '';
          const blobUrl = images.get(href);
          if (blobUrl) {
            result += `<img src="${blobUrl}" style="max-width: 100%; height: auto; margin: 8px 0;" alt="Embedded image" />`;
          }
        } else if (tag === 's') {
          const count = Number(el.getAttribute('text:c') || 1);
          result += '&nbsp;'.repeat(count);
        } else if (tag === 'tab') {
          result += '&emsp;';
        } else if (tag === 'line-break') {
          result += '<br/>';
        } else {
          result += el.textContent || '';
        }
      }
    }

    return result;
  }

  private renderSlides(contentDoc: Document, styles: Map<string, string>, images: Map<string, string>): HTMLElement[] {
    const pages = Array.from(contentDoc.querySelectorAll('page, [draw\\:name]'));
    const slides: HTMLElement[] = [];

    const pageNodes = pages.length > 0 ? pages : Array.from(contentDoc.getElementsByTagNameNS('*', 'page'));

    if (pageNodes.length === 0) {
      const fallbackSlide = document.createElement('div');
      fallbackSlide.style.padding = '40px';
      fallbackSlide.style.textAlign = 'center';
      fallbackSlide.innerHTML = '<h2>Presentation</h2><p>No slides found</p>';
      return [fallbackSlide];
    }

    pageNodes.forEach((pageEl, idx) => {
      const slide = document.createElement('div');
      slide.className = `fp-odp-slide fp-odp-slide-${idx + 1}`;
      slide.style.padding = '40px';
      slide.style.boxSizing = 'border-box';
      slide.style.display = 'flex';
      slide.style.flexDirection = 'column';
      slide.style.justifyContent = 'center';
      slide.style.alignItems = 'center';
      slide.style.background = '#ffffff';

      const textFrames = Array.from(pageEl.querySelectorAll('frame, text-box, [draw\\:text-style-name]'));
      if (textFrames.length > 0) {
        textFrames.forEach((frame) => {
          const text = frame.textContent?.trim();
          if (text) {
            const p = document.createElement('div');
            p.style.margin = '12px 0';
            p.style.fontSize = idx === 0 ? '24px' : '16px';
            p.style.fontWeight = idx === 0 ? 'bold' : 'normal';
            p.style.color = '#1e293b';
            p.textContent = text;
            slide.appendChild(p);
          }
        });
      } else {
        slide.innerHTML = `<h3>Slide ${idx + 1}</h3><p>${pageEl.textContent?.trim() || ''}</p>`;
      }

      slides.push(slide);
    });

    return slides;
  }
}

export function openDocumentPlugin(): OpenDocumentPlugin {
  return new OpenDocumentPlugin();
}

export default OpenDocumentPlugin;
