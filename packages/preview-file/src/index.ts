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
import type { PreviewPlugin } from '@patel.sumit51/core';

/**
 * Returns all built-in default preview plugins:
 * PDF, Word (DOCX), Excel (XLSX), PowerPoint (PPTX), CSV/TSV,
 * ZIP Archives, Markdown, 3D Models (STL/OBJ), Media (Images/Video/Audio/SVG), and Code/Text.
 */
export function getDefaultPlugins(): PreviewPlugin[] {
  return [
    pdfPlugin(),
    mediaPlugin(),
    docxPlugin(),
    excelPlugin(),
    pptxPlugin(),
    csvPlugin(),
    archivePlugin(),
    markdownPlugin(),
    threeDPlugin(),
    codePlugin(),
  ];
}

/**
 * Universal File Preview Viewer.
 * Pre-loads all format plugins by default so any file format can be previewed immediately.
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
  csvPlugin,
  archivePlugin,
  markdownPlugin,
  threeDPlugin,
  codePlugin,
};

// Re-export all core types, utilities, controllers, and events
export * from '@patel.sumit51/core';
