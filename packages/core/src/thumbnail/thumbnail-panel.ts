import { createElement } from '../utils';
import type { Thumbnail } from '../types';
import { ICON_CLOSE } from '../toolbar/icons';

export class ThumbnailPanel {
  private el: HTMLElement;
  private panelEl: HTMLElement;
  private listEl: HTMLElement;
  private headerEl: HTMLElement;
  private thumbnails: Thumbnail[] = [];
  private onSelect?: (index: number) => void;
  private onToggleCallback?: (isOpen: boolean) => void;
  private activeIndex: number = 0;
  private observer?: IntersectionObserver;
  private renderedIndices = new Set<number>();

  constructor(container: HTMLElement, onToggle?: (isOpen: boolean) => void) {
    this.el = container;
    this.onToggleCallback = onToggle;

    this.panelEl = createElement('div', { className: 'fp-thumbnail-panel hidden' });
    this.panelEl.style.width = '0px';
    this.panelEl.style.minWidth = '0px';
    this.panelEl.style.opacity = '0';

    // Header
    this.headerEl = createElement('div', { className: 'fp-thumbnail-header' });
    const title = createElement('span', { className: 'fp-thumbnail-title' }, 'Pages');
    const closeBtn = createElement('button', {
      className: 'fp-thumbnail-close-btn',
      title: 'Close Thumbnails',
      type: 'button'
    }) as HTMLButtonElement;
    closeBtn.innerHTML = ICON_CLOSE;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    this.headerEl.appendChild(title);
    this.headerEl.appendChild(closeBtn);

    // List container
    this.listEl = createElement('div', { className: 'fp-thumbnail-list' });

    this.panelEl.appendChild(this.headerEl);
    this.panelEl.appendChild(this.listEl);
    this.el.appendChild(this.panelEl);
  }

  isOpen(): boolean {
    return !this.panelEl.classList.contains('hidden') && this.panelEl.style.width !== '0px';
  }

  update(thumbnails: Thumbnail[], onSelect: (index: number) => void): void {
    this.thumbnails = thumbnails;
    this.onSelect = onSelect;
    this.renderedIndices.clear();

    const titleEl = this.headerEl.querySelector('.fp-thumbnail-title');
    if (titleEl) {
      titleEl.textContent = `Pages (${thumbnails.length})`;
    }

    this.render();

    if (this.isOpen()) {
      this.renderAllVisible();
    }
  }

  setActive(index: number): void {
    this.activeIndex = index;
    const items = this.listEl.querySelectorAll<HTMLElement>('.fp-thumbnail-item');
    items.forEach((item, i) => {
      if (i === index) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  show(): void {
    this.panelEl.classList.remove('hidden');
    this.panelEl.style.width = '200px';
    this.panelEl.style.minWidth = '200px';
    this.panelEl.style.opacity = '1';
    this.panelEl.style.display = 'flex';
    this.onToggleCallback?.(true);
    this.renderAllVisible();
  }

  hide(): void {
    this.panelEl.classList.add('hidden');
    this.panelEl.style.width = '0px';
    this.panelEl.style.minWidth = '0px';
    this.panelEl.style.opacity = '0';
    this.onToggleCallback?.(false);
  }

  toggle(): void {
    if (this.isOpen()) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
    this.renderedIndices.clear();
    this.el.innerHTML = '';
  }

  renderAllVisible(): void {
    const items = this.listEl.querySelectorAll<HTMLElement>('.fp-thumbnail-item');
    items.forEach((item) => {
      const idx = parseInt(item.dataset.thumbIndex || '-1', 10);
      if (idx >= 0 && !this.renderedIndices.has(idx)) {
        this.renderThumbnailItem(idx, item);
      }
    });
  }

  private renderThumbnailItem(idx: number, itemEl: HTMLElement): void {
    if (this.renderedIndices.has(idx)) return;
    this.renderedIndices.add(idx);
    const canvas = itemEl.querySelector('canvas') as HTMLCanvasElement | null;
    const thumb = this.thumbnails[idx];
    if (canvas && thumb) {
      Promise.resolve(thumb.render(canvas)).catch((err) => {
        console.warn(`[FilePreview] Error rendering thumbnail ${idx}:`, err);
      });
    }
  }

  private render(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.listEl.innerHTML = '';

    const useObserver = typeof IntersectionObserver !== 'undefined';
    if (useObserver) {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const target = entry.target as HTMLElement;
              const idx = parseInt(target.dataset.thumbIndex || '-1', 10);
              if (idx >= 0) {
                this.renderThumbnailItem(idx, target);
              }
            }
          }
        },
        {
          root: this.listEl,
          rootMargin: '120px 0px 120px 0px'
        }
      );
    }

    for (let i = 0; i < this.thumbnails.length; i++) {
      const thumb = this.thumbnails[i];
      const itemEl = createElement('div', {
        className: 'fp-thumbnail-item' + (i === this.activeIndex ? ' active' : '')
      }) as HTMLElement;
      itemEl.dataset.thumbIndex = i.toString();

      itemEl.addEventListener('click', () => {
        this.setActive(i);
        this.onSelect?.(i);
      });

      const canvasWrapper = createElement('div', { className: 'fp-thumbnail-canvas-wrapper' });
      const canvas = createElement('canvas', { width: '130', height: '170' }) as HTMLCanvasElement;
      canvasWrapper.appendChild(canvas);

      const label = createElement('span', { className: 'fp-thumbnail-label' }, thumb.label || `Page ${i + 1}`);

      itemEl.appendChild(canvasWrapper);
      itemEl.appendChild(label);
      this.listEl.appendChild(itemEl);

      if (this.observer) {
        this.observer.observe(itemEl);
      }

      // Eagerly render first 4 items immediately
      if (i < 4) {
        this.renderThumbnailItem(i, itemEl);
      }
    }
  }
}
