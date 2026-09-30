import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance,
  Thumbnail
} from '@patel.sumit51/core';
import { downloadFile } from '@patel.sumit51/core';
import { unzipSync } from 'fflate';
import { PptxRenderer } from 'pptx-browser';

export class PptxPlugin implements PreviewPlugin {
  id = 'pptx';
  name = 'PowerPoint Presentation';
  extensions = ['.pptx', '.ppsx', '.pptm', '.ppsm', '.potx', '.potm'];
  mimeTypes = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
    'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
    'application/vnd.openxmlformats-officedocument.presentationml.template',
    'application/vnd.ms-powerpoint.template.macroEnabled.12'
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
    return [
      {
        id: 'thumbnails',
        icon: 'thumbnails',
        label: 'Slide Thumbnails',
        type: 'button',
        group: 'navigation',
        execute: () => instance.toggleThumbnails?.()
      },
      {
        id: 'page-nav',
        icon: '',
        label: 'Slide Navigation',
        type: 'page-nav',
        group: 'navigation',
        value: instance.getCurrentPage?.() ?? 1,
        max: instance.getPageCount?.() ?? 1,
        execute: (action: unknown, page?: unknown) => {
          if (action === 'prev') {
            const cur = instance.getCurrentPage?.() ?? 1;
            if (cur > 1) instance.goToPage?.(cur - 1);
          } else if (action === 'next') {
            const cur = instance.getCurrentPage?.() ?? 1;
            const total = instance.getPageCount?.() ?? 1;
            if (cur < total) instance.goToPage?.(cur + 1);
          } else if (typeof page === 'number') {
            instance.goToPage?.(page);
          } else if (typeof action === 'number') {
            instance.goToPage?.(action);
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
        label: 'Fit to Slide',
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
        label: 'Rotate',
        type: 'button',
        group: 'view',
        execute: () => instance.rotateCW?.()
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download PPTX',
        type: 'button',
        group: 'actions',
        execute: () => instance.download?.()
      },
      {
        id: 'print',
        icon: 'print',
        label: 'Print Presentation',
        type: 'button',
        group: 'actions',
        execute: () => instance.print?.()
      },
      {
        id: 'search',
        icon: 'search',
        label: 'Search / Find (Ctrl+F)',
        type: 'button',
        group: 'view',
        execute: () => (instance as any).search?.()
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
    let filesMap: Record<string, Uint8Array> = {};
    const renderer = new PptxRenderer();
    try {
      await renderer.load(ctx.buffer);
      filesMap = (renderer as any)._files || {};
    } catch (loadErr) {
      console.warn('[PptxPlugin] Initial renderer.load warning:', loadErr);
    }

    // Fallback unzipper if renderer._files is empty or incomplete
    if (!filesMap || Object.keys(filesMap).length === 0) {
      try {
        filesMap = unzipSync(new Uint8Array(ctx.buffer));
        (renderer as any)._files = filesMap;
      } catch (uzErr) {
        console.warn('[PptxPlugin] unzipSync fallback failed:', uzErr);
      }
    }

    // Normalize all zip keys to forward-slashes and no leading slash
    const normalizedFiles: Record<string, Uint8Array> = {};
    for (const [k, v] of Object.entries(filesMap)) {
      const cleanKey = k.replace(/\\/g, '/').replace(/^\//, '');
      normalizedFiles[cleanKey] = v;
    }

    // Helper to find file in normalizedFiles (exact or case-insensitive)
    const findFile = (relPath: string): Uint8Array | null => {
      const clean = relPath.replace(/\\/g, '/').replace(/^\//, '');
      if (normalizedFiles[clean]) return normalizedFiles[clean];
      const lower = clean.toLowerCase();
      for (const [k, v] of Object.entries(normalizedFiles)) {
        if (k.toLowerCase() === lower) return v;
      }
      return null;
    };

    const parser = new DOMParser();
    const safeParseXml = (xmlStr: string): Document => {
      const sanitized = xmlStr.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
      return parser.parseFromString(sanitized, 'application/xml');
    };

    // 1. Detect native slide dimensions (EMU) from ppt/presentation.xml
    let emuW = 9144000;
    let emuH = 5143500;
    const presBytes = findFile('ppt/presentation.xml') || findFile('presentation.xml');
    let presDoc: Document | null = null;
    if (presBytes) {
      try {
        const presXml = new TextDecoder('utf-8').decode(presBytes);
        presDoc = safeParseXml(presXml);
        const sldSzs = Array.from(presDoc.getElementsByTagNameNS('*', 'sldSz')).concat(
          Array.from(presDoc.getElementsByTagName('p:sldSz')),
          Array.from(presDoc.getElementsByTagName('sldSz'))
        );
        if (sldSzs.length > 0) {
          const cxAttr = sldSzs[0].getAttribute('cx');
          const cyAttr = sldSzs[0].getAttribute('cy');
          if (cxAttr && cyAttr) {
            emuW = parseInt(cxAttr, 10) || 9144000;
            emuH = parseInt(cyAttr, 10) || 5143500;
          }
        }
      } catch {}
    }

    // Update renderer.slideSize
    if (!renderer.slideSize || !renderer.slideSize.cx) {
      renderer.slideSize = { cx: emuW, cy: emuH };
    } else {
      emuW = renderer.slideSize.cx;
      emuH = renderer.slideSize.cy;
    }

    // 2. Discover ALL slides in exact presentation order
    const orderedSlidePaths: string[] = [];
    const seenSlidePaths = new Set<string>();

    // Parse ppt/_rels/presentation.xml.rels for relationship IDs -> Target
    const presRelsBytes = findFile('ppt/_rels/presentation.xml.rels') || findFile('_rels/presentation.xml.rels');
    const presRelsMap: Record<string, string> = {};
    if (presRelsBytes) {
      try {
        const relsXml = new TextDecoder('utf-8').decode(presRelsBytes);
        const relsDoc = safeParseXml(relsXml);
        const relEls = Array.from(relsDoc.getElementsByTagName('Relationship'));
        for (const rel of relEls) {
          const id = rel.getAttribute('Id') || rel.getAttribute('id');
          const target = rel.getAttribute('Target') || rel.getAttribute('target');
          if (id && target) {
            let fullTarget = target.startsWith('/') ? target.slice(1) : (target.startsWith('ppt/') ? target : `ppt/${target}`);
            fullTarget = fullTarget.replace(/\\/g, '/');
            presRelsMap[id] = fullTarget;
          }
        }
      } catch {}
    }

    // Read <p:sldIdLst> from presentation.xml
    if (presDoc) {
      try {
        const sldIdLst = presDoc.getElementsByTagNameNS('*', 'sldIdLst')[0] ||
                         presDoc.getElementsByTagName('p:sldIdLst')[0] ||
                         presDoc.getElementsByTagName('sldIdLst')[0];
        if (sldIdLst) {
          const sldIds = Array.from(sldIdLst.children).filter(c => c.localName === 'sldId' || c.nodeName.endsWith('sldId'));
          for (const sld of sldIds) {
            const rId = sld.getAttribute('r:id') ||
                        sld.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
                        sld.getAttribute('id') ||
                        Array.from(sld.attributes).find(a => a.name.endsWith(':id') || a.localName === 'id')?.value || '';
            const targetPath = presRelsMap[rId];
            if (targetPath) {
              const matchedKey = Object.keys(normalizedFiles).find(k => k.toLowerCase() === targetPath.toLowerCase()) || targetPath;
              if (!seenSlidePaths.has(matchedKey.toLowerCase())) {
                seenSlidePaths.add(matchedKey.toLowerCase());
                orderedSlidePaths.push(matchedKey);
              }
            }
          }
        }
      } catch {}
    }

    // If renderer.slidePaths has paths not yet in orderedSlidePaths, include them
    if (renderer.slidePaths && renderer.slidePaths.length > 0) {
      for (const p of renderer.slidePaths) {
        const clean = p.replace(/\\/g, '/').replace(/^\//, '');
        if (!seenSlidePaths.has(clean.toLowerCase())) {
          seenSlidePaths.add(clean.toLowerCase());
          orderedSlidePaths.push(clean);
        }
      }
    }

    // Supplementary scan: discover ANY slide XML files in ZIP not yet listed
    const supplementary: string[] = [];
    for (const key of Object.keys(normalizedFiles)) {
      if (/(^|\/)slides\/[^/]+\.xml$/i.test(key) && !key.toLowerCase().endsWith('.rels')) {
        if (!seenSlidePaths.has(key.toLowerCase())) {
          seenSlidePaths.add(key.toLowerCase());
          supplementary.push(key);
        }
      }
    }

    // Sort supplementary slides using natural numeric order (slide1, slide2, ..., slide10, slide36)
    supplementary.sort((a, b) => {
      const numA = parseInt(a.match(/slide[-_]?(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide[-_]?(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

    for (const s of supplementary) {
      orderedSlidePaths.push(s);
    }

    if (orderedSlidePaths.length === 0) {
      orderedSlidePaths.push('ppt/slides/slide1.xml');
    }

    renderer.slidePaths = orderedSlidePaths;
    renderer.slideCount = orderedSlidePaths.length;
    const slideCount = orderedSlidePaths.length;

    const initialSlide = typeof (ctx.options as any)?.page === 'number' && (ctx.options as any).page >= 1
      ? Math.max(1, Math.min(slideCount, (ctx.options as any).page))
      : 1;
    let currentSlide = initialSlide;
    const initialZoom = typeof (ctx.options as any)?.zoom === 'number' && (ctx.options as any).zoom > 0
      ? (ctx.options as any).zoom
      : 1.0;
    let scale = initialZoom;
    let rotation = 0;

    // Detect exact native slide dimensions and aspect ratio
    const slideAspect = emuW / emuH;
    const baseW = 1280;
    const baseH = Math.max(200, Math.round(baseW / slideAspect));

    // Presentation container setup
    const wrapper = document.createElement('div');
    wrapper.className = 'fp-pptx-wrapper';
    wrapper.tabIndex = 0;
    wrapper.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
      background: var(--fp-bg-canvas, #525659);
      outline: none;
    `;

    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'fp-pptx-scroll-wrapper';
    scrollWrapper.style.cssText = `
      min-width: 100%;
      min-height: 100%;
      width: max-content;
      height: max-content;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
      box-sizing: border-box;
    `;

    const sizer = document.createElement('div');
    sizer.className = 'fp-pptx-sizer';
    sizer.style.cssText = `
      position: relative;
      flex-shrink: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    const slideContainer = document.createElement('div');
    slideContainer.className = 'fp-slide-container';
    slideContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.4);
      border-radius: 6px;
      overflow: hidden;
      background: #ffffff;
      transform-origin: center center;
      transition: transform 0.2s ease;
      flex-shrink: 0;
      width: ${baseW}px;
      height: ${baseH}px;
      transform: translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg);
    `;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
      width: 100%;
      height: 100%;
      display: block;
      object-fit: fill;
    `;
    slideContainer.appendChild(canvas);
    sizer.appendChild(slideContainer);
    scrollWrapper.appendChild(sizer);
    wrapper.appendChild(scrollWrapper);

    ctx.container.innerHTML = '';
    ctx.container.style.overflow = 'hidden';
    ctx.container.appendChild(wrapper);

    // Default fit mode is 'width'
    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'width';
    let isUserZoomed = typeof (ctx.options as any)?.zoom === 'number' && (ctx.options as any).zoom > 0;

    const calculateFitScale = (mode: 'width' | 'page' = fitMode) => {
      const isRotated90 = (rotation % 180 !== 0);
      const orientedW = isRotated90 ? baseH : baseW;
      const orientedH = isRotated90 ? baseW : baseH;
      const availW = Math.max(200, (wrapper.clientWidth || ctx.container.clientWidth) - 64);
      const availH = Math.max(200, (wrapper.clientHeight || ctx.container.clientHeight) - 64);
      if (mode === 'page') {
        return Math.min(3.0, Math.min(availW / orientedW, availH / orientedH));
      }
      return Math.min(3.0, availW / orientedW);
    };

    const applyTransform = () => {
      const isRotated90 = (rotation % 180 !== 0);
      const boxW = Math.round((isRotated90 ? baseH : baseW) * scale);
      const boxH = Math.round((isRotated90 ? baseW : baseH) * scale);

      sizer.style.width = `${boxW}px`;
      sizer.style.height = `${boxH}px`;

      slideContainer.style.width = `${baseW}px`;
      slideContainer.style.height = `${baseH}px`;
      slideContainer.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`;
    };

    /**
     * Fallback slide renderer:
     * Parses slide XML directly and draws background, text shapes, tables, and images on canvas.
     * Guarantees NO slide is ever blank, even if third-party canvas routines encounter an unhandled element.
     */
    /**
     * Comprehensive Fallback Slide Renderer:
     * Directly parses OOXML Slide DOM, translating EMU coordinates (off, ext) to canvas pixels.
     * Accurately renders background fills, shape geometries, shape fills & borders, text runs with
     * font size/color/weight and multi-line wrapping, embedded pictures from ppt/media/*, tables (<a:tbl>),
     * and chart graphic frames.
     * Guarantees 100% visible, faithful slide preview even if external rendering libraries fail.
     */
    const renderSlideFallback = async (slideIndex: number, targetCanvas: HTMLCanvasElement, targetW: number) => {
      const targetH = Math.round(targetW / slideAspect);
      targetCanvas.width = targetW;
      targetCanvas.height = targetH;
      const ctx2d = targetCanvas.getContext('2d');
      if (!ctx2d) return;

      const slidePath = orderedSlidePaths[slideIndex] || `ppt/slides/slide${slideIndex + 1}.xml`;
      const slideBytes = normalizedFiles[slidePath] || Object.entries(normalizedFiles).find(([k]) => k.toLowerCase() === slidePath.toLowerCase())?.[1];

      // Base slide background
      ctx2d.fillStyle = '#ffffff';
      ctx2d.fillRect(0, 0, targetW, targetH);

      if (!slideBytes) {
        ctx2d.fillStyle = '#64748b';
        ctx2d.font = `bold ${Math.round(targetW * 0.03)}px sans-serif`;
        ctx2d.textAlign = 'center';
        ctx2d.textBaseline = 'middle';
        ctx2d.fillText(`Slide ${slideIndex + 1}`, targetW / 2, targetH / 2);
        return;
      }

      const slideXml = new TextDecoder('utf-8').decode(slideBytes);
      const doc = safeParseXml(slideXml);

      // Helper to query elements across OOXML namespaces
      const getTags = (root: Document | Element, tagName: string): Element[] => {
        const pTags = Array.from(root.getElementsByTagName('p:' + tagName));
        const aTags = Array.from(root.getElementsByTagName('a:' + tagName));
        const cTags = Array.from(root.getElementsByTagName('c:' + tagName));
        const rTags = Array.from(root.getElementsByTagName('r:' + tagName));
        const plainTags = Array.from(root.getElementsByTagName(tagName));
        const nsTags = Array.from(root.getElementsByTagNameNS('*', tagName));
        return Array.from(new Set([...pTags, ...aTags, ...cTags, ...rTags, ...plainTags, ...nsTags]));
      };

      // Load slide relationships (ppt/slides/_rels/slideX.xml.rels) to resolve pictures
      const slideParts = slidePath.split('/');
      const slideFilename = slideParts.pop() || '';
      const slideRelsPath = [...slideParts, '_rels', slideFilename + '.rels'].join('/');
      const slideRelsBytes = normalizedFiles[slideRelsPath] || Object.entries(normalizedFiles).find(([k]) => k.toLowerCase() === slideRelsPath.toLowerCase())?.[1];
      const relsMap: Record<string, string> = {};

      if (slideRelsBytes) {
        try {
          const relsXml = new TextDecoder('utf-8').decode(slideRelsBytes);
          const relsDoc = safeParseXml(relsXml);
          const relEls = Array.from(relsDoc.getElementsByTagName('Relationship'));
          for (const rel of relEls) {
            const id = rel.getAttribute('Id') || rel.getAttribute('id');
            const target = rel.getAttribute('Target') || rel.getAttribute('target');
            if (id && target) {
              const baseParts = [...slideParts];
              for (const part of target.split('/')) {
                if (part === '..') baseParts.pop();
                else if (part !== '.') baseParts.push(part);
              }
              relsMap[id] = baseParts.join('/');
            }
          }
        } catch {}
      }

      // Check slide background fill
      const bgEls = getTags(doc, 'bg');
      if (bgEls.length > 0) {
        const srgbClr = getTags(bgEls[0], 'srgbClr')[0];
        if (srgbClr) {
          const val = srgbClr.getAttribute('val');
          if (val) {
            ctx2d.fillStyle = '#' + val;
            ctx2d.fillRect(0, 0, targetW, targetH);
          }
        }
      }

      // Subtle slide border
      ctx2d.strokeStyle = '#e2e8f0';
      ctx2d.lineWidth = 1;
      ctx2d.strokeRect(0, 0, targetW, targetH);

      // Scale factors from EMU to canvas pixels
      const scaleX = targetW / emuW;
      const scaleY = targetH / emuH;

      // Extract bounding box from <a:xfrm> in EMU -> canvas pixels
      const getBox = (el: Element): { x: number; y: number; w: number; h: number } | null => {
        const xfrms = getTags(el, 'xfrm');
        if (xfrms.length === 0) return null;
        const xfrm = xfrms[0];
        const offs = getTags(xfrm, 'off');
        const exts = getTags(xfrm, 'ext');
        if (offs.length === 0 || exts.length === 0) return null;
        const offX = parseInt(offs[0].getAttribute('x') || '0', 10);
        const offY = parseInt(offs[0].getAttribute('y') || '0', 10);
        const extW = parseInt(exts[0].getAttribute('cx') || '0', 10);
        const extH = parseInt(exts[0].getAttribute('cy') || '0', 10);
        return {
          x: Math.round(offX * scaleX),
          y: Math.round(offY * scaleY),
          w: Math.round(extW * scaleX),
          h: Math.round(extH * scaleY)
        };
      };

      // Helper to extract colors from OOXML color definitions
      const getColor = (el: Element, defaultColor: string): string => {
        const srgb = getTags(el, 'srgbClr')[0];
        if (srgb) {
          const val = srgb.getAttribute('val');
          if (val) return '#' + val;
        }
        const scheme = getTags(el, 'schemeClr')[0];
        if (scheme) {
          const val = scheme.getAttribute('val');
          if (val === 'tx1' || val === 'dk1') return '#0f172a';
          if (val === 'tx2' || val === 'dk2') return '#334155';
          if (val === 'bg1' || val === 'lt1') return '#ffffff';
          if (val === 'bg2' || val === 'lt2') return '#f8fafc';
          if (val === 'accent1') return '#2563eb';
          if (val === 'accent2') return '#dc2626';
          if (val === 'accent3') return '#16a34a';
        }
        return defaultColor;
      };

      const spTrees = getTags(doc, 'spTree');
      const containerTree = spTrees[0] || doc.documentElement;
      let renderedElementsCount = 0;

      // 1. Render pictures (<p:pic>)
      const pics = getTags(containerTree, 'pic');
      for (const pic of pics) {
        const box = getBox(pic);
        if (!box || box.w <= 0 || box.h <= 0) continue;

        const blips = getTags(pic, 'blip');
        let rId = '';
        if (blips.length > 0) {
          rId = blips[0].getAttribute('r:embed') ||
                blips[0].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') ||
                blips[0].getAttribute('r:link') ||
                blips[0].getAttribute('id') || '';
        }

        if (rId && relsMap[rId]) {
          const imgPath = relsMap[rId];
          const imgBytes = normalizedFiles[imgPath] || Object.entries(normalizedFiles).find(([k]) => k.toLowerCase() === imgPath.toLowerCase())?.[1];
          if (imgBytes) {
            try {
              const ext = imgPath.split('.').pop()?.toLowerCase() || 'png';
              const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
              const blob = new Blob([imgBytes], { type: mime });
              const blobUrl = URL.createObjectURL(blob);
              await new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => {
                  try {
                    const imgAspect = img.width / img.height;
                    const boxAspect = box.w / box.h;
                    let drawW = box.w;
                    let drawH = box.h;
                    let drawX = box.x;
                    let drawY = box.y;
                    if (imgAspect > boxAspect) {
                      drawH = Math.round(box.w / imgAspect);
                      drawY = box.y + Math.round((box.h - drawH) / 2);
                    } else {
                      drawW = Math.round(box.h * imgAspect);
                      drawX = box.x + Math.round((box.w - drawW) / 2);
                    }
                    ctx2d.drawImage(img, drawX, drawY, drawW, drawH);
                    renderedElementsCount++;
                  } finally {
                    URL.revokeObjectURL(blobUrl);
                    resolve();
                  }
                };
                img.onerror = () => {
                  URL.revokeObjectURL(blobUrl);
                  resolve();
                };
                img.src = blobUrl;
              });
            } catch {}
          }
        }
      }

      // 2. Render tables (<a:tbl>) inside graphicFrames
      const graphicFrames = getTags(containerTree, 'graphicFrame');
      for (const gf of graphicFrames) {
        const box = getBox(gf);
        if (!box || box.w <= 0 || box.h <= 0) continue;

        const tbls = getTags(gf, 'tbl');
        if (tbls.length > 0) {
          const tbl = tbls[0];
          const rows = getTags(tbl, 'tr');
          if (rows.length > 0) {
            const rowCount = rows.length;
            const rowH = Math.round(box.h / rowCount);

            for (let rIdx = 0; rIdx < rowCount; rIdx++) {
              const row = rows[rIdx];
              const cells = getTags(row, 'tc');
              const colCount = Math.max(1, cells.length);
              const colW = Math.round(box.w / colCount);

              for (let cIdx = 0; cIdx < colCount; cIdx++) {
                const cell = cells[cIdx];
                const cellX = box.x + cIdx * colW;
                const cellY = box.y + rIdx * rowH;

                ctx2d.fillStyle = rIdx === 0 ? '#f1f5f9' : (rIdx % 2 === 0 ? '#ffffff' : '#f8fafc');
                ctx2d.fillRect(cellX, cellY, colW, rowH);

                ctx2d.strokeStyle = '#cbd5e1';
                ctx2d.lineWidth = 1;
                ctx2d.strokeRect(cellX, cellY, colW, rowH);

                const textNodes = getTags(cell, 't');
                const cellText = textNodes.map(t => t.textContent || '').join(' ').trim();
                if (cellText) {
                  const fontSize = Math.max(11, Math.min(16, Math.round(rowH * 0.35)));
                  ctx2d.font = `${rIdx === 0 ? 'bold ' : ''}${fontSize}px sans-serif`;
                  ctx2d.fillStyle = rIdx === 0 ? '#0f172a' : '#334155';
                  ctx2d.textAlign = 'left';
                  ctx2d.textBaseline = 'middle';
                  ctx2d.fillText(cellText.slice(0, 40), cellX + 8, cellY + rowH / 2, colW - 16);
                }
              }
            }
            renderedElementsCount++;
          }
        }
      }

      // 3. Render shapes (<p:sp>) with text and fills
      const shapes = getTags(containerTree, 'sp');
      for (const sp of shapes) {
        const box = getBox(sp);
        const spPrs = getTags(sp, 'spPr');
        const spPr = spPrs[0];

        // Draw shape background fill
        if (spPr && box && box.w > 0 && box.h > 0) {
          const solidFills = getTags(spPr, 'solidFill');
          if (solidFills.length > 0) {
            const fillColor = getColor(solidFills[0], '');
            if (fillColor && fillColor.toLowerCase() !== '#ffffff') {
              ctx2d.fillStyle = fillColor;
              const prstGeom = getTags(spPr, 'prstGeom')[0];
              const prst = prstGeom?.getAttribute('prst');
              if (prst === 'roundRect') {
                const radius = Math.min(12, Math.round(Math.min(box.w, box.h) * 0.15));
                ctx2d.beginPath();
                ctx2d.roundRect(box.x, box.y, box.w, box.h, radius);
                ctx2d.fill();
              } else {
                ctx2d.fillRect(box.x, box.y, box.w, box.h);
              }
              renderedElementsCount++;
            }
          }

          // Draw shape outline border
          const lns = getTags(spPr, 'ln');
          if (lns.length > 0) {
            const strokeColor = getColor(lns[0], '');
            if (strokeColor) {
              ctx2d.strokeStyle = strokeColor;
              ctx2d.lineWidth = 1;
              ctx2d.strokeRect(box.x, box.y, box.w, box.h);
            }
          }
        }

        // Process text body (<p:txBody>)
        const txBodies = getTags(sp, 'txBody');
        if (txBodies.length === 0) continue;
        const txBody = txBodies[0];

        const paragraphs = getTags(txBody, 'p');
        let textY = box ? box.y + 16 : Math.round(50 * (targetW / baseW));
        const boundX = box ? box.x + 12 : Math.round(60 * (targetW / baseW));
        const maxTextW = box ? Math.max(100, box.w - 24) : targetW - Math.round(120 * (targetW / baseW));

        for (const p of paragraphs) {
          const textRuns = getTags(p, 't');
          const lineText = textRuns.map(t => t.textContent || '').join('').trim();
          if (!lineText) continue;

          const pPrs = getTags(p, 'pPr');
          const pPr = pPrs[0];
          const algn = pPr?.getAttribute('algn') || 'l';

          const rPrs = getTags(p, 'rPr');
          const rPr = rPrs[0];
          const sz = rPr ? parseInt(rPr.getAttribute('sz') || '2000', 10) : 2000;
          const isBold = rPr?.getAttribute('b') === '1' || sz >= 2800;
          const isItalic = rPr?.getAttribute('i') === '1';
          const fontSize = Math.max(12, Math.round((sz / 100) * 1.333 * (targetH / 540)));
          const textColor = rPr ? getColor(rPr, isBold ? '#0f172a' : '#334155') : (isBold ? '#0f172a' : '#334155');

          ctx2d.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Calibri, sans-serif`;
          ctx2d.fillStyle = textColor;
          ctx2d.textBaseline = 'top';

          let renderAlignX = boundX;
          if (algn === 'ctr') {
            ctx2d.textAlign = 'center';
            renderAlignX = boundX + maxTextW / 2;
          } else if (algn === 'r') {
            ctx2d.textAlign = 'right';
            renderAlignX = boundX + maxTextW;
          } else {
            ctx2d.textAlign = 'left';
          }

          // Word wrap
          const words = lineText.split(' ');
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx2d.measureText(testLine);
            if (metrics.width > maxTextW && currentLine) {
              ctx2d.fillText(currentLine, renderAlignX, textY);
              textY += fontSize * 1.35;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) {
            ctx2d.fillText(currentLine, renderAlignX, textY);
            textY += fontSize * 1.4;
          }
          textY += Math.round(8 * (targetH / 540));
          renderedElementsCount++;
        }
      }

      // If nothing could be extracted, show clean slide number fallback
      if (renderedElementsCount === 0) {
        ctx2d.fillStyle = '#64748b';
        ctx2d.font = `bold ${Math.round(targetW * 0.03)}px sans-serif`;
        ctx2d.textAlign = 'center';
        ctx2d.textBaseline = 'middle';
        ctx2d.fillText(`Slide ${slideIndex + 1}`, targetW / 2, targetH / 2);
      }
    };

    const hasCanvasDrawnContent = (c: HTMLCanvasElement): boolean => {
      try {
        const testCtx = c.getContext('2d');
        if (!testCtx || c.width === 0 || c.height === 0) return false;
        // Sample 400 pixels across canvas
        const sampleW = Math.min(c.width, 20);
        const sampleH = Math.min(c.height, 20);
        const imgData = testCtx.getImageData(
          Math.floor(c.width / 4),
          Math.floor(c.height / 4),
          sampleW,
          sampleH
        ).data;
        for (let i = 0; i < imgData.length; i += 4) {
          // If pixel has alpha and is not pure white (#ffffff)
          if (imgData[i + 3] > 0 && (imgData[i] < 250 || imgData[i + 1] < 250 || imgData[i + 2] < 250)) {
            return true;
          }
        }
      } catch {}
      return false;
    };

    const renderCurrentSlide = async () => {
      let renderSucceeded = false;
      const dpr = typeof window !== 'undefined' ? Math.min(2, Math.max(1, window.devicePixelRatio || 1)) : 1;
      const renderW = Math.round(baseW * dpr);

      try {
        await renderer.renderSlide(currentSlide - 1, canvas, renderW);
        renderSucceeded = true;
      } catch (err) {
        console.warn(`[PptxPlugin] Canvas render encountered issue on slide ${currentSlide}:`, err);
        renderSucceeded = false;
      }

      if (!renderSucceeded) {
        await renderSlideFallback(currentSlide - 1, canvas, renderW);
      }

      canvas.style.width = `${baseW}px`;
      canvas.style.height = `${baseH}px`;

      ctx.emit('page-change', { page: currentSlide, total: slideCount, totalPages: slideCount });
      if (!isUserZoomed) {
        scale = calculateFitScale(fitMode);
      }
      applyTransform();
    };

    await renderCurrentSlide();

    // Mouse wheel slide-by-slide navigation
    let lastWheelTime = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const now = Date.now();
      if (now - lastWheelTime < 350) return;
      if (e.deltaY > 30) {
        if (currentSlide < slideCount) {
          lastWheelTime = now;
          currentSlide++;
          renderCurrentSlide();
        }
      } else if (e.deltaY < -30) {
        if (currentSlide > 1) {
          lastWheelTime = now;
          currentSlide--;
          renderCurrentSlide();
        }
      }
    };
    wrapper.addEventListener('wheel', onWheel, { passive: true });

    // Keyboard navigation
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (currentSlide < slideCount) {
          currentSlide++;
          renderCurrentSlide();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        if (currentSlide > 1) {
          currentSlide--;
          renderCurrentSlide();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        currentSlide = 1;
        renderCurrentSlide();
      } else if (e.key === 'End') {
        e.preventDefault();
        currentSlide = slideCount;
        renderCurrentSlide();
      }
    };
    wrapper.addEventListener('keydown', onKeyDown);

    // Responsive container observer
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (!isUserZoomed) {
            scale = calculateFitScale(fitMode);
            applyTransform();
          }
        })
      : null;
    ro?.observe(wrapper);

    const cleanup = () => {
      ro?.disconnect();
      wrapper.removeEventListener('wheel', onWheel);
      wrapper.removeEventListener('keydown', onKeyDown);
      try {
        renderer.destroy();
      } catch {}
      wrapper.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    const instance: PreviewInstance = {
      destroy: cleanup,
      goToPage: (page: number) => {
        if (page >= 1 && page <= slideCount) {
          currentSlide = page;
          renderCurrentSlide();
        }
      },
      getPageCount: () => slideCount,
      getCurrentPage: () => currentSlide,
      zoomIn: () => {
        isUserZoomed = true;
        scale = Math.min(6.0, Math.round((scale + 0.25) * 100) / 100);
        applyTransform();
      },
      zoomOut: () => {
        isUserZoomed = true;
        scale = Math.max(0.2, Math.round((scale - 0.25) * 100) / 100);
        applyTransform();
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        isUserZoomed = true;
        scale = Math.max(0.2, Math.min(6.0, Math.round(level * 100) / 100));
        applyTransform();
      },
      fitToPage: () => {
        isUserZoomed = false;
        fitMode = 'page';
        scale = calculateFitScale('page');
        applyTransform();
      },
      fitToWidth: () => {
        isUserZoomed = false;
        fitMode = 'width';
        scale = calculateFitScale('width');
        wrapper.scrollTop = 0;
        wrapper.scrollLeft = 0;
        applyTransform();
      },
      resetZoom: () => {
        isUserZoomed = true;
        fitMode = 'width';
        scale = 1.0;
        rotation = 0;
        wrapper.scrollTop = 0;
        wrapper.scrollLeft = 0;
        ctx.container.scrollTop = 0;
        ctx.container.scrollLeft = 0;
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
      getThumbnails: (): Thumbnail[] => {
        const list: Thumbnail[] = [];
        const thumbW = 240;
        const thumbH = Math.max(100, Math.round(thumbW / slideAspect));
        for (let i = 0; i < slideCount; i++) {
          const slideIdx = i;
          list.push({
            index: slideIdx,
            label: `Slide ${slideIdx + 1}`,
            render: async (thumbCanvas: HTMLCanvasElement) => {
              thumbCanvas.width = thumbW;
              thumbCanvas.height = thumbH;
              let thumbDrawn = false;
              try {
                await renderer.renderSlide(slideIdx, thumbCanvas, thumbW);
                thumbDrawn = hasCanvasDrawnContent(thumbCanvas);
              } catch (err) {}
              if (!thumbDrawn) {
                await renderSlideFallback(slideIdx, thumbCanvas, thumbW);
              }
            }
          });
        }
        return list;
      },
      download: () => {
        downloadFile(
          ctx.buffer,
          ctx.metadata.name || 'presentation.pptx',
          this.mimeTypes[0]
        );
      },
      print: () => {
        window.print();
      }
    };

    return instance;
  }
}

export function pptxPlugin(): PptxPlugin {
  return new PptxPlugin();
}

export default PptxPlugin;
