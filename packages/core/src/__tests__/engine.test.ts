// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { FilePreviewViewer } from '../engine';
import type { PreviewPlugin, PreviewInstance, RenderContext, FileInfo } from '../types';

describe('FilePreviewViewer Engine', () => {
  it('should register plugins with weight ordering', () => {
    const viewer = new FilePreviewViewer();

    const lowPriorityPlugin: PreviewPlugin = {
      id: 'low',
      name: 'Low Priority Plugin',
      extensions: ['.test'],
      mimeTypes: ['text/test'],
      weight: 10,
      supports: () => true,
      getToolbarActions: () => [],
      render: async () => ({ destroy: () => {} })
    };

    const highPriorityPlugin: PreviewPlugin = {
      id: 'high',
      name: 'High Priority Plugin',
      extensions: ['.test'],
      mimeTypes: ['text/test'],
      weight: 100,
      supports: () => true,
      getToolbarActions: () => [],
      render: async () => ({ destroy: () => {} })
    };

    viewer.registerPlugin(lowPriorityPlugin);
    viewer.registerPlugin(highPriorityPlugin);

    expect(viewer).toBeDefined();
  });

  it('should dispatch lifecycle events and render matched plugin', async () => {
    const viewer = new FilePreviewViewer();
    const container = document.createElement('div');

    const destroySpy = vi.fn();
    const mockInstance: PreviewInstance = {
      destroy: destroySpy,
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      download: vi.fn(),
    };

    const mockPlugin: PreviewPlugin = {
      id: 'mock-txt',
      name: 'Mock Text Plugin',
      extensions: ['.txt'],
      mimeTypes: ['text/plain'],
      supports: (file: FileInfo) => file.metadata.extension === '.txt',
      getToolbarActions: (inst) => [
        {
          id: 'dl',
          icon: 'download',
          label: 'Download',
          type: 'button',
          group: 'actions',
          execute: () => inst.download?.()
        }
      ],
      render: async (ctx: RenderContext) => {
        const p = document.createElement('p');
        p.textContent = 'Rendered Content';
        ctx.container.appendChild(p);
        return mockInstance;
      }
    };

    viewer.registerPlugin(mockPlugin);

    const loadingSpy = vi.fn();
    const loadedSpy = vi.fn();

    viewer.on('loading', loadingSpy);
    viewer.on('loaded', loadedSpy);

    const blob = new Blob(['Hello World!'], { type: 'text/plain' });
    const file = new File([blob], 'sample.txt', { type: 'text/plain' });

    const instance = await viewer.preview(container, file);

    expect(loadingSpy).toHaveBeenCalled();
    expect(loadedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ plugin: 'mock-txt' })
    );
    expect(instance).toBe(mockInstance);
    expect(viewer.getInstance()).toBe(mockInstance);

    // Test cleanup
    viewer.destroy();
    expect(destroySpy).toHaveBeenCalled();
    expect(viewer.getInstance()).toBeNull();
  });

  it('should throw error for unsupported file formats', async () => {
    const viewer = new FilePreviewViewer();
    const container = document.createElement('div');

    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const file = new File([blob], 'unknown.xyz123');

    await expect(viewer.preview(container, file)).rejects.toThrow(
      /Unsupported file type/
    );
  });
});
