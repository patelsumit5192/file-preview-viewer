import { createElement } from '../utils';
import type { Thumbnail } from '../types';

export class ThumbnailPanel {
  private el: HTMLElement;
  private panelEl: HTMLElement;
  private thumbnails: Thumbnail[] = [];
  private onSelect?: (index: number) => void;
  private activeIndex: number = 0;

  constructor(container: HTMLElement) {
    this.el = container;
    this.panelEl = createElement('div', { className: 'fp-thumbnail-panel hidden' });
    this.el.appendChild(this.panelEl);
  }

  update(thumbnails: Thumbnail[], onSelect: (index: number) => void): void {
    this.thumbnails = thumbnails;
    this.onSelect = onSelect;
    this.render();
  }

  setActive(index: number): void {
    this.activeIndex = index;
    const items = this.panelEl.querySelectorAll('.fp-thumbnail-item');
    items.forEach((item, i) => {
      if (i === index) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  show(): void {
    this.panelEl.classList.remove('hidden');
  }

  hide(): void {
    this.panelEl.classList.add('hidden');
  }

  toggle(): void {
    this.panelEl.classList.toggle('hidden');
  }

  destroy(): void {
    this.el.innerHTML = '';
  }

  private async render(): Promise<void> {
    this.panelEl.innerHTML = '';

    for (let i = 0; i < this.thumbnails.length; i++) {
      const thumb = this.thumbnails[i];
      const itemEl = createElement('div', { className: 'fp-thumbnail-item' });
      if (i === this.activeIndex) {
        itemEl.classList.add('active');
      }

      itemEl.addEventListener('click', () => {
        this.setActive(i);
        this.onSelect?.(i);
      });

      const canvas = createElement('canvas', { width: '150', height: '200' }) as HTMLCanvasElement;
      const label = createElement('span', { className: 'fp-thumbnail-label' }, thumb.label);

      itemEl.appendChild(canvas);
      itemEl.appendChild(label);
      this.panelEl.appendChild(itemEl);

      try {
        await thumb.render(canvas);
      } catch (err) {
        console.error(`[FilePreview] Error rendering thumbnail ${i}:`, err);
      }
    }
  }
}
