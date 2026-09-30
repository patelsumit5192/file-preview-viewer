import type {
  PreviewPlugin,
  PreviewInstance,
  RenderContext,
  FileInfo,
  ToolbarAction,
} from '@patel.sumit51/core';
import DOMPurify from 'dompurify';
import { parseEml } from './eml-parser';
import { parseMsg } from './msg-parser';
import type { ParsedEmail, EmailAttachment } from './types';

export * from './types';
export { parseEml } from './eml-parser';
export { parseMsg } from './msg-parser';

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'EM';
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function linkifyText(text: string): string {
  const escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  return escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">$1</a>');
}

function triggerDownload(filename: string, data: Uint8Array | ArrayBuffer | string, mimeType: string = 'application/octet-stream') {
  let blob: Blob;
  if (typeof data === 'string') {
    blob = new Blob([data], { type: mimeType });
  } else {
    blob = new Blob([data as any], { type: mimeType });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class EmailPlugin implements PreviewPlugin {
  id = 'email';
  name = 'Email Preview (.eml, .msg)';
  extensions = ['.eml', '.msg'];
  mimeTypes = [
    'message/rfc822',
    'application/vnd.ms-outlook',
    'application/x-msg',
    'application/octet-stream',
  ];
  weight = 40;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    if (ext === '.eml' || ext === '.msg') return true;

    const mime = file.metadata.mimeType?.toLowerCase();
    if (
      mime === 'message/rfc822' ||
      mime === 'application/vnd.ms-outlook' ||
      mime === 'application/x-msg'
    ) {
      return true;
    }

    // Magic bytes check
    if (file.buffer && file.buffer.byteLength >= 8) {
      const u8 = new Uint8Array(file.buffer);
      // CFBF / OLE2 check for .msg
      const isCfbf = (
        u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0 &&
        u8[4] === 0xa1 && u8[5] === 0xb1 && u8[6] === 0x1a && u8[7] === 0xe1
      );
      if (isCfbf && (ext === '.msg' || !ext)) {
        return true;
      }

      // Check for common EML headers at start of text
      try {
        const headerSlice = new TextDecoder('utf-8').decode(u8.subarray(0, 1024));
        if (/^(From|Received|Return-Path|Date|Subject|MIME-Version|Message-ID):/im.test(headerSlice)) {
          return true;
        }
      } catch {}
    }

    return false;
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    return [
      {
        id: 'zoom-in',
        icon: 'zoom-in',
        label: 'Zoom In',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomIn?.(),
      },
      {
        id: 'zoom-out',
        icon: 'zoom-out',
        label: 'Zoom Out',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomOut?.(),
      },
      {
        id: 'fit-width',
        icon: 'fit-width',
        label: 'Fit to Width',
        type: 'button',
        group: 'zoom',
        execute: () => instance.fitToWidth?.(),
      },
      {
        id: 'reset-zoom',
        icon: 'reset-zoom',
        label: 'Reset Zoom',
        type: 'button',
        group: 'zoom',
        execute: () => instance.resetZoom?.(),
      },
      {
        id: 'print',
        icon: 'printer',
        label: 'Print Email',
        type: 'button',
        group: 'actions',
        execute: () => instance.print?.(),
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download Email',
        type: 'button',
        group: 'actions',
        execute: () => instance.download?.(),
      },
    ];
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const ext = ctx.metadata.extension?.toLowerCase();
    const u8 = new Uint8Array(ctx.buffer);
    const isCfbf = (
      u8.length >= 8 &&
      u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0 &&
      u8[4] === 0xa1 && u8[5] === 0xb1 && u8[6] === 0x1a && u8[7] === 0xe1
    );

    let parsed: ParsedEmail;
    if (ext === '.msg' || isCfbf) {
      parsed = await parseMsg(ctx.buffer);
    } else {
      parsed = await parseEml(ctx.buffer);
    }

    if (ctx.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    let zoomLevel = typeof (ctx.options as any)?.zoom === 'number' && (ctx.options as any).zoom > 0
      ? (ctx.options as any).zoom
      : 1.0;

    const wrapper = document.createElement('div');
    wrapper.className = 'fp-email-wrapper';
    wrapper.tabIndex = 0;
    wrapper.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
      background: var(--fp-bg-canvas, #f1f5f9);
      padding: 24px 16px;
      outline: none;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    `;

    const card = document.createElement('div');
    card.className = 'fp-email-card';
    card.style.cssText = `
      width: 100%;
      max-width: 900px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
      box-sizing: border-box;
      overflow: hidden;
      transform-origin: top center;
      transition: transform 0.15s ease;
      transform: scale(${zoomLevel});
    `;

    // 1. Header Section
    const headerEl = document.createElement('div');
    headerEl.className = 'fp-email-header';
    headerEl.style.cssText = `
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
      background: #fafafa;
    `;

    const formatBadge = parsed.format.toUpperCase();
    const initials = getInitials(parsed.from?.name, parsed.from?.address);

    let recipientsHtml = '';
    if (parsed.to.length > 0) {
      recipientsHtml += `<div style="display: flex; flex-wrap: wrap; align-items: center; margin-top: 6px; font-size: 13px; color: #475569;">
        <span style="font-weight: 600; width: 36px; color: #64748b;">To:</span>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
          ${parsed.to.map(t => `<span style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; color: #1e293b;">${escapeHtml(t.name ? `${t.name} <${t.address || ''}>` : t.address || '')}</span>`).join('')}
        </div>
      </div>`;
    }
    if (parsed.cc.length > 0) {
      recipientsHtml += `<div style="display: flex; flex-wrap: wrap; align-items: center; margin-top: 4px; font-size: 13px; color: #475569;">
        <span style="font-weight: 600; width: 36px; color: #64748b;">Cc:</span>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
          ${parsed.cc.map(c => `<span style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 4px; color: #334155;">${escapeHtml(c.name ? `${c.name} <${c.address || ''}>` : c.address || '')}</span>`).join('')}
        </div>
      </div>`;
    }

    headerEl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; background: #0284c7; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px;">${formatBadge}</span>
          <span style="font-size: 12px; color: #64748b; font-weight: 500;">Email Message</span>
        </div>
        ${parsed.date ? `<div style="font-size: 13px; color: #64748b;">${escapeHtml(new Date(parsed.date).toLocaleString())}</div>` : ''}
      </div>

      <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.35; word-break: break-word;">
        ${escapeHtml(parsed.subject)}
      </h1>

      <div style="display: flex; align-items: flex-start; gap: 14px;">
        <div style="width: 42px; height: 42px; border-radius: 50%; background: #3b82f6; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);">
          ${initials}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 15px; font-weight: 600; color: #0f172a;">
            ${escapeHtml(parsed.from?.name || parsed.from?.address || 'Unknown Sender')}
            ${parsed.from?.name && parsed.from?.address ? `<span style="font-size: 13px; font-weight: 400; color: #64748b; margin-left: 6px;">&lt;${escapeHtml(parsed.from.address)}&gt;</span>` : ''}
          </div>
          ${recipientsHtml}
        </div>
      </div>
    `;

    // 2. Attachments Section (if present)
    if (parsed.attachments.length > 0) {
      const attachSection = document.createElement('div');
      attachSection.className = 'fp-email-attachments';
      attachSection.style.cssText = `
        padding: 12px 24px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      `;

      const totalSize = parsed.attachments.reduce((acc, a) => acc + (a.size || 0), 0);
      const titleRow = document.createElement('div');
      titleRow.style.cssText = `font-size: 13px; font-weight: 600; color: #334155; display: flex; align-items: center; gap: 6px;`;
      titleRow.innerHTML = `<span>📎</span> <span>Attachments (${parsed.attachments.length}) · ${formatSize(totalSize)}</span>`;
      attachSection.appendChild(titleRow);

      const chipsGrid = document.createElement('div');
      chipsGrid.style.cssText = `display: flex; flex-wrap: wrap; gap: 8px;`;

      for (const att of parsed.attachments) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.style.cssText = `
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 13px;
          color: #1e293b;
          cursor: pointer;
          transition: all 0.15s ease;
        `;
        chip.onmouseenter = () => {
          chip.style.borderColor = '#0284c7';
          chip.style.background = '#f0f9ff';
        };
        chip.onmouseleave = () => {
          chip.style.borderColor = '#cbd5e1';
          chip.style.background = '#ffffff';
        };
        chip.innerHTML = `
          <span>📄</span>
          <span style="font-weight: 500; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(att.filename)}</span>
          <span style="color: #64748b; font-size: 11px;">(${formatSize(att.size)})</span>
          <span style="color: #0284c7; margin-left: 2px;">⬇️</span>
        `;
        chip.onclick = () => {
          if (att.data) {
            triggerDownload(att.filename, att.data, att.mimeType);
          }
        };
        chipsGrid.appendChild(chip);
      }

      attachSection.appendChild(chipsGrid);
      card.appendChild(headerEl);
      card.appendChild(attachSection);
    } else {
      card.appendChild(headerEl);
    }

    // 3. Body Section
    const bodyEl = document.createElement('div');
    bodyEl.className = 'fp-email-body';
    bodyEl.style.cssText = `
      padding: 32px 24px;
      font-size: 15px;
      line-height: 1.6;
      color: #1e293b;
      word-break: break-word;
      min-height: 250px;
    `;

    if (parsed.htmlBody) {
      // Clean HTML via DOMPurify
      const cleanHtml = DOMPurify.sanitize(parsed.htmlBody, {
        ADD_TAGS: ['style'],
        ADD_ATTR: ['target', 'style', 'cellspacing', 'cellpadding', 'border'],
      });
      bodyEl.innerHTML = cleanHtml;
    } else if (parsed.textBody) {
      bodyEl.innerHTML = `<div style="white-space: pre-wrap; font-family: inherit;">${linkifyText(parsed.textBody)}</div>`;
    } else {
      bodyEl.innerHTML = `<div style="color: #94a3b8; font-style: italic;">(This email has no message body content)</div>`;
    }

    card.appendChild(bodyEl);
    wrapper.appendChild(card);

    ctx.container.innerHTML = '';
    ctx.container.appendChild(wrapper);

    const applyZoom = () => {
      card.style.transform = `scale(${zoomLevel})`;
    };

    return {
      zoomIn: () => {
        zoomLevel = Math.min(3.0, zoomLevel + 0.15);
        applyZoom();
      },
      zoomOut: () => {
        zoomLevel = Math.max(0.4, zoomLevel - 0.15);
        applyZoom();
      },
      setZoom: (level: number) => {
        zoomLevel = Math.max(0.4, Math.min(3.0, level));
        applyZoom();
      },
      fitToWidth: () => {
        zoomLevel = 1.0;
        card.style.maxWidth = '100%';
        wrapper.scrollTop = 0;
        wrapper.scrollLeft = 0;
        applyZoom();
      },
      resetZoom: () => {
        zoomLevel = 1.0;
        card.style.maxWidth = '900px';
        wrapper.scrollTop = 0;
        wrapper.scrollLeft = 0;
        applyZoom();
      },
      download: () => {
        const filename = ctx.metadata.name || `message.${parsed.format}`;
        triggerDownload(filename, ctx.buffer, parsed.format === 'msg' ? 'application/vnd.ms-outlook' : 'message/rfc822');
      },
      print: () => {
        window.print();
      },
      destroy: () => {
        ctx.container.innerHTML = '';
      },
    };
  }
}

export function emailPlugin(): EmailPlugin {
  return new EmailPlugin();
}
