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
    wrapper.style.maxWidth = 'none';
    wrapper.style.width = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.backgroundColor = 'transparent';
    wrapper.style.minHeight = '100%';
    wrapper.style.transformOrigin = 'top center';
    wrapper.style.transition = 'transform 0.2s ease';

    ctx.container.style.overflow = 'auto';
    ctx.container.style.padding = '16px 8px';
    ctx.container.style.backgroundColor = '#f1f5f9';
    ctx.container.appendChild(wrapper);

    let scale = 1.0;
    let rotation = 0;
    let pageElements: HTMLElement[] = [];

    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'width';

    const calculateFitScale = (mode: 'width' | 'page' = fitMode) => {
      const activeEl = pageElements[currentPage - 1] || wrapper;
      const elW = (activeEl && activeEl.offsetWidth > 0) ? activeEl.offsetWidth : 816;
      const singlePageH = Math.min(activeEl?.offsetHeight || 1056, Math.round(elW * 1.32));
      // Minimal side margins (12px on each side)
      const availW = Math.max(280, ctx.container.clientWidth - 24);
      const availH = Math.max(280, ctx.container.clientHeight - 32);

      const sW = availW / elW;
      const sH = availH / singlePageH;

      if (mode === 'page') {
        return Math.max(0.35, Math.min(3.5, Math.min(sW, sH)));
      }
      return Math.max(0.4, Math.min(3.5, sW));
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
          scale = calculateFitScale(fitMode);
          applyTransform();
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
      
      // Flatten and collect all child content elements
      const contentNodes: HTMLElement[] = [];
      for (const item of htmlElements) {
        if (item.children && item.children.length > 0 && !item.tagName.toLowerCase().startsWith('table')) {
          contentNodes.push(...Array.from(item.children as HTMLCollectionOf<HTMLElement>));
        } else {
          contentNodes.push(item as HTMLElement);
        }
      }

      // Temporarily mount to wrapper to measure real layout heights
      wrapper.innerHTML = '';
      contentNodes.forEach(node => wrapper.appendChild(node));

      const childHeights = contentNodes.map(c => {
        const rectH = c.getBoundingClientRect ? c.getBoundingClientRect().height : 0;
        const offH = c.offsetHeight || 0;
        const textLen = c.textContent?.trim().length || 0;
        const estH = Math.max(24, Math.ceil(textLen / 75) * 22 + 14);
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
        pageCard.style.maxWidth = '100%';
        pageCard.style.boxSizing = 'border-box';
        pageCard.style.fontFamily = 'serif';
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

    let indicator: HTMLElement | null = null;
    if (totalPages > 1) {
      indicator = document.createElement('div');
      indicator.className = 'fp-rtf-page-indicator';
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
      if (totalPages > 1) {
        pageElements.forEach((el, idx) => {
          el.style.display = idx + 1 === currentPage ? 'block' : 'none';
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

    const cleanup = () => {
      resizeObserver?.disconnect();
      indicator?.remove();
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
        scale += 0.15;
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
