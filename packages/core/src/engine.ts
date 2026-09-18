import { EventEmitter } from './events';
import { sourceToArrayBuffer } from './detect';
import { downloadFile } from './utils';
import { saveTransferPayload } from './transfer';
import { ToolbarController } from './toolbar/toolbar-controller';
import { ThumbnailPanel } from './thumbnail/thumbnail-panel';
import type {
  FileSource,
  PreviewPlugin,
  PreviewInstance,
  PreviewViewerOptions,
  FileInfo,
  EventHandler,
  Unsubscribe,
  ToolbarConfig,
} from './types';

/**
 * Main file preview viewer engine.
 * Manages plugins, rendering lifecycle, toolbar, and thumbnails.
 */
export class FilePreviewViewer {
  private plugins: PreviewPlugin[] = [];
  private activeInstance: PreviewInstance | null = null;
  private abortController: AbortController | null = null;
  private eventEmitter = new EventEmitter();
  private toolbar: ToolbarController | null = null;
  private thumbnailPanel: ThumbnailPanel | null = null;
  private wrapperEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private currentBuffer: ArrayBuffer | null = null;
  private currentMetadata: import('./types').FileMetadata | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private currentContainer: HTMLElement | null = null;
  private currentOptions: PreviewViewerOptions = {};
  private resizeObserver: ResizeObserver | null = null;
  private fullscreenHandler: (() => void) | null = null;

  /**
   * Register a preview plugin.
   */
  registerPlugin(plugin: PreviewPlugin): this {
    this.plugins.push(plugin);
    // Sort by weight descending (higher weight = higher priority)
    this.plugins.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    return this;
  }

  /**
   * Register multiple plugins at once.
   */
  registerPlugins(plugins: PreviewPlugin[]): this {
    for (const plugin of plugins) {
      this.registerPlugin(plugin);
    }
    return this;
  }

  /**
   * Preview a file in the given container element.
   */
  async preview(
    container: HTMLElement,
    source: FileSource,
    options: PreviewViewerOptions = {}
  ): Promise<PreviewInstance> {
    this.currentOptions = options;

    // 1. Abort any in-flight operation
    this.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    // 2. Destroy existing instance
    this.destroyInstance();

    // 3. Setup wrapper DOM structure
    this.setupDOM(container, options);

    // 4. Emit loading event
    this.eventEmitter.emit('loading', { source });
    this.showLoading();

    try {
      // 5. Normalize source to ArrayBuffer + metadata
      const { buffer, metadata } = await sourceToArrayBuffer(source, signal);
      if (options.metadata) {
        Object.assign(metadata, options.metadata);
      }
      this.currentBuffer = buffer.slice(0);
      this.currentMetadata = metadata;

      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      // 6. Find matching plugin
      const fileInfo: FileInfo = { metadata, buffer };
      const matchedPlugin = await this.findPlugin(fileInfo);

      if (!matchedPlugin) {
        throw new Error(
          `Unsupported file type: ${metadata.extension ?? metadata.mimeType ?? 'unknown'}`
        );
      }

      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      // 7. Clear content area and render
      if (this.contentEl) {
        this.contentEl.innerHTML = '';
      }

      const instance = await matchedPlugin.render({
        container: this.contentEl!,
        source,
        metadata,
        buffer,
        options,
        signal,
        emit: (event, payload) => {
          if (event === 'page-change' && payload && typeof (payload as any).page === 'number') {
            const total = (payload as any).total ?? (payload as any).totalPages;
            this.toolbar?.setPage((payload as any).page, total);
          }
          this.eventEmitter.emit(event, payload);
        },
      });

      this.activeInstance = instance;
      (instance as any).openInSeparateWindow = () => this.openInSeparateWindow();

      // FAST STARTUP: Hide loading immediately once the instance is mounted!
      this.hideLoading();
      this.eventEmitter.emit('loaded', { metadata, plugin: matchedPlugin.id });

      // 8. Setup toolbar with plugin's actions + auto fullscreen and open-window buttons
      const isToolbarVisible = options.showToolbar !== false && options.toolbar !== false;
      if (isToolbarVisible && this.toolbar) {
        const toolbarConfig = this.extractToolbarConfig(options);
        this.toolbar.setConfig(toolbarConfig);
        const actions = matchedPlugin.getToolbarActions(instance);
        const hasFullscreen = actions.some(a => a.id === 'fullscreen');
        if (!hasFullscreen && this.wrapperEl) {
          actions.push({
            id: 'fullscreen',
            icon: 'fullscreen',
            label: 'Fullscreen',
            type: 'button',
            group: 'view',
            execute: () => {
              try {
                if (!document.fullscreenElement) {
                  this.wrapperEl?.requestFullscreen?.();
                  this.wrapperEl?.classList.add('fp-fullscreen-active');
                } else {
                  document.exitFullscreen?.();
                  this.wrapperEl?.classList.remove('fp-fullscreen-active');
                }
              } catch {
                this.wrapperEl?.classList.toggle('fp-fullscreen-active');
              }
              setTimeout(() => {
                this.activeInstance?.fitToPage?.();
              }, 120);
            }
          });
        }

        const openWinAction = actions.find(a => a.id === 'open-window');
        if (openWinAction) {
          if ((options as any)?._isSeparateWindow) {
            const idx = actions.indexOf(openWinAction);
            if (idx !== -1) actions.splice(idx, 1);
          } else {
            openWinAction.execute = () => {
              this.openInSeparateWindow();
            };
          }
        } else if (!(options as any)?._isSeparateWindow) {
          actions.push({
            id: 'open-window',
            icon: 'open-window',
            label: 'Open in Separate Full Window',
            type: 'button',
            group: 'actions',
            execute: () => {
              this.openInSeparateWindow();
            }
          });
        }

        this.toolbar.update(actions);
        this.toolbar.show();
      }

      // 9. Setup thumbnails asynchronously in background so initial preview is instant
      if (instance.getThumbnails && this.thumbnailPanel) {
        Promise.resolve().then(async () => {
          try {
            const thumbnails = await Promise.resolve(instance.getThumbnails!());
            if (thumbnails && thumbnails.length > 0 && this.thumbnailPanel) {
              this.thumbnailPanel.update(thumbnails, (index) => {
                instance.goToPage?.(index + 1);
                this.toolbar?.setPage(index + 1);
              });
              if (options.showThumbnails) {
                this.thumbnailPanel.show();
              }
            }
          } catch (e) {
            console.warn('[FilePreview] Non-critical thumbnail load error:', e);
          }
        });
      }

      return instance;
    } catch (error: unknown) {
      this.hideLoading();
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      this.showError(error instanceof Error ? error.message : 'Failed to preview file');
      this.eventEmitter.emit('error', error);
      throw error;
    }
  }

  /**
   * Opens the current file preview in a separate full browser window.
   */
  openInSeparateWindow(): Window | null {
    if (!this.currentBuffer) {
      console.warn('[FilePreviewViewer] No active file buffer to open in separate window');
      return null;
    }

    if (this.currentOptions.onOpenSeparateWindow) {
      return this.currentOptions.onOpenSeparateWindow({
        buffer: this.currentBuffer,
        metadata: this.currentMetadata || { name: 'Document' },
        options: this.currentOptions
      });
    }

    const transferId = 'fp_win_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    let clonedBuffer: ArrayBuffer;
    try {
      clonedBuffer = this.currentBuffer.slice(0);
    } catch {
      clonedBuffer = this.currentBuffer;
    }
    const payload = {
      buffer: clonedBuffer,
      metadata: this.currentMetadata ? { ...this.currentMetadata } : undefined,
      options: { ...this.currentOptions, _isSeparateWindow: true }
    };

    if (typeof window !== 'undefined') {
      try {
        (window as any)[transferId] = payload;
        (window as any).__lastTransfer = payload;
      } catch {}
    }

    // Persist asynchronously in IndexedDB for cross-window / process-isolated communication
    saveTransferPayload(transferId, payload).catch(err => {
      console.warn('[FilePreviewViewer] Transfer payload save warning:', err);
    });

    let targetUrl: string | null = null;
    if (this.currentOptions.standaloneViewerUrl) {
      const u = new URL(this.currentOptions.standaloneViewerUrl, window.location.href);
      u.searchParams.set('mode', 'fullscreen');
      u.searchParams.set('transferId', transferId);
      targetUrl = u.toString();
    } else if (typeof window !== 'undefined' && window.location?.href && !window.location.href.startsWith('about:')) {
      const u = new URL(window.location.href);
      u.searchParams.set('mode', 'fullscreen');
      u.searchParams.set('transferId', transferId);
      targetUrl = u.toString();
    }

    if (targetUrl) {
      const newWin = window.open(targetUrl, '_blank');
      if (!newWin) {
        alert('Popup blocker prevented opening the preview in a separate window. Please allow popups for this site.');
        return null;
      }
      return newWin;
    }

    // Fallback for about:blank / test environments without origin
    const title = (this.currentMetadata?.name || 'Document Preview') + ' - Full Preview';
    const newWin = window.open('', '_blank');
    if (!newWin) {
      alert('Popup blocker prevented opening the preview in a separate window. Please allow popups for this site.');
      return null;
    }

    newWin.document.title = title;
    newWin.document.body.style.margin = '0';
    newWin.document.body.style.padding = '0';
    newWin.document.body.style.width = '100vw';
    newWin.document.body.style.height = '100vh';
    newWin.document.body.style.overflow = 'hidden';
    newWin.document.body.style.backgroundColor = '#f8fafc';

    // Clone parent stylesheets and style tags
    const headNodes = document.querySelectorAll('link[rel="stylesheet"], style');
    headNodes.forEach(node => {
      newWin.document.head.appendChild(node.cloneNode(true));
    });

    const root = newWin.document.createElement('div');
    root.id = 'full-window-preview-root';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.overflow = 'hidden';
    newWin.document.body.appendChild(root);

    const separateViewer = new FilePreviewViewer();
    for (const plugin of this.plugins) {
      separateViewer.registerPlugin(plugin);
    }

    separateViewer.preview(root, this.currentBuffer.slice(0), {
      ...this.currentOptions,
      showToolbar: true,
      toolbarPosition: 'top',
      metadata: this.currentMetadata || undefined,
      _isSeparateWindow: true
    } as any).catch(err => {
      console.error('[FilePreviewViewer] Error rendering in separate window:', err);
    });

    newWin.addEventListener('beforeunload', () => {
      separateViewer.destroy();
    });

    return newWin;
  }

  /**
   * Subscribe to viewer events.
   */
  on(event: string, handler: EventHandler): Unsubscribe {
    return this.eventEmitter.on(event, handler);
  }

  /**
   * Destroy the viewer and clean up all resources.
   */
  destroy(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.fullscreenHandler) {
      document.removeEventListener('fullscreenchange', this.fullscreenHandler);
      document.removeEventListener('webkitfullscreenchange', this.fullscreenHandler);
      this.fullscreenHandler = null;
    }
    this.abort();
    this.destroyInstance();
    this.toolbar?.destroy();
    this.thumbnailPanel?.destroy();
    this.eventEmitter.emit('destroy', null);
    this.eventEmitter.removeAll();

    if (this.wrapperEl?.parentNode) {
      this.wrapperEl.parentNode.removeChild(this.wrapperEl);
    }
    this.wrapperEl = null;
    this.contentEl = null;
    this.toolbar = null;
    this.thumbnailPanel = null;
    this.currentBuffer = null;
    this.currentMetadata = null;
    this.currentContainer = null;
  }

  /**
   * Get the currently active preview instance.
   */
  getInstance(): PreviewInstance | null {
    return this.activeInstance;
  }

  // --- Toolbar Configuration & Feature Toggles ---

  /**
   * Configure toolbar features dynamically through options or methods.
   * e.g. viewer.setToolbarConfig({ zoomIn: false, print: false })
   */
  setToolbarConfig(config: ToolbarConfig): void {
    this.toolbar?.setConfig(config);
  }

  /**
   * Get current toolbar configuration.
   */
  getToolbarConfig(): ToolbarConfig {
    return this.toolbar?.getConfig() ?? {};
  }

  /**
   * Hide a specific toolbar action by ID or alias (e.g. 'zoom-in', 'print', 'download').
   */
  hideToolbarAction(actionId: string): void {
    this.toolbar?.hideAction(actionId);
  }

  /**
   * Show a specific toolbar action by ID or alias.
   */
  showToolbarAction(actionId: string): void {
    this.toolbar?.showAction(actionId);
  }

  /**
   * Enable a specific toolbar action button.
   */
  enableToolbarAction(actionId: string): void {
    this.toolbar?.enableAction(actionId);
  }

  /**
   * Disable a specific toolbar action button.
   */
  disableToolbarAction(actionId: string): void {
    this.toolbar?.disableAction(actionId);
  }

  // --- Programmatic Toolbar Action Methods ---

  /**
   * Fit document to page so it fills the frame width with minimal margins.
   */
  fitToPage(): void {
    this.activeInstance?.fitToPage?.();
  }

  /**
   * Zoom in.
   */
  zoomIn(): void {
    this.activeInstance?.zoomIn?.();
  }

  /**
   * Zoom out.
   */
  zoomOut(): void {
    this.activeInstance?.zoomOut?.();
  }

  /**
   * Set specific zoom level.
   */
  setZoom(level: number): void {
    this.activeInstance?.setZoom?.(level);
  }

  /**
   * Get current zoom level.
   */
  getZoom(): number {
    return this.activeInstance?.getZoom?.() ?? 1.0;
  }

  /**
   * Rotate 90 degrees clockwise.
   */
  rotateCW(): void {
    this.activeInstance?.rotateCW?.();
  }

  /**
   * Rotate 90 degrees counter-clockwise.
   */
  rotateCCW(): void {
    this.activeInstance?.rotateCCW?.();
  }

  /**
   * Navigate to a specific page number.
   */
  goToPage(page: number): void {
    this.activeInstance?.goToPage?.(page);
    this.toolbar?.setPage(page);
  }

  /**
   * Navigate to next page.
   */
  nextPage(): void {
    const cur = this.getCurrentPage();
    const max = this.getPageCount();
    if (cur < max) {
      this.goToPage(cur + 1);
    }
  }

  /**
   * Navigate to previous page.
   */
  prevPage(): void {
    const cur = this.getCurrentPage();
    if (cur > 1) {
      this.goToPage(cur - 1);
    }
  }

  /**
   * Get total page count.
   */
  getPageCount(): number {
    return this.activeInstance?.getPageCount?.() ?? 1;
  }

  /**
   * Get current page number.
   */
  getCurrentPage(): number {
    return this.activeInstance?.getCurrentPage?.() ?? 1;
  }

  /**
   * Download the current document.
   */
  download(): void {
    this.activeInstance?.download?.();
  }

  /**
   * Print the current document.
   */
  print(): void {
    this.activeInstance?.print?.();
  }

  /**
   * Toggle fullscreen mode.
   */
  toggleFullscreen(): void {
    try {
      if (!document.fullscreenElement) {
        this.wrapperEl?.requestFullscreen?.();
        this.wrapperEl?.classList.add('fp-fullscreen-active');
      } else {
        document.exitFullscreen?.();
        this.wrapperEl?.classList.remove('fp-fullscreen-active');
      }
    } catch {
      this.wrapperEl?.classList.toggle('fp-fullscreen-active');
    }
    setTimeout(() => {
      this.activeInstance?.fitToPage?.();
    }, 120);
  }

  /**
   * Toggle thumbnails sidebar panel.
   */
  toggleThumbnails(): void {
    this.thumbnailPanel?.toggle();
  }

  // --- Private methods ---

  private extractToolbarConfig(options?: PreviewViewerOptions): ToolbarConfig {
    if (!options) return {};
    const nested = typeof options.toolbar === 'object' ? options.toolbar : {};
    return {
      ...options,
      ...nested
    };
  }

  private abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private destroyInstance(): void {
    if (this.activeInstance) {
      this.activeInstance.destroy();
      this.activeInstance = null;
    }
  }

  private async findPlugin(fileInfo: FileInfo): Promise<PreviewPlugin | null> {
    for (const plugin of this.plugins) {
      const result = plugin.supports(fileInfo);
      const supports = result instanceof Promise ? await result : result;
      if (supports) return plugin;
    }
    return null;
  }

  private setupDOM(container: HTMLElement, options: PreviewViewerOptions): void {
    this.currentContainer = container;
    this.currentOptions = options;

    // Only setup once, or re-setup if container changed
    if (this.wrapperEl?.parentNode === container) return;

    // Clean up old wrapper
    if (this.wrapperEl?.parentNode) {
      this.wrapperEl.parentNode.removeChild(this.wrapperEl);
    }

    // Create wrapper structure
    const themeClass = options.theme === 'dark' ? 'fp-theme-dark' : '';
    const toolbarPos = options.toolbarPosition ?? 'top';

    this.wrapperEl = document.createElement('div');
    this.wrapperEl.className = `fp-viewer ${themeClass} ${options.className ?? ''}`.trim();
    this.wrapperEl.tabIndex = 0; // allow keyboard focus

    // Toolbar container
    const toolbarEl = document.createElement('div');
    toolbarEl.className = 'fp-toolbar-container';

    // Content area (where the plugin renders)
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'fp-content';

    // Thumbnail panel
    const thumbnailEl = document.createElement('div');
    thumbnailEl.className = 'fp-thumbnail-container';

    // Assemble
    const bodyEl = document.createElement('div');
    bodyEl.className = 'fp-body';
    bodyEl.appendChild(thumbnailEl);
    bodyEl.appendChild(this.contentEl);

    if (toolbarPos === 'top') {
      this.wrapperEl.appendChild(toolbarEl);
      this.wrapperEl.appendChild(bodyEl);
    } else {
      this.wrapperEl.appendChild(bodyEl);
      this.wrapperEl.appendChild(toolbarEl);
    }

    container.innerHTML = '';
    container.appendChild(this.wrapperEl);

    // Initialize toolbar and thumbnail controllers
    const initialToolbarConfig = this.extractToolbarConfig(options);
    this.toolbar = new ToolbarController(toolbarEl, initialToolbarConfig);
    this.thumbnailPanel = new ThumbnailPanel(thumbnailEl);

    // Enable keyboard shortcuts & drag/drop
    this.setupKeyboardShortcuts();
    this.setupDragAndDrop(container, options);
    this.setupResizeAndFullscreenListeners();
  }

  private setupResizeAndFullscreenListeners(): void {
    if (this.fullscreenHandler) return;

    this.fullscreenHandler = () => {
      setTimeout(() => {
        this.activeInstance?.fitToPage?.();
      }, 100);
    };

    document.addEventListener('fullscreenchange', this.fullscreenHandler);
    document.addEventListener('webkitfullscreenchange', this.fullscreenHandler);

    if (typeof ResizeObserver !== 'undefined' && this.contentEl) {
      this.resizeObserver = new ResizeObserver(() => {
        // Auto-fit content when viewport dimensions resize
        if (this.activeInstance && (!this.activeInstance.getZoom || Math.abs((this.activeInstance.getZoom?.() ?? 1) - 1.0) < 0.05)) {
          this.activeInstance.fitToPage?.();
        }
      });
      this.resizeObserver.observe(this.contentEl);
    }
  }

  private setupKeyboardShortcuts(): void {
    if (this.keyHandler) return;

    this.keyHandler = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form controls
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (!this.activeInstance) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        const cur = this.activeInstance.getCurrentPage?.() ?? 1;
        this.activeInstance.goToPage?.(cur + 1);
        const nextCur = this.activeInstance.getCurrentPage?.() ?? (cur + 1);
        this.toolbar?.setPage(nextCur);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        const cur = this.activeInstance.getCurrentPage?.() ?? 1;
        this.activeInstance.goToPage?.(Math.max(1, cur - 1));
        const prevCur = this.activeInstance.getCurrentPage?.() ?? Math.max(1, cur - 1);
        this.toolbar?.setPage(prevCur);
      } else if (e.key === '+' || e.key === '=') {
        this.activeInstance.zoomIn?.();
      } else if (e.key === '-' || e.key === '_') {
        this.activeInstance.zoomOut?.();
      } else if (e.key === '0') {
        this.activeInstance.fitToPage?.();
      } else if (e.key === 'r' || e.key === 'R') {
        this.activeInstance.rotateCW?.();
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          this.wrapperEl?.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      }
    };

    window.addEventListener('keydown', this.keyHandler);
  }

  private setupDragAndDrop(container: HTMLElement, options: PreviewViewerOptions): void {
    if (!this.wrapperEl) return;

    this.wrapperEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.wrapperEl?.classList.add('fp-dragover');
    });

    this.wrapperEl.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null || !this.wrapperEl?.contains(e.relatedTarget as Node)) {
        this.wrapperEl?.classList.remove('fp-dragover');
      }
    });

    this.wrapperEl.addEventListener('drop', (e) => {
      e.preventDefault();
      this.wrapperEl?.classList.remove('fp-dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        this.preview(container, file, options);
      }
    });
  }

  private showLoading(): void {
    if (!this.contentEl) return;
    const loader = document.createElement('div');
    loader.className = 'fp-loading';
    loader.innerHTML = '<div class="fp-spinner"></div><span>Loading preview...</span>';
    this.contentEl.appendChild(loader);
  }

  private hideLoading(): void {
    if (!this.contentEl) return;
    const loader = this.contentEl.querySelector('.fp-loading');
    if (loader) loader.remove();
  }

  private showError(message: string): void {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = '';
    const errorEl = document.createElement('div');
    errorEl.className = 'fp-error';
    errorEl.style.display = 'flex';
    errorEl.style.flexDirection = 'column';
    errorEl.style.alignItems = 'center';
    errorEl.style.justifyContent = 'center';
    errorEl.style.padding = '32px';
    errorEl.style.textAlign = 'center';

    const hasDownload = !!(this.currentBuffer && this.currentMetadata);

    errorEl.innerHTML = `
      <div class="fp-error-icon" style="font-size:36px;margin-bottom:8px;">⚠️</div>
      <div class="fp-error-message" style="font-size:16px;font-weight:600;margin-bottom:6px;">Cannot preview file</div>
      <div class="fp-error-sub" style="font-size:13px;color:#64748b;max-width:420px;line-height:1.5;margin-bottom:16px;">${message}</div>
      ${hasDownload ? '<button class="fp-error-download-btn" style="padding:8px 16px;background:#3b82f6;color:#ffffff;border:none;border-radius:6px;cursor:pointer;font-weight:500;font-size:13px;transition:background 0.2s;">Download Original File</button>' : ''}
    `;

    if (hasDownload && this.currentBuffer) {
      const btn = errorEl.querySelector('.fp-error-download-btn') as HTMLButtonElement;
      if (btn) {
        btn.addEventListener('click', () => {
          downloadFile(this.currentBuffer!, this.currentMetadata?.name || 'download', this.currentMetadata?.mimeType);
        });
      }
    }

    this.contentEl.appendChild(errorEl);
  }
}
