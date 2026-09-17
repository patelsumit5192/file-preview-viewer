import { EventEmitter } from './events';
import { sourceToArrayBuffer } from './detect';
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
      this.currentBuffer = buffer;
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
        emit: (event, payload) => this.eventEmitter.emit(event, payload),
      });

      this.activeInstance = instance;

      // 8. Setup toolbar with plugin's actions
      if (options.showToolbar !== false && this.toolbar) {
        const actions = matchedPlugin.getToolbarActions(instance);
        this.toolbar.update(actions);
        this.toolbar.show();
      }

      // 9. Setup thumbnails if plugin supports them
      if (instance.getThumbnails && this.thumbnailPanel) {
        const thumbnails = await Promise.resolve(instance.getThumbnails());
        if (thumbnails && thumbnails.length > 0) {
          this.thumbnailPanel.update(thumbnails, (index) => {
            instance.goToPage?.(index + 1);
          });
          if (options.showThumbnails) {
            this.thumbnailPanel.show();
          }
        }
      }

      this.hideLoading();
      this.eventEmitter.emit('loaded', { metadata, plugin: matchedPlugin.id });

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
   * Subscribe to viewer events.
   */
  on(event: string, handler: EventHandler): Unsubscribe {
    return this.eventEmitter.on(event, handler);
  }

  /**
   * Destroy the viewer and clean up all resources.
   */
  destroy(): void {
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
  }

  /**
   * Get the currently active preview instance.
   */
  getInstance(): PreviewInstance | null {
    return this.activeInstance;
  }

  // --- Private methods ---

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
    this.toolbar = new ToolbarController(toolbarEl);
    this.thumbnailPanel = new ThumbnailPanel(thumbnailEl);
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
    errorEl.innerHTML = `
      <div class="fp-error-icon">⚠️</div>
      <div class="fp-error-message">${message}</div>
    `;
    this.contentEl.appendChild(errorEl);
  }
}
