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
    wrapper.className = 'fp-docx-wrapper';
    wrapper.style.transformOrigin = 'top center';
    wrapper.style.transition = 'transform 0.2s ease';
    wrapper.style.padding = '16px 8px';
    wrapper.style.maxWidth = 'none';
    wrapper.style.width = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
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
        ignoreLastRenderedPageBreak: false, // Honor Word's exact page breaks!
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        useBase64URL: true,
      });

      // Ensure wrapper remains attached to container
      if (!ctx.container.contains(wrapper)) {
        ctx.container.appendChild(wrapper);
      }

      // Check if visible content was actually produced
      if (wrapper.children.length > 0 && (wrapper.textContent?.trim().length ?? 0) > 0) {
        renderedSuccessfully = true;

        // Inject DrawingML charts that docx-preview drops
        try {
          const unzipped = unzipSync(new Uint8Array(ctx.buffer));
          const chartKeys = Object.keys(unzipped)
            .filter(k => k.replace(/^[./\\]+/, '').toLowerCase().startsWith('word/charts/chart') && k.endsWith('.xml'))
            .sort();

          if (chartKeys.length > 0) {
            const allDivs = Array.from(wrapper.querySelectorAll<HTMLElement>('div'));
            const emptyContainers = allDivs.filter(div => {
              const st = div.getAttribute('style') || '';
              return st.includes('width:') && st.includes('height:') && div.children.length === 0 && (div.textContent?.trim().length ?? 0) === 0;
            });

            chartKeys.forEach((cKey, idx) => {
              const target = emptyContainers[idx];
              if (target) {
                const xmlStr = strFromU8(unzipped[cKey]);
                const svg = this.parseAndRenderChartSvg(xmlStr);
                if (svg) {
                  target.innerHTML = svg;
                  target.style.display = 'block';
                  target.style.margin = '12px auto';
                }
              }
            });
          }
        } catch (chartErr) {
          console.warn('[DocxPlugin] Non-critical error rendering DrawingML charts:', chartErr);
        }
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
      } catch (fallbackErr: any) {
        console.error('[DocxPlugin] Native fallback failed:', fallbackErr);
        const isCorrupt = fallbackErr?.message?.includes('invalid zip') || fallbackErr?.message?.includes('corrupted');
        wrapper.innerHTML = `
          <div style="text-align:center; padding: 48px 32px; background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); max-width: 600px; margin: 40px auto;">
            <div style="font-size:48px; margin-bottom: 16px;">${isCorrupt ? '⚠️' : '📄'}</div>
            <h3 style="margin: 0 0 8px; color: #1e293b; font-size: 18px;">${ctx.metadata.name || 'Word Document'}</h3>
            <p style="color: #64748b; margin: 0 0 16px; font-size: 14px; line-height: 1.5;">
              ${isCorrupt 
                ? 'This document appears to be corrupted or contains invalid archive data and cannot be opened (matches Microsoft Word on Windows).'
                : 'Could not render document content. The file structure may be damaged.'}
            </p>
          </div>
        `;
        if (!ctx.container.contains(wrapper)) {
          ctx.container.appendChild(wrapper);
        }
      }
    }

    let sections = Array.from(wrapper.querySelectorAll<HTMLElement>('section.docx'));
    const cards = Array.from(wrapper.querySelectorAll<HTMLElement>('.fp-docx-page-card'));

    // Check EVERY section and split any section containing multi-page content
    if (sections.length > 0 && cards.length === 0) {
      const finalSections: HTMLElement[] = [];

      for (const singleSec of sections) {
        const contentContainer = (singleSec.querySelector('article') as HTMLElement) || singleSec;
        const children = Array.from(contentContainer.children) as HTMLElement[];

        // Measure page height (A4 is ~1122px, US Letter is ~1056px)
        const pageH = singleSec.offsetHeight > 1300 ? 1122 : Math.max(1056, singleSec.offsetHeight);
        const secH = singleSec.scrollHeight || singleSec.offsetHeight;

        if (secH > pageH * 1.25 && children.length > 1) {
          // Record heights while elements are in DOM
          const childHeights = children.map(c => {
            const rectH = c.getBoundingClientRect().height;
            const offH = c.offsetHeight;
            const textLen = c.textContent?.trim().length || 0;
            const estH = Math.max(24, Math.ceil(textLen / 80) * 22 + 16);
            return Math.max(rectH, offH, estH);
          });

          const parent = singleSec.parentElement || wrapper;
          const headerEl = singleSec.querySelector('header');
          const footerEl = singleSec.querySelector('footer');

          contentContainer.innerHTML = '';
          singleSec.style.minHeight = `${pageH}px`;
          singleSec.style.boxSizing = 'border-box';

          let curContent = contentContainer;
          let curSec = singleSec;
          let curH = 0;
          const maxH = pageH - 140; // Printable area between margins/padding

          finalSections.push(singleSec);

          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const chH = childHeights[i];

            curContent.appendChild(child);
            curH += chH;

            if (curH >= maxH && i < children.length - 1) {
              const nextSec = document.createElement('section');
              nextSec.className = singleSec.className;
              nextSec.style.cssText = singleSec.style.cssText;
              nextSec.style.minHeight = `${pageH}px`;
              nextSec.style.boxSizing = 'border-box';
              nextSec.style.backgroundColor = '#ffffff';
              nextSec.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.08)';
              nextSec.style.borderRadius = '4px';
              nextSec.style.marginBottom = '24px';

              if (headerEl) {
                nextSec.appendChild(headerEl.cloneNode(true));
              }

              const nextArticle = document.createElement('article');
              if (contentContainer.tagName.toLowerCase() === 'article') {
                nextArticle.style.cssText = contentContainer.style.cssText;
              }
              nextSec.appendChild(nextArticle);

              if (footerEl) {
                nextSec.appendChild(footerEl.cloneNode(true));
              }

              if (curSec.nextSibling) {
                parent.insertBefore(nextSec, curSec.nextSibling);
              } else {
                parent.appendChild(nextSec);
              }

              finalSections.push(nextSec);
              curSec = nextSec;
              curContent = nextArticle;
              curH = 0;
            }
          }
        } else {
          finalSections.push(singleSec);
        }
      }
      sections = finalSections;
    }

    const pageElements: HTMLElement[] = sections.length > 0 ? sections : cards;
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
      ctx.container.scrollTop = 0;
      ctx.emit('page-change', { page: currentPage, total: totalPages });
    };

    if (totalPages > 1) {
      showPage(1);
    }

    scale = 1.0;
    let rotation = 0;
    let fitMode: 'width' | 'page' = 'page';

    const calculateFitScale = (_mode: 'width' | 'page' = fitMode) => {
      const activeEl = pageElements[currentPage - 1] || wrapper.querySelector('section.docx') as HTMLElement || wrapper;
      const elW = activeEl.offsetWidth || 816;
      
      // Minimal side margins: 12px left + 12px right = 24px
      const availW = Math.max(280, ctx.container.clientWidth - 24);
      const sW = availW / elW;

      // Fit to Page fills the frame horizontally with only minimal side margins
      return Math.max(0.25, Math.min(3.5, sW));
    };

    const applyTransform = () => {
      wrapper.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
      wrapper.style.transformOrigin = 'top center';
      const activeEl = pageElements[currentPage - 1] || wrapper.querySelector('section.docx') as HTMLElement || wrapper;
      const elH = activeEl.offsetHeight || 1056;
      if (scale > 1.0) {
        wrapper.style.marginBottom = `${Math.round((elH * scale) - elH + 32)}px`;
      } else {
        wrapper.style.marginBottom = '32px';
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        const newFit = calculateFitScale('page');
        if (Math.abs(scale - newFit) > 0.015) {
          scale = newFit;
          applyTransform();
        }
      });
      resizeObserver.observe(ctx.container);
    }

    setTimeout(() => {
      scale = calculateFitScale('page');
      applyTransform();
    }, 40);

    const cleanup = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
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
        scale = Math.min(3.5, scale + 0.15);
        applyTransform();
      },
      zoomOut: () => {
        scale = Math.max(0.2, scale - 0.15);
        applyTransform();
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        applyTransform();
      },
      fitToPage: () => {
        scale = calculateFitScale('page');
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

    // Parse page dimensions
    const sectPrs = Array.from(doc.getElementsByTagNameNS('*', 'sectPr'));
    const lastSectPr = sectPrs[sectPrs.length - 1];
    
    let defaultW = 12240; // US Letter 8.5"
    let defaultH = 15840; // US Letter 11"
    let margins = { top: 1440, right: 1440, bottom: 1440, left: 1440 }; // 1" margins
    
    if (lastSectPr) {
      const pgSz = lastSectPr.getElementsByTagNameNS('*', 'pgSz')[0];
      if (pgSz) {
        defaultW = parseInt(pgSz.getAttribute('w:w') || pgSz.getAttribute('w') || '12240', 10);
        defaultH = parseInt(pgSz.getAttribute('w:h') || pgSz.getAttribute('h') || '15840', 10);
      }
      const pgMar = lastSectPr.getElementsByTagNameNS('*', 'pgMar')[0];
      if (pgMar) {
        margins.top = parseInt(pgMar.getAttribute('w:top') || pgMar.getAttribute('top') || '1440', 10);
        margins.bottom = parseInt(pgMar.getAttribute('w:bottom') || pgMar.getAttribute('bottom') || '1440', 10);
        margins.left = parseInt(pgMar.getAttribute('w:left') || pgMar.getAttribute('left') || '1440', 10);
        margins.right = parseInt(pgMar.getAttribute('w:right') || pgMar.getAttribute('right') || '1440', 10);
      }
    }

    const createPageCard = () => {
      const card = document.createElement('div');
      card.className = 'fp-docx-page-card';
      card.style.backgroundColor = '#ffffff';
      card.style.borderRadius = '4px';
      card.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
      card.style.fontFamily = 'Calibri, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      card.style.color = '#1e293b';
      card.style.lineHeight = '1.6';
      card.style.boxSizing = 'border-box';
      card.style.overflow = 'hidden';
      card.style.position = 'relative';
      card.style.marginBottom = '24px';
      
      // Convert twips to px (1 twip = 1/1440 inch, 1 inch = 96px => /15)
      card.style.width = `${defaultW / 15}px`;
      card.style.height = `${defaultH / 15}px`;
      card.style.padding = `${margins.top / 15}px ${margins.right / 15}px ${margins.bottom / 15}px ${margins.left / 15}px`;
      
      return card;
    };

    let currentCard = createPageCard();
    let currentHtml = '';
    const pages: { card: HTMLElement, html: string }[] = [{ card: currentCard, html: '' }];

    const flushHtml = () => {
      pages[pages.length - 1].html += currentHtml;
      currentHtml = '';
    };

    const newPage = () => {
      flushHtml();
      currentCard = createPageCard();
      pages.push({ card: currentCard, html: '' });
    };

    const body = doc.getElementsByTagNameNS('*', 'body')[0] || doc.documentElement;

    for (const child of Array.from(body.children)) {
      const tag = child.localName || child.nodeName.split(':').pop();

      if (tag === 'p') {
        const pStyle = child.getElementsByTagNameNS('*', 'pStyle')[0];
        const styleVal = pStyle?.getAttribute('w:val') || pStyle?.getAttribute('val') || '';
        const numPr = child.getElementsByTagNameNS('*', 'numPr')[0];

        const chunks = this.extractParagraphChunks(child, imageMap);
        
        for (let i = 0; i < chunks.length; i++) {
          if (i > 0) {
            newPage();
          }
          
          const textContent = chunks[i];
          if (!textContent.trim() && !textContent.includes('<img')) {
            currentHtml += '<div style="height: 10px;"></div>';
            continue;
          }

          const lowerStyle = styleVal.toLowerCase();
          if (lowerStyle.includes('title')) {
            currentHtml += `<h1 style="font-size: 28px; font-weight: 700; color: #1e3a8a; margin: 24px 0 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">${textContent}</h1>`;
          } else if (lowerStyle.includes('heading1') || styleVal === '1') {
            currentHtml += `<h2 style="font-size: 22px; font-weight: 700; color: #1e40af; margin: 20px 0 10px;">${textContent}</h2>`;
          } else if (lowerStyle.includes('heading2') || styleVal === '2') {
            currentHtml += `<h3 style="font-size: 18px; font-weight: 600; color: #2563eb; margin: 16px 0 8px;">${textContent}</h3>`;
          } else if (lowerStyle.includes('heading3') || styleVal === '3') {
            currentHtml += `<h4 style="font-size: 15px; font-weight: 600; color: #334155; margin: 12px 0 6px;">${textContent}</h4>`;
          } else if (numPr) {
            currentHtml += `<div style="display: flex; gap: 8px; margin: 4px 0 4px 20px;"><span style="color: #2563eb; font-weight: bold;">•</span><span>${textContent}</span></div>`;
          } else {
            currentHtml += `<p style="margin: 8px 0; font-size: 14px;">${textContent}</p>`;
          }
        }
      } else if (tag === 'tbl') {
        currentHtml += '<table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #cbd5e1;">';
        const rows = Array.from(child.getElementsByTagNameNS('*', 'tr'));
        rows.forEach((tr, rIdx) => {
          currentHtml += `<tr style="${rIdx === 0 ? 'background-color: #f8fafc; font-weight: 600;' : ''}">`;
          const cells = Array.from(tr.getElementsByTagNameNS('*', 'tc'));
          cells.forEach((tc) => {
            const cellText = this.extractParagraphHtml(tc, imageMap);
            currentHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 13px;">${cellText || '&nbsp;'}</td>`;
          });
          currentHtml += '</tr>';
        });
        currentHtml += '</table>';
      }
    }
    flushHtml();

    for (const page of pages) {
      page.card.innerHTML = DOMPurify.sanitize(page.html, {
        ADD_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'table', 'tr', 'td', 'span', 'b', 'i', 'u', 's', 'strike', 'img', 'div', 'br'],
        ADD_ATTR: ['style', 'src', 'alt', 'colspan', 'rowspan']
      });
      wrapper.appendChild(page.card);
    }
  }

  private extractParagraphHtml(pElement: Element, imageMap: Record<string, string> = {}): string {
    return this.extractParagraphChunks(pElement, imageMap).join('<br/>');
  }

  private extractParagraphChunks(pElement: Element, imageMap: Record<string, string> = {}): string[] {
    const chunks: string[] = [''];
    let currentChunkIndex = 0;

    // Check for inline drawings in this paragraph
    const drawings = Array.from(pElement.getElementsByTagNameNS('*', 'drawing'));
    for (const drawing of drawings) {
      const blip = drawing.getElementsByTagNameNS('*', 'blip')[0];
      const rId = blip?.getAttribute('r:embed') || blip?.getAttribute('r:id');
      if (rId && imageMap[rId]) {
        chunks[currentChunkIndex] += `<div style="text-align:center; margin: 12px 0;"><img src="${imageMap[rId]}" style="max-width: 100%; height: auto; border-radius: 4px;" /></div>`;
      }
    }

    const runs = Array.from(pElement.getElementsByTagNameNS('*', 'r'));
    if (runs.length === 0 && !chunks[currentChunkIndex]) {
      chunks[currentChunkIndex] = DOMPurify.sanitize(pElement.textContent || '');
      return chunks;
    }

    for (const r of runs) {
      const blip = r.getElementsByTagNameNS('*', 'blip')[0] || r.getElementsByTagNameNS('*', 'imagedata')[0];
      const rId = blip?.getAttribute('r:embed') || blip?.getAttribute('r:id');
      if (rId && imageMap[rId]) {
        chunks[currentChunkIndex] += `<img src="${imageMap[rId]}" style="max-width: 100%; height: auto; display: inline-block; margin: 4px;" />`;
      }

      // Check for breaks <w:br/>
      const brs = Array.from(r.getElementsByTagNameNS('*', 'br'));
      for (const br of brs) {
        const type = br.getAttribute('w:type') || br.getAttribute('type');
        if (type === 'page') {
          chunks.push('');
          currentChunkIndex++;
        } else {
          chunks[currentChunkIndex] += '<br/>';
        }
      }

      // Check for tabs <w:tab/>
      const tabs = r.getElementsByTagNameNS('*', 'tab');
      if (tabs.length > 0) {
        chunks[currentChunkIndex] += '&emsp;';
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
        chunks[currentChunkIndex] += `<span style="${styles}">${text}</span>`;
      } else {
        chunks[currentChunkIndex] += text;
      }
    }

    return chunks;
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

  private parseAndRenderChartSvg(xmlStr: string, width = 500, height = 260): string {
    // Extract categories
    const catMatches = [...xmlStr.matchAll(/<c:cat>[\s\S]*?<c:strCache>([\s\S]*?)<\/c:strCache>/g)];
    let categories: string[] = [];
    if (catMatches.length > 0) {
      categories = [...catMatches[0][1].matchAll(/<c:v>([^<]+)<\/c:v>/g)].map(m => m[1]);
    }
    if (categories.length === 0) {
      categories = ['Category 1', 'Category 2', 'Category 3', 'Category 4'];
    }

    // Extract series
    const defaultColors = ['#004586', '#ff420e', '#ffd320', '#579d1c', '#7e0021', '#83caff'];
    const sers = [...xmlStr.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)];
    const series: { title: string; color: string; values: number[] }[] = [];

    sers.forEach((s, sIdx) => {
      const titleMatch = s[1].match(/<c:tx>[\s\S]*?<c:v>([^<]+)<\/c:v>/);
      const title = titleMatch ? titleMatch[1] : `Series ${sIdx + 1}`;

      const clrMatch = s[1].match(/<a:srgbClr\s+val="([^"]+)"/);
      const color = clrMatch ? '#' + clrMatch[1] : defaultColors[sIdx % defaultColors.length];

      const valMatch = s[1].match(/<c:val>[\s\S]*?<c:numCache>([\s\S]*?)<\/c:numCache>/);
      let values: number[] = [];
      if (valMatch) {
        values = [...valMatch[1].matchAll(/<c:pt\s+idx="(\d+)">\s*<c:v>([^<]+)<\/c:v>/g)]
          .sort((a, b) => parseInt(a[1], 10) - parseInt(b[1], 10))
          .map(m => parseFloat(m[2]) || 0);
      }
      series.push({ title, color, values });
    });

    if (series.length === 0) return '';

    let maxVal = 10;
    series.forEach(s => s.values.forEach(v => { if (v > maxVal) maxVal = v; }));
    maxVal = Math.ceil(maxVal * 1.15);
    if (maxVal % 2 !== 0) maxVal++;

    const padLeft = 45;
    const padBottom = 55;
    const padTop = 20;
    const padRight = 20;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const yTicks = 5;
    let gridLines = '';
    for (let i = 0; i <= yTicks; i++) {
      const val = (maxVal / yTicks) * i;
      const y = padTop + plotH - (val / maxVal) * plotH;
      gridLines += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + plotW}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />`;
      gridLines += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#64748b" font-family="Calibri, sans-serif">${Math.round(val)}</text>`;
    }

    const numCats = categories.length;
    const numSers = series.length;
    const groupW = plotW / numCats;
    const barW = Math.max(8, Math.min(28, (groupW * 0.7) / numSers));
    const groupPad = (groupW - barW * numSers) / 2;

    let bars = '';
    let catLabels = '';

    for (let c = 0; c < numCats; c++) {
      const catX = padLeft + c * groupW;
      catLabels += `<text x="${catX + groupW / 2}" y="${padTop + plotH + 18}" text-anchor="middle" font-size="11" fill="#334155" font-family="Calibri, sans-serif">${categories[c]}</text>`;

      for (let s = 0; s < numSers; s++) {
        const val = series[s].values[c] ?? 0;
        const bH = Math.max(0, (val / maxVal) * plotH);
        const bX = catX + groupPad + s * barW;
        const bY = padTop + plotH - bH;
        bars += `<rect x="${bX}" y="${bY}" width="${barW - 2}" height="${bH}" fill="${series[s].color}" rx="1" />`;
      }
    }

    let legend = '';
    const legY = height - 12;
    let legX = padLeft + (plotW - numSers * 100) / 2;
    series.forEach(s => {
      legend += `<rect x="${legX}" y="${legY - 9}" width="10" height="10" fill="${s.color}" rx="2" />`;
      legend += `<text x="${legX + 15}" y="${legY}" font-size="11" fill="#475569" font-family="Calibri, sans-serif">${s.title}</text>`;
      legX += 95;
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background:#ffffff; border-radius:4px; overflow:visible;" xmlns="http://www.w3.org/2000/svg">
        ${gridLines}
        <line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#94a3b8" stroke-width="1.5" />
        <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="#94a3b8" stroke-width="1.5" />
        ${bars}
        ${catLabels}
        ${legend}
      </svg>
    `.trim();
  }
}

export function docxPlugin(): DocxPlugin {
  return new DocxPlugin();
}

export default DocxPlugin;

