import { FilePreviewViewer as CoreViewer } from '@patel.sumit51/core';
import { pdfPlugin } from '@patel.sumit51/plugin-pdf';
import { mediaPlugin } from '@patel.sumit51/plugin-media';
import { docxPlugin } from '@patel.sumit51/plugin-docx';
import { excelPlugin } from '@patel.sumit51/plugin-excel';
import { csvPlugin } from '@patel.sumit51/plugin-csv';
import { codePlugin } from '@patel.sumit51/plugin-code';
import type { PreviewPlugin } from '@patel.sumit51/core';

/**
 * Returns all built-in default preview plugins:
 * PDF, Media (Images/Video/Audio/SVG), Word (DOCX), Excel (XLSX), CSV/TSV, and Code/Text.
 */
export function getDefaultPlugins(): PreviewPlugin[] {
  return [
    pdfPlugin(),
    mediaPlugin(),
    docxPlugin(),
    excelPlugin(),
    csvPlugin(),
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
  csvPlugin,
  codePlugin,
};

// Re-export all core types, utilities, controllers, and events
export * from '@patel.sumit51/core';
