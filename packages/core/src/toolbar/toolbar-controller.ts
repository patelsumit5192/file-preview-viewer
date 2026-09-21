import './toolbar.css';
import { createElement, sanitizeSVG } from '../utils';
import type { ToolbarAction, ToolbarGroup, ToolbarConfig } from '../types';
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
  'open-window': icons.ICON_EXTERNAL_WINDOW,
  'external-window': icons.ICON_EXTERNAL_WINDOW,
  'openWindow': icons.ICON_EXTERNAL_WINDOW,
  'openSeparateWindow': icons.ICON_EXTERNAL_WINDOW,
};

export class ToolbarController {
  private el: HTMLElement;
  private toolbarEl: HTMLElement;
  private actions: ToolbarAction[] = [];
  private config: ToolbarConfig = {};
  private pageInputEl: HTMLInputElement | null = null;
  private pageLabelEl: HTMLElement | null = null;
  private prevPageBtn: HTMLButtonElement | null = null;
  private nextPageBtn: HTMLButtonElement | null = null;

  constructor(container: HTMLElement, config?: ToolbarConfig) {
    this.el = container;
    if (config) this.config = { ...config };
    this.toolbarEl = createElement('div', { className: 'fp-toolbar' });
    this.el.appendChild(this.toolbarEl);
  }

  setConfig(config: ToolbarConfig): void {
    this.config = { ...config };
    this.render();
  }

  getConfig(): ToolbarConfig {
    return { ...this.config };
  }

  hideAction(actionId: string): void {
    (this.config as Record<string, any>)[actionId] = false;
    if (actionId === 'zoom-in' || actionId === 'zoomIn') this.config.zoomIn = false;
    if (actionId === 'zoom-out' || actionId === 'zoomOut') this.config.zoomOut = false;
    if (actionId === 'fit-page' || actionId === 'fitPage' || actionId === 'fitToPage' || actionId === 'fit-width') {
      this.config.fitPage = false;
      this.config.fitToPage = false;
      this.config.fitWidth = false;
    }
    if (actionId === 'rotate-cw' || actionId === 'rotate' || actionId === 'rotateCW') this.config.rotate = false;
    if (actionId === 'fullscreen') this.config.fullscreen = false;
    if (actionId === 'download') this.config.download = false;
    if (actionId === 'print') this.config.print = false;
    if (actionId === 'open-window' || actionId === 'openWindow' || actionId === 'openSeparateWindow') {
      this.config.openWindow = false;
      this.config.openSeparateWindow = false;
    }
    if (actionId === 'copy') this.config.copy = false;
    if (actionId === 'page-nav' || actionId === 'pageNav' || actionId === 'pagination') {
      this.config.pageNav = false;
      this.config.pagination = false;
    }
    this.render();
  }

  showAction(actionId: string): void {
    (this.config as Record<string, any>)[actionId] = true;
    if (actionId === 'zoom-in' || actionId === 'zoomIn') this.config.zoomIn = true;
    if (actionId === 'zoom-out' || actionId === 'zoomOut') this.config.zoomOut = true;
    if (actionId === 'fit-page' || actionId === 'fitPage' || actionId === 'fitToPage' || actionId === 'fit-width') {
      this.config.fitPage = true;
      this.config.fitToPage = true;
      this.config.fitWidth = true;
    }
    if (actionId === 'rotate-cw' || actionId === 'rotate' || actionId === 'rotateCW') this.config.rotate = true;
    if (actionId === 'fullscreen') this.config.fullscreen = true;
    if (actionId === 'download') this.config.download = true;
    if (actionId === 'print') this.config.print = true;
    if (actionId === 'open-window' || actionId === 'openWindow' || actionId === 'openSeparateWindow') {
      this.config.openWindow = true;
      this.config.openSeparateWindow = true;
    }
    if (actionId === 'copy') this.config.copy = true;
    if (actionId === 'page-nav' || actionId === 'pageNav' || actionId === 'pagination') {
      this.config.pageNav = true;
      this.config.pagination = true;
    }
    this.render();
  }

  private normalizeActionId(actionId: string): string {
    if (actionId === 'zoomIn') return 'zoom-in';
    if (actionId === 'zoomOut') return 'zoom-out';
    if (actionId === 'fitPage' || actionId === 'fitToPage' || actionId === 'fitWidth') return 'fit-page';
    if (actionId === 'rotateCW') return 'rotate-cw';
    if (actionId === 'rotateCCW') return 'rotate-ccw';
    if (actionId === 'openWindow' || actionId === 'openSeparateWindow') return 'open-window';
    if (actionId === 'pageNav') return 'page-nav';
    return actionId;
  }

  enableAction(actionId: string): void {
    const norm = this.normalizeActionId(actionId);
    const btn = this.toolbarEl.querySelector(`button[data-action-id="${actionId}"], button[data-action-id="${norm}"]`) as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('disabled');
    }
  }

  disableAction(actionId: string): void {
    const norm = this.normalizeActionId(actionId);
    const btn = this.toolbarEl.querySelector(`button[data-action-id="${actionId}"], button[data-action-id="${norm}"]`) as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.classList.add('disabled');
    }
  }

  setActionActive(actionId: string, active: boolean): void {
    const norm = this.normalizeActionId(actionId);
    const btn = this.toolbarEl.querySelector(`button[data-action-id="${actionId}"], button[data-action-id="${norm}"]`) as HTMLButtonElement | null;
    if (btn) {
      if (active) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  isActionEnabled(action: ToolbarAction): boolean {
    const c: Record<string, any> = this.config;
    const id = action.id;

    // Check direct ID or camelCase override
    if (c[id] === false) return false;

    if (id === 'zoom-in' && (c.zoomIn === false || c['zoom-in'] === false)) return false;
    if (id === 'zoom-out' && (c.zoomOut === false || c['zoom-out'] === false)) return false;
    if (
      (id === 'fit-page' || id === 'fit-width' || id === 'fit-slide') &&
      (c.fitPage === false || c.fitToPage === false || c.fitWidth === false || c['fit-page'] === false || c['fit-width'] === false)
    ) {
      return false;
    }
    if (
      (id === 'rotate-cw' || id === 'rotate-ccw' || id === 'rotate') &&
      (c.rotate === false || c.rotateCW === false || c.rotateCCW === false || c['rotate-cw'] === false)
    ) {
      return false;
    }
    if (id === 'fullscreen' && c.fullscreen === false) return false;
    if (id === 'download' && c.download === false) return false;
    if (id === 'print' && c.print === false) return false;
    if (
      (id === 'open-window' || id === 'external-window') &&
      (c.openWindow === false || c.openSeparateWindow === false || c['open-window'] === false)
    ) {
      return false;
    }
    if (id === 'copy' && c.copy === false) return false;
    if (id === 'thumbnails' && c.thumbnails === false) return false;
    if (
      id === 'page-nav' &&
      (c.pageNav === false || c.pagination === false || c['page-nav'] === false)
    ) {
      return false;
    }
    if (
      (id === 'prev' || id === 'page-prev') &&
      (c.prevPage === false || c.prev === false || c['prev'] === false || c.pageNav === false || c.pagination === false)
    ) {
      return false;
    }
    if (
      (id === 'next' || id === 'page-next') &&
      (c.nextPage === false || c.next === false || c['next'] === false || c.pageNav === false || c.pagination === false)
    ) {
      return false;
    }
    if (id === 'play' && c.play === false) return false;
    if (id === 'pause' && c.pause === false) return false;
    if (
      (id === 'fast-forward' || id === 'forward-10') &&
      (c.fastForward === false || c['fast-forward'] === false)
    ) {
      return false;
    }
    if (
      (id === 'rewind' || id === 'replay-10') &&
      (c.rewind === false || c['rewind'] === false)
    ) {
      return false;
    }
    if (id === 'speed' && c.speed === false) return false;

    return true;
  }

  setPage(page: number, max?: number): void {
    if (this.pageInputEl) {
      this.pageInputEl.value = page.toString();
      if (max !== undefined) {
        this.pageInputEl.max = max.toString();
      }
    }
    if (max !== undefined && this.pageLabelEl) {
      this.pageLabelEl.textContent = ` / ${max}`;
    }
    const currentMax = max !== undefined ? max : (parseInt(this.pageInputEl?.max || '1', 10) || 1);
    if (this.prevPageBtn) {
      this.prevPageBtn.disabled = page <= 1;
      this.prevPageBtn.style.opacity = page <= 1 ? '0.4' : '1';
    }
    if (this.nextPageBtn) {
      this.nextPageBtn.disabled = page >= currentMax;
      this.nextPageBtn.style.opacity = page >= currentMax ? '0.4' : '1';
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

    // Filter actions through config
    const enabledActions = this.actions.filter(a => this.isActionEnabled(a));

    // If a page-nav component is present, deduplicate standalone prev/next buttons
    const hasPageNav = enabledActions.some(a => a.type === 'page-nav');
    const effectiveActions = hasPageNav
      ? enabledActions.filter(a => a.id !== 'page-prev' && a.id !== 'page-next' && a.id !== 'prev' && a.id !== 'next')
      : enabledActions;

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
          
          const curVal = action.value ?? 1;
          prevBtn.disabled = curVal <= 1;
          prevBtn.style.opacity = curVal <= 1 ? '0.4' : '1';
          nextBtn.disabled = curVal >= max;
          nextBtn.style.opacity = curVal >= max ? '0.4' : '1';

          this.prevPageBtn = prevBtn;
          this.nextPageBtn = nextBtn;
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
