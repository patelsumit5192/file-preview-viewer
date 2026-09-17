import { FilePreviewViewer as CoreViewer } from '@patel.sumit51/core';
import { pdfPlugin } from '@patel.sumit51/plugin-pdf';
import { mediaPlugin } from '@patel.sumit51/plugin-media';
import { docxPlugin } from '@patel.sumit51/plugin-docx';
import { excelPlugin } from '@patel.sumit51/plugin-excel';
import { csvPlugin } from '@patel.sumit51/plugin-csv';
import { codePlugin } from '@patel.sumit51/plugin-code';
import { archivePlugin } from '@patel.sumit51/plugin-archive';
import { markdownPlugin } from '@patel.sumit51/plugin-markdown';
import { pptxPlugin } from '@patel.sumit51/plugin-pptx';
import { threeDPlugin } from '@patel.sumit51/plugin-3d';
import { rtfPlugin } from '@patel.sumit51/plugin-rtf';
import { htmlPreviewPlugin } from '@patel.sumit51/plugin-html-preview';
import { openDocumentPlugin } from '@patel.sumit51/plugin-opendocument';
import { docPlugin } from '@patel.sumit51/plugin-doc';
import { pptPlugin } from '@patel.sumit51/plugin-ppt';
import type { PreviewPlugin } from '@patel.sumit51/core';

/**
 * Returns all built-in default preview plugins:
 * PDF, Word (DOCX, DOCM, DOTX, DOTM), Legacy Word (DOC, DOT),
 * Excel/Spreadsheets (XLSX, XLS, XLSM, XLSB, XLTX, XLTM, ODS),
 * PowerPoint (PPTX, PPSX, PPTM, PPSM, POTX, POTM), Legacy PowerPoint (PPT, PPS, POT),
 * OpenDocument Suite (ODT, ODP, ODS, ODG, ODF), Rich Text (RTF),
 * Sandboxed HTML, CSV/TSV, ZIP Archives, Markdown, 3D Models (STL/OBJ),
 * Media (Images/Video/Audio/SVG), and Code/Text (190+ languages).
 */
export function getDefaultPlugins(): PreviewPlugin[] {
  return [
    pdfPlugin(),
    mediaPlugin(),
    docxPlugin(),
    excelPlugin(),
    pptxPlugin(),
    docPlugin(),
    pptPlugin(),
    openDocumentPlugin(),
    rtfPlugin(),
    htmlPreviewPlugin(),
    csvPlugin(),
    archivePlugin(),
    markdownPlugin(),
    threeDPlugin(),
    codePlugin(),
  ];
}

/**
 * Universal File Preview Viewer.
 * Pre-loads all format plugins by default so 50+ file formats can be previewed immediately.
 */
export class FilePreviewViewer extends CoreViewer {
  constructor(options?: { autoRegisterDefaults?: boolean }) {
    super();
    if (options?.autoRegisterDefaults !== false) {
      this.registerPlugins(getDefaultPlugins());
    }
  }
}

// Re-export individual plugins for custom configurations
export {
  pdfPlugin,
  mediaPlugin,
  docxPlugin,
  excelPlugin,
  pptxPlugin,
  docPlugin,
  pptPlugin,
  openDocumentPlugin,
  rtfPlugin,
  htmlPreviewPlugin,
  csvPlugin,
  archivePlugin,
  markdownPlugin,
  threeDPlugin,
  codePlugin,
};

// Re-export all core classes, controllers, and types
export * from '@patel.sumit51/core';
