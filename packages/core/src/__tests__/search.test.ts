// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchController } from '../search/search-controller';
import { FilePreviewViewer } from '../engine';
import type { PreviewPlugin, PreviewInstance } from '../types';

describe('SearchController and In-Document Search', () => {
  let parentContainer: HTMLElement;
  let contentEl: HTMLElement;

  beforeEach(() => {
    parentContainer = document.createElement('div');
    contentEl = document.createElement('div');
    parentContainer.appendChild(contentEl);
    document.body.appendChild(parentContainer);
  });

  it('should initialize and open/close search bar UI', () => {
    const onStateChange = vi.fn();
    const controller = new SearchController(parentContainer, {
      contentEl,
      onStateChange,
    });

    expect(controller.getIsOpen()).toBe(false);

    controller.open();
    expect(controller.getIsOpen()).toBe(true);
    expect(onStateChange).toHaveBeenCalledWith(true);

    const searchBar = parentContainer.querySelector('.fp-search-bar');
    expect(searchBar).not.toBeNull();

    controller.close();
    expect(controller.getIsOpen()).toBe(false);
    expect(onStateChange).toHaveBeenCalledWith(false);

    controller.toggle();
    expect(controller.getIsOpen()).toBe(true);

    controller.destroy();
  });

  it('should perform universal DOM search and highlight matches', async () => {
    contentEl.innerHTML = `
      <div class="paragraph">The quick brown fox jumps over the lazy dog.</div>
      <div class="paragraph">Another dog is barking at another fox.</div>
    `;

    const controller = new SearchController(parentContainer, { contentEl });
    controller.open();

    const res = await controller.search('fox');
    expect(res.total).toBe(2);
    expect(res.current).toBe(1);

    const marks = contentEl.querySelectorAll('mark.fp-search-match');
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe('fox');
    expect(marks[1].textContent).toBe('fox');

    // First match should have active class
    expect(marks[0].classList.contains('fp-search-match-active')).toBe(true);
    expect(marks[1].classList.contains('fp-search-match-active')).toBe(false);

    // Navigate to next
    await controller.next();
    expect(marks[0].classList.contains('fp-search-match-active')).toBe(false);
    expect(marks[1].classList.contains('fp-search-match-active')).toBe(true);

    // Navigate to prev (wraps back to 1)
    await controller.prev();
    expect(marks[0].classList.contains('fp-search-match-active')).toBe(true);
    expect(marks[1].classList.contains('fp-search-match-active')).toBe(false);

    // Clear highlights
    controller.clear();
    const clearedMarks = contentEl.querySelectorAll('mark.fp-search-match');
    expect(clearedMarks.length).toBe(0);
    expect(contentEl.textContent).toContain('The quick brown fox jumps over the lazy dog.');

    controller.destroy();
  });

  it('should support case-sensitive search', async () => {
    contentEl.innerHTML = `<div>TypeScript and typescript and TYPESCRIPT</div>`;

    const controller = new SearchController(parentContainer, { contentEl });
    controller.open();

    // Case-insensitive (default)
    const insensitiveRes = await controller.search('typescript', { caseSensitive: false });
    expect(insensitiveRes.total).toBe(3);

    // Case-sensitive
    const sensitiveRes = await controller.search('TypeScript', { caseSensitive: true });
    expect(sensitiveRes.total).toBe(1);

    const mark = contentEl.querySelector('mark.fp-search-match');
    expect(mark?.textContent).toBe('TypeScript');

    controller.destroy();
  });

  it('should delegate to plugin instance custom search methods when available', async () => {
    const searchSpy = vi.fn().mockReturnValue({ total: 5, current: 1 });
    const nextSpy = vi.fn().mockReturnValue({ total: 5, current: 2 });
    const prevSpy = vi.fn().mockReturnValue({ total: 5, current: 5 });
    const clearSpy = vi.fn();

    const mockInstance: PreviewInstance = {
      destroy: vi.fn(),
      search: searchSpy,
      searchNext: nextSpy,
      searchPrev: prevSpy,
      clearSearch: clearSpy,
      isSearchable: true,
    };

    const controller = new SearchController(parentContainer, {
      contentEl,
      instance: mockInstance,
    });
    controller.open();

    const res = await controller.search('multi-page-query');
    expect(searchSpy).toHaveBeenCalledWith('multi-page-query', { caseSensitive: false });
    expect(res.total).toBe(5);
    expect(res.current).toBe(1);

    await controller.next();
    expect(nextSpy).toHaveBeenCalled();

    await controller.prev();
    expect(prevSpy).toHaveBeenCalled();

    controller.clear();
    expect(clearSpy).toHaveBeenCalled();

    controller.destroy();
  });

  it('should show toast when search is invoked on non-searchable document', () => {
    const nonSearchableInstance: PreviewInstance = {
      destroy: vi.fn(),
      isSearchable: false,
    };

    const controller = new SearchController(parentContainer, {
      contentEl,
      instance: nonSearchableInstance,
    });

    controller.open();
    // Search bar should NOT open
    expect(controller.getIsOpen()).toBe(false);

    // Toast element should appear
    const toast = parentContainer.querySelector('.fp-search-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBe('Search is not supported for this file type');

    controller.destroy();
  });

  it('should integrate with FilePreviewViewer programmatic methods', async () => {
    const viewer = new FilePreviewViewer();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const mockPlugin: PreviewPlugin = {
      id: 'doc-searchable',
      name: 'Searchable Doc',
      extensions: ['.doc'],
      mimeTypes: ['application/msword'],
      supports: () => true,
      getToolbarActions: () => [],
      render: async (ctx) => {
        const div = document.createElement('div');
        div.className = 'doc-content';
        div.textContent = 'Hello world from document preview!';
        ctx.container.appendChild(div);
        return {
          destroy: () => {},
          isSearchable: true,
        };
      },
    };

    viewer.registerPlugin(mockPlugin);

    const buffer = new TextEncoder().encode('Dummy binary content').buffer;
    await viewer.preview(container, buffer, {
      showToolbar: true,
      metadata: { name: 'test.doc', extension: '.doc' },
    });

    expect(viewer.isSearchOpen()).toBe(false);

    viewer.openSearch();
    expect(viewer.isSearchOpen()).toBe(true);

    const res = await viewer.search('world');
    expect(res.total).toBe(1);
    expect(res.current).toBe(1);

    await viewer.findNext();
    await viewer.findPrev();

    viewer.clearSearch();
    viewer.closeSearch();
    expect(viewer.isSearchOpen()).toBe(false);

    viewer.destroy();
  });
});
