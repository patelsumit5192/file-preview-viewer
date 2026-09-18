import './toolbar.css';
import { createElement, sanitizeSVG } from '../utils';
import type { ToolbarAction, ToolbarGroup } from '../types';
import * as icons from './icons';

const ICON_MAP: Record<string, string> = {
  'zoom-in': icons.ICON_ZOOM_IN,
  'zoom-out': icons.ICON_ZOOM_OUT,
  'fit-page': icons.ICON_FIT_PAGE,
  'fit-width': icons.ICON_FIT_WIDTH,
  'fit-slide': icons.ICON_FIT_PAGE,
  'rotate-cw': icons.ICON_ROTATE_CW,
  'rotate-ccw': icons.ICON_ROTATE_CCW,
  'download': icons.ICON_DOWNLOAD,
  'print': icons.ICON_PRINT,
  'thumbnails': icons.ICON_THUMBNAILS,
  'fullscreen': icons.ICON_FULLSCREEN,
  'play': icons.ICON_PLAY,
  'pause': icons.ICON_PAUSE,
  'close': icons.ICON_CLOSE,
  'copy': icons.ICON_COPY,
  'prev': icons.ICON_PAGE_PREV,
  'next': icons.ICON_PAGE_NEXT,
  'page-prev': icons.ICON_PAGE_PREV,
  'page-next': icons.ICON_PAGE_NEXT,
  'chevron-left': icons.ICON_PAGE_PREV,
  'chevron-right': icons.ICON_PAGE_NEXT,
  'fast-forward': icons.ICON_FAST_FORWARD,
  'forward-10': icons.ICON_FAST_FORWARD,
  'rewind': icons.ICON_REWIND,
  'replay-10': icons.ICON_REWIND,
  'speed': icons.ICON_SPEED,
  'open-window': icons.ICON_EXTERNAL_WINDOW,
  'external-window': icons.ICON_EXTERNAL_WINDOW,
};

export class ToolbarController {
  private el: HTMLElement;
  private toolbarEl: HTMLElement;
  private actions: ToolbarAction[] = [];
  private pageInputEl: HTMLInputElement | null = null;
  private pageLabelEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.el = container;
    this.toolbarEl = createElement('div', { className: 'fp-toolbar' });
    this.el.appendChild(this.toolbarEl);
  }

  setPage(page: number, max?: number): void {
    if (this.pageInputEl) {
      this.pageInputEl.value = page.toString();
    }
    if (max !== undefined && this.pageLabelEl) {
      this.pageLabelEl.textContent = ` / ${max}`;
    }
  }

  update(actions: ToolbarAction[]): void {
    this.actions = actions;
    this.render();
  }

  show(): void {
    this.el.style.display = 'block';
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  destroy(): void {
    this.el.innerHTML = '';
  }

  private render(): void {
    this.toolbarEl.innerHTML = '';

    const groups: Record<ToolbarGroup, ToolbarAction[]> = {
      navigation: [],
      zoom: [],
      view: [],
      actions: []
    };

    // If a page-nav component is present, deduplicate standalone prev/next buttons
    const hasPageNav = this.actions.some(a => a.type === 'page-nav');
    const effectiveActions = hasPageNav
      ? this.actions.filter(a => a.id !== 'page-prev' && a.id !== 'page-next' && a.id !== 'prev' && a.id !== 'next')
      : this.actions;

    for (const action of effectiveActions) {
      if (groups[action.group]) {
        groups[action.group].push(action);
      }
    }

    const order: ToolbarGroup[] = ['navigation', 'zoom', 'view', 'actions'];
    let isFirstGroup = true;

    for (const group of order) {
      const groupActions = groups[group];
      if (groupActions.length === 0) continue;

      if (!isFirstGroup) {
        this.toolbarEl.appendChild(createElement('div', { className: 'fp-toolbar-separator' }));
      }
      isFirstGroup = false;

      const groupEl = createElement('div', { className: 'fp-toolbar-group' });

      for (const action of groupActions) {
        if (action.type === 'separator') {
          groupEl.appendChild(createElement('div', { className: 'fp-toolbar-separator' }));
        } else if (action.type === 'page-nav') {
          const max = action.max ?? 1;
          const prevBtn = this.createButton(
            'prev', icons.ICON_PAGE_PREV, 'Previous Page',
            () => {
              const cur = parseInt(input.value, 10) || 1;
              if (cur > 1) {
                input.value = (cur - 1).toString();
                action.execute('prev', cur - 1);
              }
            }
          );
          const nextBtn = this.createButton(
            'next', icons.ICON_PAGE_NEXT, 'Next Page',
            () => {
              const cur = parseInt(input.value, 10) || 1;
              if (cur < max) {
                input.value = (cur + 1).toString();
                action.execute('next', cur + 1);
              }
            }
          );
          const input = createElement('input', {
            className: 'fp-toolbar-input',
            type: 'number',
            value: (action.value ?? 1).toString(),
            min: '1',
            max: max.toString()
          }) as HTMLInputElement;
          
          input.addEventListener('change', () => {
            let val = parseInt(input.value, 10);
            if (isNaN(val)) val = 1;
            val = Math.max(1, Math.min(max, val));
            input.value = val.toString();
            action.execute('go', val);
          });
          
          const label = createElement('span', { className: 'fp-toolbar-label' }, ` / ${max}`);
          
          this.pageInputEl = input;
          this.pageLabelEl = label;

          groupEl.appendChild(prevBtn);
          groupEl.appendChild(input);
          groupEl.appendChild(label);
          groupEl.appendChild(nextBtn);
        } else if (action.type === 'range') {
          const input = createElement('input', {
            type: 'range',
            min: (action.min ?? 0).toString(),
            max: (action.max ?? 100).toString(),
            step: (action.step ?? 1).toString(),
            value: (action.value ?? 50).toString()
          }) as HTMLInputElement;
          input.addEventListener('input', () => {
            action.execute(parseFloat(input.value));
          });
          groupEl.appendChild(input);
        } else {
          const btn = this.createButton(
            action.id, action.icon, action.label,
            () => action.execute()
          );
          if (action.enabled === false) btn.disabled = true;
          if (action.active) btn.classList.add('active');
          groupEl.appendChild(btn);
        }
      }

      this.toolbarEl.appendChild(groupEl);
    }
  }

  private createButton(id: string, iconHtml: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = createElement('button', {
      className: 'fp-toolbar-btn',
      title,
      type: 'button',
      'data-action-id': id
    }) as HTMLButtonElement;
    
    const internalSvg = ICON_MAP[iconHtml] || ICON_MAP[id];
    if (internalSvg) {
      btn.innerHTML = internalSvg;
    } else if (iconHtml && iconHtml.startsWith('<svg')) {
      btn.innerHTML = sanitizeSVG(iconHtml);
    } else {
      btn.textContent = title || id; 
    }
    
    btn.addEventListener('click', onClick);
    return btn;
  }
}
