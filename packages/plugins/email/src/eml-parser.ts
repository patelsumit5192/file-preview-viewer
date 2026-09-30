import PostalMime from 'postal-mime';
import type { ParsedEmail, EmailAttachment, EmailAddress } from './types';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bufferToBase64(data: Uint8Array | ArrayBuffer | string): string {
  if (typeof data === 'string') return data;
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  const len = u8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(u8[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  const bufObj = (globalThis as any).Buffer;
  return bufObj ? bufObj.from(binary, 'binary').toString('base64') : '';
}

/**
 * Fallback parser for standard RFC 822 EML when PostalMime fails on malformed streams.
 */
function parseEmlFallback(rawText: string): ParsedEmail {
  const lines = rawText.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let bodyStartIndex = -1;
  let currentHeader = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      bodyStartIndex = i + 1;
      break;
    }
    if (/^\s/.test(line) && currentHeader) {
      headers[currentHeader] += ' ' + line.trim();
    } else {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        currentHeader = match[1].toLowerCase();
        headers[currentHeader] = match[2];
      }
    }
  }

  const rawBody = bodyStartIndex >= 0 ? lines.slice(bodyStartIndex).join('\n') : rawText;
  const isHtml = /<html|<body|<div|<p/i.test(rawBody);

  return {
    format: 'eml',
    subject: headers['subject'] || '(No Subject)',
    from: headers['from'] ? { address: headers['from'] } : undefined,
    to: headers['to'] ? [{ address: headers['to'] }] : [],
    cc: headers['cc'] ? [{ address: headers['cc'] }] : [],
    bcc: headers['bcc'] ? [{ address: headers['bcc'] }] : [],
    date: headers['date'],
    messageId: headers['message-id'],
    headers,
    rawHeaders: lines.slice(0, bodyStartIndex >= 0 ? bodyStartIndex - 1 : lines.length).join('\n'),
    htmlBody: isHtml ? rawBody : undefined,
    textBody: !isHtml ? rawBody : undefined,
    attachments: []
  };
}

export async function parseEml(buffer: ArrayBuffer | Uint8Array | string): Promise<ParsedEmail> {
  let rawText = '';
  if (typeof buffer === 'string') {
    rawText = buffer;
  } else {
    try {
      const dec = new TextDecoder('utf-8');
      rawText = dec.decode(buffer);
    } catch {
      rawText = '';
    }
  }

  try {
    const ParserClass = (PostalMime as any).default || PostalMime;
    const parser = new ParserClass();
    const parsed = await parser.parse(buffer);

    const attachments: EmailAttachment[] = (parsed.attachments || []).map((att: any) => {
      const filename = att.filename || 'attachment';
      const mimeType = att.mimeType || 'application/octet-stream';
      const size = att.content ? (att.content.byteLength || att.content.length || 0) : 0;
      const contentId = att.contentId ? att.contentId.replace(/^<|>$/g, '').trim() : undefined;
      return {
        filename,
        mimeType,
        size,
        contentId,
        data: att.content
      };
    });

    let html = parsed.html || '';

    // Replace inline CID images with data URIs
    if (html && attachments.length > 0) {
      for (const att of attachments) {
        if (att.contentId && att.data) {
          try {
            const b64 = bufferToBase64(att.data);
            const dataUri = `data:${att.mimeType};base64,${b64}`;
            const escapedCid = escapeRegex(att.contentId);
            const cidRegex = new RegExp(`cid:<?${escapedCid}>?`, 'gi');
            html = html.replace(cidRegex, dataUri);
          } catch {}
        }
      }
    }

    const headersRecord: Record<string, string | string[]> = {};
    if (Array.isArray(parsed.headers)) {
      for (const h of parsed.headers) {
        if (h.key && h.value) {
          headersRecord[h.key.toLowerCase()] = h.value;
        }
      }
    }

    const toList: EmailAddress[] = (parsed.to || []).map((t: any) => ({
      name: t.name || undefined,
      address: t.address || undefined
    }));

    const ccList: EmailAddress[] = (parsed.cc || []).map((c: any) => ({
      name: c.name || undefined,
      address: c.address || undefined
    }));

    const bccList: EmailAddress[] = (parsed.bcc || []).map((b: any) => ({
      name: b.name || undefined,
      address: b.address || undefined
    }));

    return {
      format: 'eml',
      subject: parsed.subject || '(No Subject)',
      from: parsed.from ? { name: parsed.from.name || undefined, address: parsed.from.address || undefined } : undefined,
      to: toList,
      cc: ccList,
      bcc: bccList,
      date: parsed.date,
      messageId: parsed.messageId,
      headers: headersRecord,
      rawHeaders: rawText ? rawText.split(/\r?\n\r?\n/)[0] : undefined,
      htmlBody: html || undefined,
      textBody: parsed.text || undefined,
      attachments
    };
  } catch (err) {
    console.warn('[EmailPlugin] PostalMime failed, using fallback parser:', err);
    return parseEmlFallback(rawText);
  }
}
