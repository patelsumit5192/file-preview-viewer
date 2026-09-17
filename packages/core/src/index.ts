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

// Types — re-export all
export type {
  FileSource,
  FileMetadata,
  FileInfo,
  ToolbarAction,
  ToolbarActionType,
  ToolbarGroup,
  Thumbnail,
  PreviewInstance,
  RenderContext,
  PreviewPlugin,
  PreviewViewerOptions,
  PreviewEvent,
  EventHandler,
  Unsubscribe,
} from './types';
