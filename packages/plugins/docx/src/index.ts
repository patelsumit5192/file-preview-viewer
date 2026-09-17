import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import * as docx from 'docx-preview';

export class DocxPlugin implements PreviewPlugin {
  id = 'docx';
  name = 'Word Document Preview';
  extensions = ['.docx'];
  mimeTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  weight = 80;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    return ext === '.docx' || this.mimeTypes.includes(mime || '');
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    return [
      {
        id: 'zoom-out',
        icon: 'zoom-out',
        label: 'Zoom Out',
        type: 'button',
        group: 'zoom',
        execute: () => {
          instance.zoomOut?.();
        }
      },
      {
        id: 'zoom-in',
        icon: 'zoom-in',
        label: 'Zoom In',
        type: 'button',
        group: 'zoom',
        execute: () => {
          instance.zoomIn?.();
        }
      },
      {
        id: 'fit-page',
        icon: 'fit-page',
        label: 'Fit to Page',
        type: 'button',
        group: 'zoom',
        execute: () => {
          instance.fitToPage?.();
        }
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download',
        type: 'button',
        group: 'actions',
        execute: () => {
          instance.download?.();
        }
      },
      {
        id: 'print',
        icon: 'print',
        label: 'Print',
        type: 'button',
        group: 'actions',
        execute: () => {
          instance.print?.();
        }
      }
    ];
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const wrapper = document.createElement('div');
    wrapper.className = 'fp-docx-wrapper';
    wrapper.style.transformOrigin = 'top center';
    wrapper.style.transition = 'transform 0.2s ease';
    wrapper.style.padding = '16px';
    
    ctx.container.style.overflow = 'auto';
    ctx.container.appendChild(wrapper);

    let scale = 1.0;

    try {
      await docx.renderAsync(ctx.buffer, wrapper, ctx.container, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
      });
    } catch {
      wrapper.innerHTML = `
        <div style="text-align:center; padding: 40px; color: #666;">
          <div style="font-size:48px; margin-bottom: 16px;">📄</div>
          <h3>${ctx.metadata.name || 'Word Document'}</h3>
          <p>DOCX render preview</p>
        </div>
      `;
    }

    const cleanup = () => {
      wrapper.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        scale += 0.1;
        wrapper.style.transform = `scale(${scale})`;
      },
      zoomOut: () => {
        scale = Math.max(0.2, scale - 0.1);
        wrapper.style.transform = `scale(${scale})`;
      },
      getZoom: () => scale,
      setZoom: (level: number) => {
        scale = level;
        wrapper.style.transform = `scale(${scale})`;
      },
      fitToPage: () => {
        scale = 1.0;
        wrapper.style.transform = `scale(1)`;
      },
      download: () => {
        const blob = new Blob([ctx.buffer], { type: this.mimeTypes[0] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'document.docx';
        a.click();
        URL.revokeObjectURL(url);
      },
      print: () => {
        window.print();
      }
    };
  }
}

export function docxPlugin(): DocxPlugin {
  return new DocxPlugin();
}

export default DocxPlugin;
