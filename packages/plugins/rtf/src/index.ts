import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
// @ts-ignore - rtf.js bundle has no individual d.ts
import * as RTFJS from 'rtf.js/dist/RTFJS.bundle.js';

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
      // Minimal side margins (16px on each side, safe from vertical scrollbar)
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
      const doc = new (RTFJS as any).Document(ctx.buffer, {});
      const htmlElements = await doc.render();
      
      // Collect block-level elements without flattening paragraphs into raw inline spans
      const contentNodes: HTMLElement[] = [];
      const extractBlocks = (nodes: any[]) => {
        for (const item of nodes) {
          if (!item || !(item instanceof HTMLElement)) continue;
          const tag = item.tagName.toLowerCase();
          
          // Check if item contains child block elements (sections/outer wrappers)
          const hasChildBlocks = Array.from(item.children).some(c => {
            const ct = c.tagName.toLowerCase();
            return ['p', 'div', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'ul', 'ol'].includes(ct);
          });

          if (hasChildBlocks && !['table', 'tr', 'td', 'th', 'ul', 'ol', 'li'].includes(tag)) {
            extractBlocks(Array.from(item.children));
          } else {
            // Ensure paragraph block display and bottom margin so headings and text never run together
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

      // Temporarily mount to wrapper to measure real layout heights
      wrapper.innerHTML = '';
      contentNodes.forEach(node => wrapper.appendChild(node));

      const childHeights = contentNodes.map(c => {
        const rectH = c.getBoundingClientRect ? c.getBoundingClientRect().height : 0;
        const offH = c.offsetHeight || 0;
        const textLen = c.textContent?.trim().length || 0;
        const estH = Math.max(28, Math.ceil(textLen / 75) * 24 + 16);
        return Math.max(rectH, offH, estH);
      });

      wrapper.innerHTML = '';

      const createRtfCard = () => {
        const card = document.createElement('div');
        card.className = 'fp-rtf-page-card';
        card.style.backgroundColor = '#ffffff';
        card.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
        card.style.borderRadius = '4px';
        card.style.padding = '72px 56px';
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
      const maxH = 912; // 1056px - 144px margins

      for (let i = 0; i < contentNodes.length; i++) {
        const child = contentNodes[i];
        const chH = childHeights[i];
        curCard.appendChild(child);
        curH += chH;

        if (curH >= maxH && i < contentNodes.length - 1) {
          curCard = createRtfCard();
          wrapper.appendChild(curCard);
          pageElements.push(curCard);
          curH = 0;
        }
      }
    } catch (err) {
      console.warn('[RtfPlugin] RTF render error, fallback text:', err);
      const text = new TextDecoder('latin1').decode(ctx.buffer);
      // Split on \page control word for basic pagination
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
        pageCard.style.padding = '72px 56px';
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
