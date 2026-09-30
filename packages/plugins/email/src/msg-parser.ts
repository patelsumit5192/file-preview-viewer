import { CfbfReader } from '@patel.sumit51/core';
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

function decodeStringStream(bytes: Uint8Array | null, isUnicode: boolean): string {
  if (!bytes || bytes.length === 0) return '';
  if (isUnicode) {
    const text = new TextDecoder('utf-16le').decode(bytes);
    return text.replace(/\0+$/, '');
  }
  try {
    const text = new TextDecoder('windows-1252').decode(bytes);
    return text.replace(/\0+$/, '');
  } catch {
    const text = new TextDecoder('utf-8').decode(bytes);
    return text.replace(/\0+$/, '');
  }
}

/**
 * Decompress LZFu compressed RTF stream per Microsoft [MS-OXRTF] 2.1.3
 */
function decompressLZFu(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 16) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const compSize = view.getUint32(0, true);
  const rawSize = view.getUint32(4, true);
  const magic = view.getUint32(8, true);

  // Magic 0x414d454d = "MEMA" (uncompressed)
  if (magic === 0x414d454d) {
    return bytes.subarray(16, 16 + rawSize);
  }
  // Magic 0x75465a4c = "LZFu" (compressed)
  if (magic !== 0x75465a4c) {
    return null;
  }

  const RTF_PREBUF =
    "{\\rtf1\\ansi\\mac\\deff0\\deflang1033{\\fonttbl{\\f0\\fnil\\fcharset0 Times New Roman;}}\r\n" +
    "{\\colortbl;\\red0\\green0\\blue0;\\red0\\green0\\blue255;\\red0\\green255\\blue255;\\red0\\green255\\blue0;\r\n" +
    "\\red255\\green0\\blue255;\\red255\\green0\\blue0;\\red255\\green255\\blue0;\\red255\\green255\\blue255;}\r\n" +
    "\\froman\\fprq2\\fcharset0\\fdecor\\fprq0\\fmodern\\fprq1\\ftech\\fprq3\\fbidi\\fprq2\r\n" +
    "\\fswiss\\fprq2\\fcharset0 Arial;}\r\n{\\stylesheet{\\f0\\fs20 \\snext0 Normal;}}\r\n" +
    "\\widowctrl\\nowidctlpar\\sb0\\sa0\\trql\\trgaph108\\trrh280\\trleft36\r\n" +
    "\\clmgf\\clmrg\\clvmgf\\clvmrg\\clvertalt\\clvertalc\\clvertalb\\clnowrap\\clshdrawnil\r\n" +
    "\\clwWidth\\clftsWidth\\clwWidthB\\clftsWidthB\\clwWidthA\\clftsWidthA\\cellx";

  const dict = new Uint8Array(4096);
  let dictPos = 0;
  for (let i = 0; i < RTF_PREBUF.length && dictPos < 4096; i++) {
    dict[dictPos++] = RTF_PREBUF.charCodeAt(i);
  }

  const out = new Uint8Array(rawSize);
  let outPos = 0;
  let inPos = 16;
  const endPos = Math.min(bytes.length, 16 + compSize);

  let flagByte = 0;
  let flagMask = 0;

  while (inPos < endPos && outPos < rawSize) {
    flagMask >>= 1;
    if (flagMask === 0) {
      if (inPos >= endPos) break;
      flagByte = bytes[inPos++];
      flagMask = 0x80;
    }

    if ((flagByte & flagMask) !== 0) {
      if (inPos + 1 >= endPos) break;
      const b1 = bytes[inPos++];
      const b2 = bytes[inPos++];
      const offset = (b1 << 4) | (b2 >> 4);
      const len = (b2 & 0x0f) + 2;

      for (let i = 0; i < len && outPos < rawSize; i++) {
        const ch = dict[(offset + i) % 4096];
        out[outPos++] = ch;
        dict[dictPos] = ch;
        dictPos = (dictPos + 1) % 4096;
      }
    } else {
      if (inPos >= endPos) break;
      const ch = bytes[inPos++];
      out[outPos++] = ch;
      dict[dictPos] = ch;
      dictPos = (dictPos + 1) % 4096;
    }
  }

  return out.subarray(0, outPos);
}

/**
 * Extracts encapsulated HTML from decompressed RTF stream (MS-OXRTFEX).
 */
function extractHtmlFromRtf(rtfBytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8').decode(rtfBytes);
    if (!text.includes('\\fromhtml') && !text.includes('\\htmltag')) {
      return null;
    }

    const htmlStart = text.indexOf('<html');
    if (htmlStart !== -1) {
      const htmlEnd = text.lastIndexOf('</html>');
      if (htmlEnd !== -1) {
        let rawChunk = text.slice(htmlStart, htmlEnd + 7);
        rawChunk = rawChunk.replace(/\\htmltag\d*\s*/g, '');
        rawChunk = rawChunk.replace(/\\par\b/g, '\n');
        rawChunk = rawChunk.replace(/\\tab\b/g, '\t');
        rawChunk = rawChunk.replace(/\\{/g, '{').replace(/\\}/g, '}').replace(/\\\\/g, '\\');
        return rawChunk;
      }
    }
  } catch {}
  return null;
}

export async function parseMsg(buffer: ArrayBuffer | Uint8Array): Promise<ParsedEmail> {
  const arrayBuf = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const cfbf = new CfbfReader(arrayBuf);
  const entries = cfbf.listEntries();

  // Helper to find and read a stream by property tag
  const readProp = (tag: string): string => {
    // Check unicode first (_001F), then ANSI (_001E)
    const uniEntry = entries.find(e => e.name.toUpperCase().includes(`_${tag.toUpperCase()}001F`));
    if (uniEntry) {
      return decodeStringStream(cfbf.readStream(uniEntry.name), true);
    }
    const ansiEntry = entries.find(e => e.name.toUpperCase().includes(`_${tag.toUpperCase()}001E`));
    if (ansiEntry) {
      return decodeStringStream(cfbf.readStream(ansiEntry.name), false);
    }
    return '';
  };

  const subject = readProp('0037');
  const senderName = readProp('0C1A') || readProp('0042');
  const senderEmail = readProp('0C1F') || readProp('0065');
  const displayTo = readProp('0E04');
  const displayCc = readProp('0E03');
  const displayBcc = readProp('0E02');
  let bodyText = readProp('1000');
  let bodyHtml = readProp('1013');
  const rawHeaders = readProp('007D');

  // Check for compressed RTF if HTML is not directly available
  if (!bodyHtml) {
    const rtfEntry = entries.find(e => e.name.toUpperCase().includes('_10090102'));
    if (rtfEntry) {
      const rtfBytes = cfbf.readStream(rtfEntry.name);
      if (rtfBytes) {
        const decompressed = decompressLZFu(rtfBytes);
        if (decompressed) {
          const extractedHtml = extractHtmlFromRtf(decompressed);
          if (extractedHtml) {
            bodyHtml = extractedHtml;
          }
        }
      }
    }
  }

  // Parse recipients
  const toList: EmailAddress[] = [];
  if (displayTo) {
    displayTo.split(';').map(s => s.trim()).filter(Boolean).forEach(addr => {
      toList.push({ address: addr });
    });
  }

  const ccList: EmailAddress[] = [];
  if (displayCc) {
    displayCc.split(';').map(s => s.trim()).filter(Boolean).forEach(addr => {
      ccList.push({ address: addr });
    });
  }

  const bccList: EmailAddress[] = [];
  if (displayBcc) {
    displayBcc.split(';').map(s => s.trim()).filter(Boolean).forEach(addr => {
      bccList.push({ address: addr });
    });
  }

  // Attachments extraction
  const attachments: EmailAttachment[] = [];
  // Find all attachment stream clusters
  const attachDataEntries = entries.filter(e => e.name.toUpperCase().includes('_37010102'));

  for (let i = 0; i < attachDataEntries.length; i++) {
    const dataEntry = attachDataEntries[i];
    const prefix = dataEntry.name.split('_substg1.0_')[0];
    const bytes = cfbf.readStream(dataEntry.name);
    if (!bytes) continue;

    // Look for matching filename stream in the same storage prefix
    const nameEntry = entries.find(e => e.name.startsWith(prefix) && (e.name.toUpperCase().includes('_3707001F') || e.name.toUpperCase().includes('_3704001F') || e.name.toUpperCase().includes('_3707001E') || e.name.toUpperCase().includes('_3704001E')));
    const filename = nameEntry ? decodeStringStream(cfbf.readStream(nameEntry.name), nameEntry.name.toUpperCase().endsWith('001F')) : `attachment-${i + 1}`;

    const mimeEntry = entries.find(e => e.name.startsWith(prefix) && (e.name.toUpperCase().includes('_370E001F') || e.name.toUpperCase().includes('_370E001E')));
    const mimeType = mimeEntry ? decodeStringStream(cfbf.readStream(mimeEntry.name), mimeEntry.name.toUpperCase().endsWith('001F')) : 'application/octet-stream';

    const cidEntry = entries.find(e => e.name.startsWith(prefix) && (e.name.toUpperCase().includes('_3712001F') || e.name.toUpperCase().includes('_3712001E')));
    const contentId = cidEntry ? decodeStringStream(cfbf.readStream(cidEntry.name), cidEntry.name.toUpperCase().endsWith('001F')).replace(/^<|>$/g, '').trim() : undefined;

    attachments.push({
      filename,
      mimeType,
      size: bytes.byteLength,
      contentId,
      data: bytes,
    });
  }

  // Replace inline CID images in HTML
  if (bodyHtml && attachments.length > 0) {
    for (const att of attachments) {
      if (att.contentId && att.data) {
        try {
          const b64 = bufferToBase64(att.data);
          const dataUri = `data:${att.mimeType};base64,${b64}`;
          const escapedCid = escapeRegex(att.contentId);
          const cidRegex = new RegExp(`cid:<?${escapedCid}>?`, 'gi');
          bodyHtml = bodyHtml.replace(cidRegex, dataUri);
        } catch {}
      }
    }
  }

  return {
    format: 'msg',
    subject: subject || '(No Subject)',
    from: senderName || senderEmail ? { name: senderName || undefined, address: senderEmail || undefined } : undefined,
    to: toList,
    cc: ccList,
    bcc: bccList,
    date: undefined,
    headers: {},
    rawHeaders: rawHeaders || undefined,
    htmlBody: bodyHtml || undefined,
    textBody: bodyText || undefined,
    attachments,
  };
}
