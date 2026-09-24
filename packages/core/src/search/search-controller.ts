import * as icons from '../toolbar/icons';
import type { PreviewInstance } from '../types';

export interface SearchOptions {
  caseSensitive?: boolean;
}

export interface SearchResult {
  total: number;
  current: number;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Controller for in-document Search / Find functionality.
 * Supports universal DOM highlighting, multi-page plugin delegation, and match navigation.
 */
export class SearchController {
  private parentContainer: HTMLElement;
  private contentEl: HTMLElement | null = null;
  private activeInstance: PreviewInstance | null = null;

  private barEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private countEl: HTMLElement | null = null;
  private prevBtn: HTMLButtonElement | null = null;
  private nextBtn: HTMLButtonElement | null = null;
  private caseBtn: HTMLButtonElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;

  private isOpen = false;
  private caseSensitive = false;
  private currentQuery = '';
  private matches: HTMLElement[] = [];
  private currentIndex = -1;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange?: (isOpen: boolean) => void;

  constructor(
    parentContainer: HTMLElement,
    options?: {
      contentEl?: HTMLElement;
      instance?: PreviewInstance | null;
      onStateChange?: (isOpen: boolean) => void;
    }
  ) {
    this.parentContainer = parentContainer;
    this.contentEl = options?.contentEl ?? null;
    this.activeInstance = options?.instance ?? null;
    this.onStateChange = options?.onStateChange;
  }

  setContentEl(contentEl: HTMLElement | null): void {
    this.contentEl = contentEl;
    if (this.isOpen && this.currentQuery) {
      this.search(this.currentQuery, { caseSensitive: this.caseSensitive });
    }
  }

  setInstance(instance: PreviewInstance | null): void {
    this.activeInstance = instance;
    this.clear();
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  open(): void {
    // If current file preview explicitly declares search is unsupported (e.g. Media, 3D)
    if (this.activeInstance && this.activeInstance.isSearchable === false) {
      this.showToast('Search is not supported for this file type');
      return;
    }

    if (!this.barEl) {
      this.buildUI();
    }

    if (!this.barEl || !this.barEl.parentNode) {
      this.parentContainer.appendChild(this.barEl!);
    }

    this.barEl!.style.display = 'flex';
    this.isOpen = true;
    this.onStateChange?.(true);

    if (this.inputEl) {
      this.inputEl.focus();
      this.inputEl.select();
      if (this.inputEl.value) {
        this.search(this.inputEl.value, { caseSensitive: this.caseSensitive });
      }
    }
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.barEl) {
      this.barEl.style.display = 'none';
    }
    this.clear();
    this.onStateChange?.(false);
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    this.currentQuery = query;
    if (options?.caseSensitive !== undefined) {
      this.caseSensitive = options.caseSensitive;
      this.updateCaseBtn();
    }

    // Check if active instance implements custom search (e.g. PDF multi-page or Excel multi-sheet)
    if (this.activeInstance && typeof this.activeInstance.search === 'function') {
      try {
        const res = await Promise.resolve(
          this.activeInstance.search(query, { caseSensitive: this.caseSensitive })
        );
        this.updateCount(res.current, res.total);
        return res;
      } catch (err) {
        console.warn('[SearchController] Instance search error, falling back to DOM search:', err);
      }
    }

    // Universal DOM search
    return this.performDomSearch(query);
  }

  async next(): Promise<void> {
    if (this.activeInstance && typeof this.activeInstance.searchNext === 'function') {
      try {
        const res: any = await Promise.resolve(this.activeInstance.searchNext());
        if (res && typeof res.total === 'number') {
          this.updateCount(res.current, res.total);
        }
        return;
      } catch (err) {
        console.warn('[SearchController] Instance searchNext error:', err);
      }
    }

    if (this.matches.length === 0) return;
    this.navigate(1);
  }

  async prev(): Promise<void> {
    if (this.activeInstance && typeof this.activeInstance.searchPrev === 'function') {
      try {
        const res: any = await Promise.resolve(this.activeInstance.searchPrev());
        if (res && typeof res.total === 'number') {
          this.updateCount(res.current, res.total);
        }
        return;
      } catch (err) {
        console.warn('[SearchController] Instance searchPrev error:', err);
      }
    }

    if (this.matches.length === 0) return;
    this.navigate(-1);
  }

  clear(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.activeInstance && typeof this.activeInstance.clearSearch === 'function') {
      try {
        this.activeInstance.clearSearch();
      } catch (err) {
        console.warn('[SearchController] Instance clearSearch error:', err);
      }
    }

    this.clearHighlights();
    this.currentQuery = '';
    this.matches = [];
    this.currentIndex = -1;
    this.updateCount(0, 0);
  }

  destroy(): void {
    this.clear();
    if (this.barEl?.parentNode) {
      this.barEl.parentNode.removeChild(this.barEl);
    }
    this.barEl = null;
    this.inputEl = null;
    this.countEl = null;
    this.prevBtn = null;
    this.nextBtn = null;
    this.caseBtn = null;
    this.closeBtn = null;
  }

  showToast(message: string): void {
    const existing = this.parentContainer.querySelector('.fp-search-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'fp-search-toast';
    toast.textContent = message;
    this.parentContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2400);
  }

  // --- Private DOM search & highlight implementation ---

  private performDomSearch(query: string): SearchResult {
    this.clearHighlights();

    const trimmed = query.trim();
    if (!trimmed || !this.contentEl) {
      this.updateCount(0, 0);
      return { total: 0, current: 0 };
    }

    // Identify all search root nodes: contentEl and any accessible child iframes
    const searchRoots: (HTMLElement | Document)[] = [this.contentEl];
    const iframes = this.contentEl.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      try {
        if (iframe.contentDocument && iframe.contentDocument.body) {
          searchRoots.push(iframe.contentDocument.body);
        }
      } catch {}
    });

    const marks: HTMLElement[] = [];
    const re = new RegExp(escapeRegex(trimmed), this.caseSensitive ? 'g' : 'gi');

    for (const root of searchRoots) {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node: Node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (
              parent.closest('.fp-search-bar') ||
              parent.closest('.fp-search-toast') ||
              parent.closest('.fp-thumbnail-container') ||
              parent.tagName === 'SCRIPT' ||
              parent.tagName === 'STYLE' ||
              parent.tagName === 'NOSCRIPT'
            ) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      const textNodes: Text[] = [];
      let currentNode = walker.nextNode();
      while (currentNode) {
        textNodes.push(currentNode as Text);
        currentNode = walker.nextNode();
      }

      for (const textNode of textNodes) {
        const val = textNode.nodeValue || '';
        re.lastIndex = 0;
        const matchesInNode: Array<{ start: number; end: number }> = [];
        let match: RegExpExecArray | null;

        while ((match = re.exec(val)) !== null) {
          matchesInNode.push({
            start: match.index,
            end: match.index + match[0].length,
          });
        }

        if (matchesInNode.length > 0) {
          const nodeMarks: HTMLElement[] = [];
          // Right-to-left splitText prevents offset invalidation
          for (let i = matchesInNode.length - 1; i >= 0; i--) {
            const { start, end } = matchesInNode[i];
            const afterMatch = textNode.splitText(end);
            void afterMatch;
            const matchTarget = textNode.splitText(start);

            const mark = document.createElement('mark');
            mark.className = 'fp-search-match';
            mark.textContent = matchTarget.textContent;
            matchTarget.parentNode?.replaceChild(mark, matchTarget);
            nodeMarks.unshift(mark);
          }
          marks.push(...nodeMarks);
        }
      }
    }

    this.matches = marks;
    const total = marks.length;

    if (total > 0) {
      this.currentIndex = 0;
      marks[0].classList.add('fp-search-match-active');
      marks[0].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
      this.updateCount(1, total);
      return { total, current: 1 };
    } else {
      this.currentIndex = -1;
      this.updateCount(0, 0);
      return { total: 0, current: 0 };
    }
  }

  private navigate(delta: number): void {
    if (this.matches.length === 0) return;

    if (this.currentIndex >= 0 && this.currentIndex < this.matches.length) {
      this.matches[this.currentIndex].classList.remove('fp-search-match-active');
    }

    this.currentIndex = (this.currentIndex + delta + this.matches.length) % this.matches.length;

    const activeEl = this.matches[this.currentIndex];
    if (activeEl) {
      activeEl.classList.add('fp-search-match-active');
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
      this.updateCount(this.currentIndex + 1, this.matches.length);
    }
  }

  private clearHighlights(): void {
    if (!this.contentEl) return;
    const searchRoots: (HTMLElement | Document)[] = [this.contentEl];
    const iframes = this.contentEl.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      try {
        if (iframe.contentDocument && iframe.contentDocument.body) {
          searchRoots.push(iframe.contentDocument.body);
        }
      } catch {}
    });

    for (const root of searchRoots) {
      const marks = root.querySelectorAll('mark.fp-search-match');
      const parents = new Set<Node>();
      marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parents.add(parent);
          while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
          }
          parent.removeChild(mark);
        }
      });
      parents.forEach((p) => p.normalize());
    }
  }

  private updateCount(current: number, total: number): void {
    if (!this.countEl) return;
    if (total === 0) {
      if (this.currentQuery.trim()) {
        this.countEl.textContent = 'No matches';
        this.countEl.classList.add('fp-search-no-match');
      } else {
        this.countEl.textContent = '';
        this.countEl.classList.remove('fp-search-no-match');
      }
      if (this.prevBtn) this.prevBtn.disabled = true;
      if (this.nextBtn) this.nextBtn.disabled = true;
    } else {
      this.countEl.textContent = `${current} of ${total}`;
      this.countEl.classList.remove('fp-search-no-match');
      if (this.prevBtn) this.prevBtn.disabled = false;
      if (this.nextBtn) this.nextBtn.disabled = false;
    }
  }

  private updateCaseBtn(): void {
    if (this.caseBtn) {
      if (this.caseSensitive) {
        this.caseBtn.classList.add('active');
      } else {
        this.caseBtn.classList.remove('active');
      }
    }
  }

  private buildUI(): void {
    const bar = document.createElement('div');
    bar.className = 'fp-search-bar';

    const searchIconSpan = document.createElement('span');
    searchIconSpan.className = 'fp-search-icon';
    searchIconSpan.innerHTML = icons.ICON_SEARCH;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fp-search-input';
    input.placeholder = 'Find in document...';
    this.inputEl = input;

    const count = document.createElement('span');
    count.className = 'fp-search-count';
    this.countEl = count;

    const divider1 = document.createElement('span');
    divider1.className = 'fp-search-divider';

    const caseBtn = document.createElement('button');
    caseBtn.type = 'button';
    caseBtn.className = 'fp-search-btn';
    caseBtn.title = 'Match Case';
    caseBtn.textContent = 'Aa';
    this.caseBtn = caseBtn;

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'fp-search-btn';
    prevBtn.title = 'Previous match (Shift+Enter)';
    prevBtn.innerHTML = icons.ICON_CHEVRON_UP;
    prevBtn.disabled = true;
    this.prevBtn = prevBtn;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'fp-search-btn';
    nextBtn.title = 'Next match (Enter)';
    nextBtn.innerHTML = icons.ICON_CHEVRON_DOWN;
    nextBtn.disabled = true;
    this.nextBtn = nextBtn;

    const divider2 = document.createElement('span');
    divider2.className = 'fp-search-divider';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'fp-search-btn';
    closeBtn.title = 'Close (Esc)';
    closeBtn.innerHTML = icons.ICON_CLOSE;
    this.closeBtn = closeBtn;

    bar.appendChild(searchIconSpan);
    bar.appendChild(input);
    bar.appendChild(count);
    bar.appendChild(divider1);
    bar.appendChild(caseBtn);
    bar.appendChild(prevBtn);
    bar.appendChild(nextBtn);
    bar.appendChild(divider2);
    bar.appendChild(closeBtn);

    // Event listeners
    input.addEventListener('input', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.search(input.value, { caseSensitive: this.caseSensitive });
      }, 150);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.prev();
        } else {
          this.next();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });

    caseBtn.addEventListener('click', () => {
      this.caseSensitive = !this.caseSensitive;
      this.updateCaseBtn();
      if (input.value) {
        this.search(input.value, { caseSensitive: this.caseSensitive });
      }
    });

    prevBtn.addEventListener('click', () => this.prev());
    nextBtn.addEventListener('click', () => this.next());
    closeBtn.addEventListener('click', () => this.close());

    this.barEl = bar;
  }
}
