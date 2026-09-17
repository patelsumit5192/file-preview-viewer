import type { FileSource, FileMetadata, FileInfo } from './types';

/** Magic number signatures for common file formats */
const MAGIC_NUMBERS: Array<{ bytes: number[]; mask?: number[]; offset?: number; mime: string }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' },                    // %PDF
  { bytes: [0x50, 0x4B, 0x03, 0x04], mime: 'application/zip' },                    // PK.. (ZIP/DOCX/XLSX/PPTX/ODT/ODS/ODP)
  { bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], mime: 'application/x-cfbf' }, // CFBF/OLE2 (DOC/XLS/PPT)
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mime: 'image/png' }, // PNG
  { bytes: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg' },                               // JPEG
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },                          // GIF87a/GIF89a
  { bytes: [0x42, 0x4D], mime: 'image/bmp' },                                      // BMP
  { bytes: [0x00, 0x00, 0x01, 0x00], mime: 'image/x-icon' },                       // ICO
  { bytes: [0x49, 0x49, 0x2A, 0x00], mime: 'image/tiff' },                         // TIFF (LE)
  { bytes: [0x4D, 0x4D, 0x00, 0x2A], mime: 'image/tiff' },                         // TIFF (BE)
  { bytes: [0x1A, 0x45, 0xDF, 0xA3], mime: 'video/webm' },                         // WebM/MKV
  { bytes: [0x66, 0x74, 0x79, 0x70], mime: 'video/mp4', offset: 4 },               // MP4 (ftyp)
  { bytes: [0x49, 0x44, 0x33], mime: 'audio/mpeg' },                               // MP3 (ID3)
  { bytes: [0xFF, 0xFB], mime: 'audio/mpeg' },                                     // MP3 (sync)
  { bytes: [0xFF, 0xF3], mime: 'audio/mpeg' },                                     // MP3 (sync)
  { bytes: [0x4F, 0x67, 0x67, 0x53], mime: 'audio/ogg' },                          // OGG
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'audio/wav' },                          // WAV/RIFF (also WebP)
  { bytes: [0x66, 0x4C, 0x61, 0x43], mime: 'audio/flac' },                         // FLAC
  { bytes: [0x7B, 0x5C, 0x72, 0x74, 0x66], mime: 'text/rtf' },                     // RTF
];

/** Extension to MIME type mapping */
const EXTENSION_MIME_MAP: Record<string, string> = {
  // Documents — Modern OOXML
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.docm': 'application/vnd.ms-word.document.macroEnabled.12',
  '.dotx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  '.dotm': 'application/vnd.ms-word.template.macroEnabled.12',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.xlsb': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  '.xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  '.xltm': 'application/vnd.ms-excel.template.macroEnabled.12',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  '.pptm': 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  '.ppsm': 'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
  '.potx': 'application/vnd.openxmlformats-officedocument.presentationml.template',
  '.potm': 'application/vnd.ms-powerpoint.template.macroEnabled.12',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  // Documents — Legacy Binary (CFBF/OLE2)
  '.doc': 'application/msword',
  '.dot': 'application/msword',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pps': 'application/vnd.ms-powerpoint',
  '.pot': 'application/vnd.ms-powerpoint',
  // Documents — OpenDocument (ODF)
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.odg': 'application/vnd.oasis.opendocument.graphics',
  '.odf': 'application/vnd.oasis.opendocument.formula',
  // Documents — RTF
  '.rtf': 'text/rtf',
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  // Media
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  // Code/Text
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.jsx': 'text/jsx',
  '.tsx': 'text/tsx',
  '.py': 'text/x-python',
  '.java': 'text/x-java',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.h': 'text/x-c',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.rb': 'text/x-ruby',
  '.php': 'text/x-php',
  '.sh': 'text/x-shellscript',
  '.bash': 'text/x-shellscript',
  '.sql': 'text/x-sql',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'text/toml',
  '.ini': 'text/ini',
  '.conf': 'text/plain',
  '.env': 'text/plain',
  '.md': 'text/markdown',
  '.scss': 'text/x-scss',
  '.less': 'text/x-less',
  '.vue': 'text/x-vue',
  '.svelte': 'text/x-svelte',
  '.dart': 'text/x-dart',
  '.kt': 'text/x-kotlin',
  '.swift': 'text/x-swift',
  '.r': 'text/x-r',
  '.scala': 'text/x-scala',
  '.lua': 'text/x-lua',
  '.perl': 'text/x-perl',
  '.pl': 'text/x-perl',
};

/**
 * Detect MIME type from file buffer magic bytes.
 */
export function detectMagicBytes(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer.slice(0, 16));

  for (const sig of MAGIC_NUMBERS) {
    const offset = sig.offset ?? 0;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      const actual = bytes[offset + i];
      const expected = sig.bytes[i];
      const mask = sig.mask?.[i] ?? 0xFF;
      if ((actual & mask) !== expected) {
        match = false;
        break;
      }
    }
    if (match) {
      // Special case: RIFF could be WAV or WebP
      if (sig.mime === 'audio/wav' && bytes.length >= 12) {
        const format = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        if (format === 'WEBP') return 'image/webp';
        if (format === 'AVI ') return 'video/x-msvideo';
        return 'audio/wav';
      }
      return sig.mime;
    }
  }

  return null;
}

/**
 * Detect ZIP sub-type (OOXML or OpenDocument) by checking ZIP entry names.
 * All OOXML formats use ZIP container with PK header.
 * OpenDocument formats also use ZIP with a 'mimetype' entry at offset 0.
 */
export function detectOoxmlType(buffer: ArrayBuffer): string | null {
  const text = new TextDecoder('ascii', { fatal: false }).decode(
    new Uint8Array(buffer.slice(0, 8000))
  );

  // OOXML detection
  if (text.includes('word/')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (text.includes('xl/')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (text.includes('ppt/')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }

  // OpenDocument detection — the 'mimetype' file is stored uncompressed at the start
  if (text.includes('application/vnd.oasis.opendocument.text')) {
    return 'application/vnd.oasis.opendocument.text';
  }
  if (text.includes('application/vnd.oasis.opendocument.spreadsheet')) {
    return 'application/vnd.oasis.opendocument.spreadsheet';
  }
  if (text.includes('application/vnd.oasis.opendocument.presentation')) {
    return 'application/vnd.oasis.opendocument.presentation';
  }
  if (text.includes('application/vnd.oasis.opendocument.graphics')) {
    return 'application/vnd.oasis.opendocument.graphics';
  }
  if (text.includes('application/vnd.oasis.opendocument.formula')) {
    return 'application/vnd.oasis.opendocument.formula';
  }

  return 'application/zip';
}

/**
 * Detect CFBF / OLE2 sub-type (DOC, XLS, PPT) by searching for stream signatures.
 */
export function detectCfbfType(buffer: ArrayBuffer): { mime: string; extension: string } | null {
  const bytes = new Uint8Array(buffer);
  
  const hasUtf16le = (str: string): boolean => {
    const target = new Uint8Array(str.length * 2);
    for (let i = 0; i < str.length; i++) {
      target[i * 2] = str.charCodeAt(i);
      target[i * 2 + 1] = 0;
    }
    const targetLen = target.length;
    const max = bytes.length - targetLen;
    for (let i = 0; i <= max; i++) {
      let match = true;
      for (let j = 0; j < targetLen; j++) {
        if (bytes[i + j] !== target[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  };

  if (hasUtf16le('PowerPoint Document')) {
    return { mime: 'application/vnd.ms-powerpoint', extension: '.ppt' };
  }
  if (hasUtf16le('WordDocument')) {
    return { mime: 'application/msword', extension: '.doc' };
  }
  if (hasUtf16le('Workbook') || hasUtf16le('Book')) {
    return { mime: 'application/vnd.ms-excel', extension: '.xls' };
  }

  return null;
}

/**
 * Extract file extension from a filename or URL.
 */
export function extractExtension(nameOrUrl: string): string | undefined {
  try {
    // Try as URL first
    const url = new URL(nameOrUrl);
    const pathname = url.pathname;
    const dotIndex = pathname.lastIndexOf('.');
    if (dotIndex !== -1) {
      return pathname.slice(dotIndex).toLowerCase().split('?')[0];
    }
  } catch {
    // Not a URL, try as filename
    const dotIndex = nameOrUrl.lastIndexOf('.');
    if (dotIndex !== -1) {
      return nameOrUrl.slice(dotIndex).toLowerCase();
    }
  }
  return undefined;
}

/**
 * Get MIME type from file extension.
 */
export function mimeFromExtension(extension: string): string | undefined {
  return EXTENSION_MIME_MAP[extension.toLowerCase()];
}

/**
 * Convert any FileSource to ArrayBuffer.
 */
export async function sourceToArrayBuffer(
  source: FileSource,
  signal?: AbortSignal
): Promise<{ buffer: ArrayBuffer; metadata: FileMetadata }> {
  let buffer: ArrayBuffer;
  const metadata: FileMetadata = {};

  if (typeof source === 'string') {
    // URL string
    metadata.name = source.split('/').pop()?.split('?')[0];
    metadata.extension = extractExtension(source);

    const response = await fetch(source, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    metadata.mimeType = response.headers.get('content-type') ?? undefined;
    buffer = await response.arrayBuffer();
  } else if (source instanceof File) {
    metadata.name = source.name;
    metadata.size = source.size;
    metadata.mimeType = source.type || undefined;
    metadata.extension = extractExtension(source.name);
    buffer = await source.arrayBuffer();
  } else if (source instanceof Blob) {
    metadata.size = source.size;
    metadata.mimeType = source.type || undefined;
    buffer = await source.arrayBuffer();
  } else if (source instanceof ArrayBuffer) {
    buffer = source;
  } else if (source instanceof Uint8Array) {
    buffer = source.buffer.slice(
      source.byteOffset,
      source.byteOffset + source.byteLength
    ) as ArrayBuffer;
  } else {
    throw new Error('Unsupported file source type');
  }

  metadata.size = metadata.size ?? buffer.byteLength;

  // Detect MIME from magic bytes if not already known
  const magicMime = detectMagicBytes(buffer);
  if (magicMime) {
    // Special handling for ZIP-based OOXML
    if (magicMime === 'application/zip') {
      const ooxmlMime = detectOoxmlType(buffer);
      if (ooxmlMime && ooxmlMime !== 'application/zip') {
        metadata.mimeType = ooxmlMime;
        // Set extension from OOXML type
        if (ooxmlMime.includes('wordprocessing')) metadata.extension = metadata.extension ?? '.docx';
        else if (ooxmlMime.includes('spreadsheet')) metadata.extension = metadata.extension ?? '.xlsx';
        else if (ooxmlMime.includes('presentation')) metadata.extension = metadata.extension ?? '.pptx';
      } else {
        metadata.mimeType = metadata.mimeType ?? magicMime;
      }
    } else if (magicMime === 'application/x-cfbf') {
      // Disambiguate legacy CFBF/OLE2 formats (DOC, XLS, PPT)
      if (metadata.extension) {
        metadata.mimeType = mimeFromExtension(metadata.extension) ?? magicMime;
      } else {
        const cfbf = detectCfbfType(buffer);
        if (cfbf) {
          metadata.mimeType = cfbf.mime;
          metadata.extension = cfbf.extension;
        } else {
          metadata.mimeType = magicMime;
        }
      }
    } else {
      metadata.mimeType = magicMime;
    }
  }

  // Fallback: derive MIME from extension
  if (!metadata.mimeType && metadata.extension) {
    metadata.mimeType = mimeFromExtension(metadata.extension);
  }

  return { buffer, metadata };
}
