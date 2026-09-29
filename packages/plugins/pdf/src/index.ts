import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance, 
  Thumbnail 
} from '@patel.sumit51/core';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker: 100% local, zero external network dependencies
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  if (!pdfjsLib.GlobalWorkerOptions.workerPort && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const customWorker = (window as any).__PDF_WORKER_SRC__;
    if (customWorker) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = customWorker;
    } else {
      try {
        pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
          new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
          { type: 'module' }
        );
      } catch {
        pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';
      }
    }
  }
}

export class PdfPlugin implements PreviewPlugin {
  id = 'pdf';
  name = 'PDF Document Preview';
  extensions = ['.pdf'];
  mimeTypes = ['application/pdf'];
  weight = 100;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    if (ext) return this.extensions.includes(ext);
    return this.mimeTypes.includes(mime || '');
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    const totalPages = instance.getPageCount?.() ?? 1;
    const curPage = instance.getCurrentPage?.() ?? 1;

    return [
      {
        id: 'thumbnails',
        icon: 'thumbnails',
        label: 'Page Thumbnails',
        type: 'button',
        group: 'navigation',
        execute: () => instance.toggleThumbnails?.()
      },
      {
        id: 'page-nav',
        icon: '',
        label: 'Page Navigation',
        type: 'page-nav',
        group: 'navigation',
        value: curPage,
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
        id: 'reset-zoom',
        icon: 'reset-zoom',
        label: 'Reset Zoom',
        type: 'button',
        group: 'zoom',
        execute: () => instance.resetZoom?.()
      },
      {
        id: 'fit-width',
        icon: 'fit-width',
        label: 'Fit to Width',
        type: 'button',
        group: 'zoom',
        execute: () => instance.fitToWidth?.()
      },
      {
        id: 'rotate-cw',
        icon: 'rotate-cw',
        label: 'Rotate Clockwise',
        type: 'button',
        group: 'view',
        execute: () => instance.rotateCW?.()
      },
      {
        id: 'rotate-ccw',
        icon: 'rotate-ccw',
        label: 'Rotate Counter-Clockwise',
        type: 'button',
        group: 'view',
        execute: () => instance.rotateCCW?.()
      },
      {
        id: 'search',
        icon: 'search',
        label: 'Search / Find (Ctrl+F)',
        type: 'button',
        group: 'actions',
        execute: () => (instance as any).openSearch?.()
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download PDF',
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
    ];
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const container = document.createElement('div');
    container.className = 'fp-pdf-container';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'auto';
    container.style.backgroundColor = '#0f172a';
    container.style.boxSizing = 'border-box';
    container.style.position = 'relative';

    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'fp-pdf-scroll-wrapper';
    scrollWrapper.style.minWidth = '100%';
    scrollWrapper.style.minHeight = '100%';
    scrollWrapper.style.width = 'max-content';
    scrollWrapper.style.height = 'max-content';
    scrollWrapper.style.display = 'flex';
    scrollWrapper.style.flexDirection = 'column';
    scrollWrapper.style.alignItems = 'center';
    scrollWrapper.style.justifyContent = 'flex-start';
    scrollWrapper.style.padding = '16px 8px';
    scrollWrapper.style.boxSizing = 'border-box';

    container.appendChild(scrollWrapper);
    ctx.container.appendChild(container);

    const standardFontsUrl = (typeof window !== 'undefined' && (window as any).__PDF_STANDARD_FONTS_URL__) || './standard_fonts/';
    const cmapsUrl = (typeof window !== 'undefined' && (window as any).__PDF_CMAPS_URL__) || './cmaps/';

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(ctx.buffer.slice(0)),
      cMapUrl: cmapsUrl,
      cMapPacked: true,
      standardFontDataUrl: standardFontsUrl,
      verbosity: 0,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = Math.max(1, pdfDoc.numPages);

    const pageCards: HTMLElement[] = [];
    for (let i = 1; i <= totalPages; i++) {
      const card = document.createElement('div');
      card.className = 'fp-pdf-page-card';
      card.setAttribute('data-page-number', String(i));
      card.style.boxShadow = '0 10px 35px rgba(0, 0, 0, 0.5)';
      card.style.backgroundColor = '#ffffff';
      card.style.borderRadius = '4px';
      card.style.overflow = 'hidden';
      card.style.lineHeight = '0';
      card.style.position = 'relative';
      card.style.flexShrink = '0';
      card.style.marginBottom = i < totalPages ? '24px' : '0';
      card.style.transition = 'box-shadow 0.2s ease';

      const pageCanvas = document.createElement('canvas');
      card.appendChild(pageCanvas);
      scrollWrapper.appendChild(card);
      pageCards.push(card);
    }

    const initialPage = typeof (ctx.options as any)?.page === 'number' && (ctx.options as any).page >= 1
      ? Math.max(1, Math.min(totalPages, (ctx.options as any).page))
      : 1;
    let currentPage = initialPage;
    let zoomScale = typeof (ctx.options as any)?.zoom === 'number' && (ctx.options as any).zoom > 0
      ? (ctx.options as any).zoom
      : 1.0;
    let rotation = 0;
    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'width';

    const renderTasks: Map<number, any> = new Map();
    const renderedScale: Map<number, number> = new Map();
    const renderedRotation: Map<number, number> = new Map();

    const pageTextCache: Map<number, string> = new Map();
    let activeSearchQuery = '';
    let activeCaseSensitive = false;
    let allMatches: Array<{ page: number; matchIndexOnPage: number }> = [];
    let currentMatchIdx = -1;

    let effectiveScale = 1.0;

    const updateLayoutDimensions = async () => {
      const firstPage = await pdfDoc.getPage(1);
      const unscaledVp = firstPage.getViewport({ scale: 1.0, rotation });

      const containerWidth = container.clientWidth || 900;
      const containerHeight = container.clientHeight || 700;
      const availWidth = Math.max(280, containerWidth - 36);
      const availHeight = Math.max(280, containerHeight - 32);
      const scaleW = availWidth / unscaledVp.width;
      const scaleH = availHeight / unscaledVp.height;

      let fitScale: number;
      if (fitMode === 'page') {
        fitScale = Math.max(0.2, Math.min(4.0, Math.min(scaleW, scaleH)));
      } else {
        fitScale = Math.max(0.2, Math.min(4.0, scaleW));
      }
      effectiveScale = (fitScale > 0 ? fitScale : 1.0) * zoomScale;

      const estimatedW = Math.floor(unscaledVp.width * effectiveScale);
      const estimatedH = Math.floor(unscaledVp.height * effectiveScale);

      pageCards.forEach((c) => {
        c.style.width = `${estimatedW}px`;
        c.style.height = `${estimatedH}px`;
      });
    };

    const clearHighlights = () => {
      pageCards.forEach((c) => {
        const textLayer = c.querySelector('.textLayer');
        if (!textLayer) return;
        const marks = textLayer.querySelectorAll('mark.fp-search-match');
        const parents = new Set<Node>();
        marks.forEach((m) => {
          const p = m.parentNode;
          if (p) {
            parents.add(p);
            while (m.firstChild) {
              p.insertBefore(m.firstChild, m);
            }
            p.removeChild(m);
          }
        });
        parents.forEach((p) => p.normalize());
      });
    };

    const applyHighlightsToPage = (pageNum: number) => {
      const card = pageCards[pageNum - 1];
      if (!card || !activeSearchQuery) return;
      const textLayer = card.querySelector('.textLayer') as HTMLElement | null;
      if (!textLayer) return;

      const marks = textLayer.querySelectorAll('mark.fp-search-match');
      const parents = new Set<Node>();
      marks.forEach((m) => {
        const p = m.parentNode;
        if (p) {
          parents.add(p);
          while (m.firstChild) {
            p.insertBefore(m.firstChild, m);
          }
          p.removeChild(m);
        }
      });
      parents.forEach((p) => p.normalize());

      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escapeRegex(activeSearchQuery), activeCaseSensitive ? 'g' : 'gi');
      const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let n = walker.nextNode();
      while (n) {
        textNodes.push(n as Text);
        n = walker.nextNode();
      }

      const pageMarks: HTMLElement[] = [];
      for (const textNode of textNodes) {
        const val = textNode.nodeValue || '';
        re.lastIndex = 0;
        const matchesInNode: Array<{ start: number; end: number }> = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(val)) !== null) {
          matchesInNode.push({ start: m.index, end: m.index + m[0].length });
        }

        if (matchesInNode.length > 0) {
          const nodeMarks: HTMLElement[] = [];
          for (let i = matchesInNode.length - 1; i >= 0; i--) {
            const { start, end } = matchesInNode[i];
            textNode.splitText(end);
            const matchTarget = textNode.splitText(start);
            const mark = document.createElement('mark');
            mark.className = 'fp-search-match';
            mark.textContent = matchTarget.textContent;
            matchTarget.parentNode?.replaceChild(mark, matchTarget);
            nodeMarks.unshift(mark);
          }
          pageMarks.push(...nodeMarks);
        }
      }

      if (currentMatchIdx >= 0 && currentMatchIdx < allMatches.length) {
        const curMatch = allMatches[currentMatchIdx];
        if (curMatch.page === pageNum && pageMarks.length > 0) {
          const markIdx = Math.min(curMatch.matchIndexOnPage, pageMarks.length - 1);
          const activeMark = pageMarks[markIdx];
          if (activeMark) {
            activeMark.classList.add('fp-search-match-active');
            activeMark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          }
        }
      }
    };

    const getPageText = async (p: number): Promise<string> => {
      if (pageTextCache.has(p)) return pageTextCache.get(p)!;
      try {
        const page = await pdfDoc.getPage(p);
        const tc = await page.getTextContent();
        const text = (tc.items as any[]).map((it) => it.str || '').join(' ');
        pageTextCache.set(p, text);
        return text;
      } catch {
        return '';
      }
    };

    const search = async (query: string, options?: { caseSensitive?: boolean }) => {
      clearHighlights();
      activeSearchQuery = (query || '').trim();
      activeCaseSensitive = !!options?.caseSensitive;
      allMatches = [];
      currentMatchIdx = -1;

      if (!activeSearchQuery) {
        return { total: 0, current: 0 };
      }

      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escapeRegex(activeSearchQuery), activeCaseSensitive ? 'g' : 'gi');

      for (let p = 1; p <= totalPages; p++) {
        const text = await getPageText(p);
        re.lastIndex = 0;
        let matchCountOnPage = 0;
        while (re.exec(text) !== null) {
          allMatches.push({ page: p, matchIndexOnPage: matchCountOnPage });
          matchCountOnPage++;
        }
      }

      const total = allMatches.length;
      if (total === 0) {
        return { total: 0, current: 0 };
      }

      let targetIdx = allMatches.findIndex((m) => m.page >= currentPage);
      if (targetIdx === -1) targetIdx = 0;
      currentMatchIdx = targetIdx;

      const targetMatch = allMatches[currentMatchIdx];
      scrollToPage(targetMatch.page);
      await renderPage(targetMatch.page);
      applyHighlightsToPage(targetMatch.page);

      return { total, current: currentMatchIdx + 1 };
    };

    const searchNext = async () => {
      if (allMatches.length === 0) return { total: 0, current: 0 };
      currentMatchIdx = (currentMatchIdx + 1) % allMatches.length;
      const targetMatch = allMatches[currentMatchIdx];
      scrollToPage(targetMatch.page);
      await renderPage(targetMatch.page);
      applyHighlightsToPage(targetMatch.page);
      return { total: allMatches.length, current: currentMatchIdx + 1 };
    };

    const searchPrev = async () => {
      if (allMatches.length === 0) return { total: 0, current: 0 };
      currentMatchIdx = (currentMatchIdx - 1 + allMatches.length) % allMatches.length;
      const targetMatch = allMatches[currentMatchIdx];
      scrollToPage(targetMatch.page);
      await renderPage(targetMatch.page);
      applyHighlightsToPage(targetMatch.page);
      return { total: allMatches.length, current: currentMatchIdx + 1 };
    };

    const clearSearch = () => {
      activeSearchQuery = '';
      allMatches = [];
      currentMatchIdx = -1;
      clearHighlights();
    };

    const renderPage = async (pageNum: number) => {
      const card = pageCards[pageNum - 1];
      if (!card) return;

      if (renderedScale.get(pageNum) === effectiveScale && renderedRotation.get(pageNum) === rotation) {
        return;
      }

      if (renderTasks.has(pageNum)) {
        try {
          renderTasks.get(pageNum).cancel();
        } catch {}
        renderTasks.delete(pageNum);
      }

      const page = await pdfDoc.getPage(pageNum);
      const pixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: effectiveScale, rotation });

      const displayWidth = Math.floor(viewport.width);
      const displayHeight = Math.floor(viewport.height);

      card.style.width = `${displayWidth}px`;
      card.style.height = `${displayHeight}px`;

      let canvas = card.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        card.appendChild(canvas);
      }
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      canvasCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderTask = page.render({
        canvasContext: canvasCtx,
        viewport,
      });
      renderTasks.set(pageNum, renderTask);

      try {
        await renderTask.promise;
        renderedScale.set(pageNum, effectiveScale);
        renderedRotation.set(pageNum, rotation);
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`[PdfPlugin] Page ${pageNum} render warning:`, err);
        }
        return;
      } finally {
        if (renderTasks.get(pageNum) === renderTask) {
          renderTasks.delete(pageNum);
        }
      }

      // Render Text Layer
      let textLayerDiv = card.querySelector('.textLayer') as HTMLElement | null;
      if (textLayerDiv) {
        textLayerDiv.remove();
      }
      try {
        textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = `${displayWidth}px`;
        textLayerDiv.style.height = `${displayHeight}px`;
        textLayerDiv.style.position = 'absolute';
        textLayerDiv.style.top = '0';
        textLayerDiv.style.left = '0';
        textLayerDiv.style.lineHeight = '1';
        card.appendChild(textLayerDiv);

        if ((pdfjsLib as any).TextLayer) {
          const textLayer = new (pdfjsLib as any).TextLayer({
            textContentSource: page.streamTextContent(),
            container: textLayerDiv,
            viewport,
          });
          await textLayer.render();
        }

        if (activeSearchQuery) {
          applyHighlightsToPage(pageNum);
        }
      } catch (err) {
        console.debug('[PdfPlugin] TextLayer notice:', err);
      }
    };

    let isScrollingProgrammatically = false;
    let scrollTimeout: any = null;

    const scrollToPage = (pageNum: number) => {
      currentPage = Math.max(1, Math.min(totalPages, pageNum));
      const targetCard = pageCards[currentPage - 1];
      if (targetCard) {
        isScrollingProgrammatically = true;
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        renderPage(currentPage);

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          isScrollingProgrammatically = false;
        }, 1000);
      }
      ctx.emit('page-change', { page: currentPage, total: totalPages });
    };

    const reRenderAll = async () => {
      await updateLayoutDimensions();
      renderedScale.clear();
      renderedRotation.clear();
      const cRect = container.getBoundingClientRect();
      const visibleIndices: number[] = [];
      pageCards.forEach((card, idx) => {
        const rect = card.getBoundingClientRect();
        if (rect.bottom >= cRect.top - 400 && rect.top <= cRect.bottom + 400) {
          visibleIndices.push(idx + 1);
        }
      });
      if (visibleIndices.length === 0) visibleIndices.push(currentPage);
      for (const p of visibleIndices) {
        renderPage(p);
      }
    };

    // Initialize layout and render first page
    await updateLayoutDimensions();
    renderPage(1);

    if (totalPages > 1) {
      ctx.emit('page-change', { page: currentPage, total: totalPages });
    }

    const lazyRenderObserver = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const idx = pageCards.indexOf(entry.target as HTMLElement);
              if (idx !== -1) {
                renderPage(idx + 1);
              }
            }
          });
        }, {
          root: container,
          rootMargin: '400px 0px 400px 0px'
        })
      : null;

    if (lazyRenderObserver) {
      pageCards.forEach(c => lazyRenderObserver.observe(c));
    }

    const pageTrackingObserver = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          if (isScrollingProgrammatically) return;

          let maxRatio = 0;
          let mostVisible = currentPage;

          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
              maxRatio = entry.intersectionRatio;
              const idx = pageCards.indexOf(entry.target as HTMLElement);
              if (idx !== -1) {
                mostVisible = idx + 1;
              }
            }
          });

          if (mostVisible !== currentPage && maxRatio > 0.1) {
            currentPage = mostVisible;
            ctx.emit('page-change', { page: currentPage, total: totalPages });
          }
        }, {
          root: container,
          threshold: [0.1, 0.3, 0.5, 0.7, 0.9]
        })
      : null;

    if (pageTrackingObserver) {
      pageCards.forEach(c => pageTrackingObserver.observe(c));
    }

    if (currentPage > 1) {
      setTimeout(() => {
        scrollToPage(currentPage);
      }, 50);
    }

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (Math.abs(zoomScale - 1.0) < 0.05) {
          reRenderAll();
        }
      }, 120);
    });
    resizeObserver.observe(container);

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        zoomScale = Math.max(0.25, Math.min(4.0, Math.round((zoomScale + delta) * 100) / 100));
        reRenderAll();
      }
    };
    container.addEventListener('wheel', onWheel, { passive: false });

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentPage < totalPages) {
          e.preventDefault();
          scrollToPage(currentPage + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPage > 1) {
          e.preventDefault();
          scrollToPage(currentPage - 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToPage(totalPages);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const cleanup = () => {
      resizeObserver.disconnect();
      lazyRenderObserver?.disconnect();
      pageTrackingObserver?.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('wheel', onWheel);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      renderTasks.forEach((task) => {
        try { task.cancel(); } catch {}
      });
      renderTasks.clear();
      try {
        pdfDoc.destroy();
      } catch {}
      clearSearch();
      container.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    const instance: PreviewInstance = {
      destroy: cleanup,
      zoomIn: () => {
        zoomScale = Math.min(4.0, Math.round((zoomScale + 0.2) * 10) / 10);
        reRenderAll();
      },
      zoomOut: () => {
        zoomScale = Math.max(0.25, Math.round((zoomScale - 0.2) * 10) / 10);
        reRenderAll();
      },
      getZoom: () => zoomScale,
      setZoom: (level: number) => {
        zoomScale = Math.max(0.25, Math.min(4.0, level));
        reRenderAll();
      },
      fitToPage: () => {
        fitMode = 'page';
        zoomScale = 1.0;
        reRenderAll();
      },
      resetZoom: () => {
        fitMode = ((ctx as any)?.options?.fitMode as any) || 'width';
        zoomScale = 1.0;
        rotation = 0;
        container.scrollTop = 0;
        container.scrollLeft = 0;
        reRenderAll();
      },
      fitToWidth: () => {
        fitMode = 'width';
        zoomScale = 1.0;
        reRenderAll();
      },
      rotateCW: () => {
        rotation = (rotation + 90) % 360;
        reRenderAll();
      },
      rotateCCW: () => {
        rotation = (rotation - 90 + 360) % 360;
        reRenderAll();
      },
      getRotation: () => rotation,
      getPageCount: () => totalPages,
      getCurrentPage: () => currentPage,
      goToPage: (page: number) => {
        scrollToPage(page);
      },
      toggleThumbnails: () => {
        (ctx as any)?.toggleThumbnails?.();
      },
      download: () => {
        const blob = new Blob([ctx.buffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'document.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        const blob = new Blob([ctx.buffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const hiddenIframe = document.createElement('iframe');
        hiddenIframe.style.position = 'fixed';
        hiddenIframe.style.right = '0';
        hiddenIframe.style.bottom = '0';
        hiddenIframe.style.width = '0';
        hiddenIframe.style.height = '0';
        hiddenIframe.style.border = '0';
        document.body.appendChild(hiddenIframe);
        hiddenIframe.src = url;
        hiddenIframe.onload = () => {
          setTimeout(() => {
            hiddenIframe.contentWindow?.print();
            setTimeout(() => {
              hiddenIframe.remove();
              URL.revokeObjectURL(url);
            }, 1000);
          }, 300);
        };
      },
      getThumbnails: async (): Promise<Thumbnail[]> => {
        const thumbnails: Thumbnail[] = [];
        const count = totalPages;

        for (let i = 1; i <= count; i++) {
          thumbnails.push({
            index: i,
            label: `Page ${i}`,
            render: async (thumbCanvas: HTMLCanvasElement) => {
              try {
                const p = await pdfDoc.getPage(i);
                const baseVp = p.getViewport({ scale: 1.0, rotation });
                const targetW = thumbCanvas.width || 130;
                const thumbScale = targetW / baseVp.width;
                const thumbVp = p.getViewport({ scale: thumbScale, rotation });
                thumbCanvas.height = Math.floor(thumbVp.height);

                const tCtx = thumbCanvas.getContext('2d');
                if (tCtx) {
                  await p.render({ canvasContext: tCtx, viewport: thumbVp }).promise;
                }
              } catch (e) {
                console.warn(`[PdfPlugin] Error generating thumbnail for page ${i}:`, e);
              }
            }
          });
        }
        return thumbnails;
      },
      search,
      searchNext,
      searchPrev,
      clearSearch,
      isSearchable: true,
    };

    return instance;
  }
}

export function pdfPlugin(): PdfPlugin {
  return new PdfPlugin();
}

export default PdfPlugin;
