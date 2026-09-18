// Core engine
export { FilePreviewViewer } from './engine';

// Event emitter
export { EventEmitter } from './events';

// Detection utilities
export {
  detectMagicBytes,
  detectOoxmlType,
  extractExtension,
  mimeFromExtension,
  sourceToArrayBuffer,
} from './detect';

// Utilities
export {
  sanitizeHTML,
  sanitizeSVG,
  downloadFile,
  printElement,
  formatFileSize,
  debounce,
  clamp,
  createElement,
} from './utils';

// Toolbar
export { ToolbarController } from './toolbar/toolbar-controller';
export { ThumbnailPanel } from './thumbnail/thumbnail-panel';

// Cross-window document transfer
export { saveTransferPayload, getTransferPayload, type TransferPayload } from './transfer';

// Types — re-export all
export type {
  FileSource,
  FileMetadata,
  FileInfo,
  ToolbarAction,
  ToolbarActionType,
  ToolbarGroup,
  ToolbarConfig,
  Thumbnail,
  PreviewInstance,
  RenderContext,
  PreviewPlugin,
  PreviewViewerOptions,
  PreviewEvent,
  EventHandler,
  Unsubscribe,
} from './types';

// CFBF / OLE2 Binary Container Reader
export { CfbfReader, type CfbfEntry } from './cfbf/cfbf-reader';
