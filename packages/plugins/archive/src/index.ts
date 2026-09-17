import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import { formatFileSize, downloadFile } from '@patel.sumit51/core';
import { unzip } from 'fflate';

interface ArchiveEntry {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  data?: Uint8Array;
}

export class ArchivePlugin implements PreviewPlugin {
  id = 'archive';
  name = 'Archive Explorer';
  extensions = ['.zip'];
  mimeTypes = ['application/zip', 'application/x-zip-compressed'];
  weight = 70;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    const mime = file.metadata.mimeType?.toLowerCase();
    return ext === '.zip' || this.mimeTypes.includes(mime || '');
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    return [
      {
        id: 'zoom-out',
        icon: 'zoom-out',
        label: 'Zoom Out',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomOut?.()
      },
      {
        id: 'zoom-in',
        icon: 'zoom-in',
        label: 'Zoom In',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomIn?.()
      },
      {
        id: 'fit-page',
        icon: 'fit-page',
        label: 'Reset Zoom',
        type: 'button',
        group: 'zoom',
        execute: () => instance.fitToPage?.()
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download Archive',
        type: 'button',
        group: 'actions',
        execute: () => instance.download?.()
      },
      {
        id: 'print',
        icon: 'print',
        label: 'Print File List',
        type: 'button',
        group: 'actions',
        execute: () => instance.print?.()
      }
    ];
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const wrapper = document.createElement('div');
    wrapper.className = 'fp-archive-wrapper';
    wrapper.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: auto;
      padding: 24px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transform-origin: top left;
      transition: transform 0.2s ease;
    `;
    ctx.container.innerHTML = '';
    ctx.container.style.overflow = 'auto';
    ctx.container.appendChild(wrapper);

    let scale = 1.0;

    const entries = await new Promise<ArchiveEntry[]>((resolve, reject) => {
      unzip(new Uint8Array(ctx.buffer), (err, unzipped) => {
        if (err) {
          reject(err);
          return;
        }
        const list: ArchiveEntry[] = Object.entries(unzipped).map(([path, data]) => {
          const isDir = path.endsWith('/');
          const parts = path.split('/').filter(Boolean);
          const name = parts[parts.length - 1] || path;
          return {
            path,
            name,
            isDir,
            size: data.length,
            data
          };
        });
        resolve(list);
      });
    });

    const totalUncompressedSize = entries.reduce((acc, e) => acc + e.size, 0);

    const renderUI = (filteredEntries: ArchiveEntry[]) => {
      wrapper.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto; background: var(--fp-bg, #ffffff); border: 1px solid var(--fp-border, #e5e7eb); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="padding: 16px 20px; background: var(--fp-toolbar-bg, #f9fafb); border-bottom: 1px solid var(--fp-border, #e5e7eb); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--fp-text, #111827);">
                📦 ${ctx.metadata.name || 'Archive.zip'}
              </h3>
              <div style="font-size: 13px; color: var(--fp-text-muted, #6b7280);">
                ${entries.length} items · Total size: ${formatFileSize(totalUncompressedSize)} (Compressed: ${formatFileSize(ctx.buffer.byteLength)})
              </div>
            </div>
            <div>
              <input type="text" id="fp-archive-search" placeholder="Search files in archive..." style="padding: 6px 12px; font-size: 13px; border: 1px solid var(--fp-border, #d1d5db); border-radius: 6px; outline: none; width: 220px;" />
            </div>
          </div>
          <div style="max-height: 550px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
              <thead>
                <tr style="background: var(--fp-toolbar-bg, #f3f4f6); color: var(--fp-text-muted, #4b5563); border-bottom: 1px solid var(--fp-border, #e5e7eb);">
                  <th style="padding: 10px 16px; font-weight: 600;">Name / Path</th>
                  <th style="padding: 10px 16px; font-weight: 600; width: 120px;">Size</th>
                  <th style="padding: 10px 16px; font-weight: 600; width: 100px; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="fp-archive-body">
              </tbody>
            </table>
          </div>
        </div>
      `;

      const tbody = wrapper.querySelector('#fp-archive-body') as HTMLElement;
      if (filteredEntries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="padding: 24px; text-align: center; color: #9ca3af;">No matching files found</td></tr>`;
      } else {
        tbody.innerHTML = filteredEntries.map((e, idx) => `
          <tr style="border-bottom: 1px solid var(--fp-border, #f3f4f6); transition: background 0.15s ease;" onmouseover="this.style.background='var(--fp-hover, #f9fafb)'" onmouseout="this.style.background='transparent'">
            <td style="padding: 10px 16px; color: var(--fp-text, #1f2937); word-break: break-all;">
              <span style="margin-right: 8px;">${e.isDir ? '📁' : '📄'}</span>
              ${e.path}
            </td>
            <td style="padding: 10px 16px; color: var(--fp-text-muted, #6b7280);">
              ${e.isDir ? '-' : formatFileSize(e.size)}
            </td>
            <td style="padding: 10px 16px; text-align: right;">
              ${!e.isDir ? `<button data-idx="${idx}" class="fp-entry-dl" style="padding: 4px 8px; font-size: 12px; background: transparent; border: 1px solid var(--fp-border, #d1d5db); border-radius: 4px; cursor: pointer; color: var(--fp-text, #374151);">⬇️ Save</button>` : ''}
            </td>
          </tr>
        `).join('');
      }

      // Handle download individual file
      tbody.querySelectorAll('.fp-entry-dl').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          const target = ev.currentTarget as HTMLElement;
          const idx = Number(target.getAttribute('data-idx'));
          const entry = filteredEntries[idx];
          if (entry && entry.data) {
            downloadFile(entry.data.buffer as ArrayBuffer, entry.name);
          }
        });
      });

      // Handle search
      const searchInput = wrapper.querySelector('#fp-archive-search') as HTMLInputElement;
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const q = searchInput.value.toLowerCase().trim();
          const filtered = q ? entries.filter(e => e.path.toLowerCase().includes(q)) : entries;
          renderUI(filtered);
          const newSearch = wrapper.querySelector('#fp-archive-search') as HTMLInputElement;
          if (newSearch) {
            newSearch.value = q;
            newSearch.focus();
          }
        });
      }
    };

    renderUI(entries);

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
        scale = Math.max(0.3, scale - 0.1);
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
        downloadFile(ctx.buffer, ctx.metadata.name || 'archive.zip', 'application/zip');
      },
      print: () => {
        window.print();
      }
    };
  }
}

export function archivePlugin(): ArchivePlugin {
  return new ArchivePlugin();
}

export default ArchivePlugin;
