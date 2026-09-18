// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { ToolbarController } from '../toolbar/toolbar-controller';
import { FilePreviewViewer } from '../engine';
import type { ToolbarAction, PreviewPlugin } from '../types';

describe('ToolbarController & Configurable Features', () => {
  const sampleActions: ToolbarAction[] = [
    {
      id: 'zoom-in',
      icon: 'zoom-in',
      label: 'Zoom In',
      type: 'button',
      group: 'zoom',
      execute: vi.fn()
    },
    {
      id: 'zoom-out',
      icon: 'zoom-out',
      label: 'Zoom Out',
      type: 'button',
      group: 'zoom',
      execute: vi.fn()
    },
    {
      id: 'fit-page',
      icon: 'fit-page',
      label: 'Fit to Page',
      type: 'button',
      group: 'zoom',
      execute: vi.fn()
    },
    {
      id: 'download',
      icon: 'download',
      label: 'Download',
      type: 'button',
      group: 'actions',
      execute: vi.fn()
    },
    {
      id: 'print',
      icon: 'print',
      label: 'Print',
      type: 'button',
      group: 'actions',
      execute: vi.fn()
    },
    {
      id: 'open-window',
      icon: 'open-window',
      label: 'Open in Separate Full Window',
      type: 'button',
      group: 'actions',
      execute: vi.fn()
    }
  ];

  it('renders all actions when no config restricts them', () => {
    const container = document.createElement('div');
    const toolbar = new ToolbarController(container);
    toolbar.update(sampleActions);

    const buttons = container.querySelectorAll('button[data-action-id]');
    expect(buttons.length).toBe(6);
  });

  it('excludes Zoom In button when zoomIn = false', () => {
    const container = document.createElement('div');
    const toolbar = new ToolbarController(container, { zoomIn: false });
    toolbar.update(sampleActions);

    expect(container.querySelector('button[data-action-id="zoom-in"]')).toBeNull();
    expect(container.querySelector('button[data-action-id="zoom-out"]')).not.toBeNull();
    expect(container.querySelector('button[data-action-id="download"]')).not.toBeNull();
  });

  it('excludes multiple buttons via config options', () => {
    const container = document.createElement('div');
    const toolbar = new ToolbarController(container, {
      zoomIn: false,
      zoomOut: false,
      print: false
    });
    toolbar.update(sampleActions);

    expect(container.querySelector('button[data-action-id="zoom-in"]')).toBeNull();
    expect(container.querySelector('button[data-action-id="zoom-out"]')).toBeNull();
    expect(container.querySelector('button[data-action-id="print"]')).toBeNull();
    expect(container.querySelector('button[data-action-id="fit-page"]')).not.toBeNull();
    expect(container.querySelector('button[data-action-id="download"]')).not.toBeNull();
  });

  it('allows dynamic runtime configuration via setConfig()', () => {
    const container = document.createElement('div');
    const toolbar = new ToolbarController(container);
    toolbar.update(sampleActions);

    expect(container.querySelector('button[data-action-id="download"]')).not.toBeNull();

    toolbar.setConfig({ download: false });
    expect(container.querySelector('button[data-action-id="download"]')).toBeNull();

    toolbar.setConfig({ download: true });
    expect(container.querySelector('button[data-action-id="download"]')).not.toBeNull();
  });

  it('supports hideAction() and showAction() methods', () => {
    const container = document.createElement('div');
    const toolbar = new ToolbarController(container);
    toolbar.update(sampleActions);

    expect(container.querySelector('button[data-action-id="open-window"]')).not.toBeNull();

    toolbar.hideAction('open-window');
    expect(container.querySelector('button[data-action-id="open-window"]')).toBeNull();

    toolbar.showAction('open-window');
    expect(container.querySelector('button[data-action-id="open-window"]')).not.toBeNull();
  });

  it('supports enableAction() and disableAction() methods', () => {
    const container = document.createElement('div');
    const toolbar = new ToolbarController(container);
    toolbar.update(sampleActions);

    const btn = container.querySelector('button[data-action-id="print"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    toolbar.disableAction('print');
    expect(btn.disabled).toBe(true);

    toolbar.enableAction('print');
    expect(btn.disabled).toBe(false);
  });

  it('integrates with FilePreviewViewer options and runtime methods', async () => {
    const viewer = new FilePreviewViewer();
    const container = document.createElement('div');

    const mockPlugin: PreviewPlugin = {
      id: 'test-plugin',
      name: 'Test Plugin',
      extensions: ['.mock'],
      mimeTypes: ['application/mock'],
      supports: () => true,
      getToolbarActions: (inst) => [
        {
          id: 'zoom-in',
          icon: 'zoom-in',
          label: 'Zoom In',
          type: 'button',
          group: 'zoom',
          execute: () => inst.zoomIn?.()
        },
        {
          id: 'zoom-out',
          icon: 'zoom-out',
          label: 'Zoom Out',
          type: 'button',
          group: 'zoom',
          execute: () => inst.zoomOut?.()
        },
        {
          id: 'print',
          icon: 'print',
          label: 'Print',
          type: 'button',
          group: 'actions',
          execute: () => inst.print?.()
        }
      ],
      render: async () => ({
        destroy: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        print: vi.fn(),
        fitToPage: vi.fn()
      })
    };

    viewer.registerPlugin(mockPlugin);

    await viewer.preview(container, new ArrayBuffer(8), {
      zoomIn: false,
      metadata: { name: 'test.mock', extension: '.mock' }
    });

    expect(container.querySelector('button[data-action-id="zoom-in"]')).toBeNull();
    expect(container.querySelector('button[data-action-id="zoom-out"]')).not.toBeNull();

    viewer.hideToolbarAction('print');
    expect(container.querySelector('button[data-action-id="print"]')).toBeNull();

    viewer.showToolbarAction('print');
    expect(container.querySelector('button[data-action-id="print"]')).not.toBeNull();

    viewer.destroy();
  });
});
