/**
 * Supported file input sources.
 * Accepts URL strings, File objects, Blobs, ArrayBuffers, or Uint8Arrays.
 */
export type FileSource = string | File | Blob | ArrayBuffer | Uint8Array;

/** Metadata extracted from a file source */
export interface FileMetadata {
  /** Original filename (if available) */
  name?: string;
  /** File size in bytes */
  size?: number;
  /** Detected MIME type */
  mimeType?: string;
  /** File extension (lowercase, with dot, e.g. '.pdf') */
  extension?: string;
}

/** Information about a resolved file, ready for plugin matching */
export interface FileInfo {
  metadata: FileMetadata;
  buffer: ArrayBuffer;
}

/** Toolbar action types */
export type ToolbarActionType = 'button' | 'toggle' | 'range' | 'input' | 'separator' | 'page-nav';

/** Toolbar action group names for visual grouping */
export type ToolbarGroup = 'navigation' | 'zoom' | 'view' | 'actions';

/** Represents a single toolbar action/control */
export interface ToolbarAction {
  /** Unique action identifier */
  id: string;
  /** SVG icon markup string */
  icon: string;
  /** Accessible label */
  label: string;
  /** Type of control to render */
  type: ToolbarActionType;
  /** Visual group placement */
  group: ToolbarGroup;
  /** Whether the action is currently enabled */
  enabled?: boolean;
  /** Whether a toggle is currently active */
  active?: boolean;
  /** Execute the action */
  execute: (...args: unknown[]) => void;
  /** For 'range' type: min/max/step/value */
  min?: number;
  max?: number;
  step?: number;
  value?: number;
}

/** Represents a thumbnail in the sidebar */
export interface Thumbnail {
  /** Page/sheet/frame index */
  index: number;
  /** Display label (e.g., "Page 1", "Sheet: Revenue") */
  label: string;
  /** Renders the thumbnail into a canvas element */
  render: (canvas: HTMLCanvasElement) => Promise<void>;
}

/** Instance returned after a file is rendered — exposes controls */
export interface PreviewInstance {
  // --- Lifecycle ---
  /** Clean up all resources */
  destroy(): void;

  // --- Zoom ---
  zoomIn?(): void;
  zoomOut?(): void;
  getZoom?(): number;
  setZoom?(level: number): void;
  fitToPage?(): void;
  fitToWidth?(): void;

  // --- Pagination / Navigation ---
  goToPage?(page: number): void;
  getPageCount?(): number;
  getCurrentPage?(): number;

  // --- Rotation ---
  rotateCW?(): void;
  rotateCCW?(): void;
  getRotation?(): number;

  // --- Media Playback ---
  play?(): void;
  pause?(): void;
  isPlaying?(): boolean;
  fastForward?(seconds?: number): void;
  rewind?(seconds?: number): void;
  setPlaybackRate?(rate: number): void;
  getPlaybackRate?(): number;

  // --- Thumbnails ---
  getThumbnails?(): Thumbnail[] | Promise<Thumbnail[]>;
  toggleThumbnails?(): void;

  // --- Export ---
  download?(): void;
  print?(): void;

  // --- Extensibility ---
  [key: string]: unknown;
}

/** Context passed to a plugin's render function */
export interface RenderContext {
  /** The container DOM element to render into */
  container: HTMLElement;
  /** Original file source */
  source: FileSource;
  /** Resolved file metadata */
  metadata: FileMetadata;
  /** File content as ArrayBuffer */
  buffer: ArrayBuffer;
  /** Viewer options */
  options: PreviewViewerOptions;
  /** AbortSignal for cancellation */
  signal: AbortSignal;
  /** Emit an event to the viewer */
  emit: (event: string, payload?: unknown) => void;
}

/** Plugin interface — each file format renderer implements this */
export interface PreviewPlugin {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** File extensions this plugin handles (e.g., ['.pdf']) */
  extensions: string[];
  /** MIME types this plugin handles */
  mimeTypes: string[];
  /** Priority when multiple plugins match (higher = preferred) */
  weight?: number;
  /** Check if this plugin can handle the given file */
  supports(file: FileInfo): boolean | Promise<boolean>;
  /** Return toolbar actions for the rendered instance */
  getToolbarActions(instance: PreviewInstance): ToolbarAction[];
  /** Render the file into the container */
  render(ctx: RenderContext): Promise<PreviewInstance>;
}

/** Configuration to selectively enable or disable individual toolbar functions/buttons */
export interface ToolbarConfig {
  /** Page navigation (< [1] / N >) */
  pageNav?: boolean;
  pagination?: boolean;
  prevPage?: boolean;
  nextPage?: boolean;
  /** Zoom controls */
  zoomIn?: boolean;
  zoomOut?: boolean;
  fitPage?: boolean;
  fitToPage?: boolean;
  fitWidth?: boolean;
  zoomReset?: boolean;
  /** View controls */
  rotate?: boolean;
  rotateCW?: boolean;
  rotateCCW?: boolean;
  fullscreen?: boolean;
  thumbnails?: boolean;
  /** Action controls */
  download?: boolean;
  print?: boolean;
  openWindow?: boolean;
  openSeparateWindow?: boolean;
  copy?: boolean;
  /** Media controls */
  play?: boolean;
  pause?: boolean;
  fastForward?: boolean;
  rewind?: boolean;
  speed?: boolean;
}

/** Viewer configuration options */
export interface PreviewViewerOptions extends ToolbarConfig {
  /** Color theme */
  theme?: 'light' | 'dark' | 'auto';
  /** Locale for UI labels */
  locale?: string;
  /** Initial zoom level (1.0 = 100%) */
  zoom?: number;
  /** Initial page number (1-based) */
  page?: number;
  /** Show the toolbar */
  showToolbar?: boolean;
  /** Detailed toolbar configuration (or boolean to show/hide entire toolbar) */
  toolbar?: boolean | (ToolbarConfig & Record<string, boolean | undefined>);
  /** Toolbar position */
  toolbarPosition?: 'top' | 'bottom';
  /** Fit mode: 'page' (fill frame width with minimal margins) or 'width' */
  fitMode?: 'page' | 'width';
  /** Show thumbnail sidebar initially */
  showThumbnails?: boolean;
  /** Whether to display the file name / title bar above the toolbar in the preview panel (defaults to true) */
  showFileName?: boolean;
  /** Custom file name / title override to display */
  fileName?: string;
  /** Custom CSS class for the container */
  className?: string;
  /** Plugin-specific options */
  pluginOptions?: Record<string, unknown>;
  /** Optional file metadata overrides (name, extension, mimeType, etc.) */
  metadata?: FileMetadata;
  /** Custom URL to navigate when "Open in Separate Full Window" is clicked */
  standaloneViewerUrl?: string;
  /** Custom handler for opening preview in a separate window */
  onOpenSeparateWindow?: (payload: { buffer: ArrayBuffer; metadata: FileMetadata; options: PreviewViewerOptions }) => Window | null;
  /** Internal flag: true when viewer is rendered inside separate full window */
  _isSeparateWindow?: boolean;
  /** Allow custom/plugin-specific options */
  [key: string]: unknown;
}

/** Events emitted by the viewer */
export type PreviewEvent =
  | 'loading'
  | 'loaded'
  | 'error'
  | 'page-change'
  | 'zoom-change'
  | 'rotate'
  | 'destroy';

/** Event handler function */
export type EventHandler<T = unknown> = (data: T) => void;

/** Unsubscribe function returned by on() */
export type Unsubscribe = () => void;
