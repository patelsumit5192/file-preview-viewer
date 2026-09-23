import React, { useEffect, useImperativeHandle, useRef, forwardRef, memo } from 'react';
import {
  FilePreviewViewer,
  getDefaultPlugins,
  type FileSource,
  type PreviewPlugin,
  type PreviewViewerOptions,
  type PreviewInstance,
} from './index';

export interface FilePreviewProps {
  /** File to preview. Accepts URL string, File, Blob, ArrayBuffer, or Uint8Array */
  src: FileSource;
  /** Optional custom plugins list. If omitted, all default plugins (PDF, Word, Excel, CSV, Media, Code) are loaded */
  plugins?: PreviewPlugin[];
  /** Viewer options (theme, showToolbar, toolbarPosition, showThumbnails, etc.) */
  options?: PreviewViewerOptions;
  /** Triggered when loading starts */
  onLoading?: () => void;
  /** Triggered when preview is successfully loaded */
  onLoaded?: (data: unknown) => void;
  /** Triggered when an error occurs */
  onError?: (error: Error) => void;
  /** Triggered on page or sheet change */
  onPageChange?: (data: unknown) => void;
  /** Triggered on zoom level change */
  onZoomChange?: (data: unknown) => void;
  /** Triggered on orientation rotation change */
  onRotate?: (data: unknown) => void;
  /** Triggered when viewer is destroyed */
  onDestroy?: () => void;
  /** Custom wrapper CSS class name */
  className?: string;
  /** Custom wrapper inline style */
  style?: React.CSSProperties;
}

export interface FilePreviewHandle {
  getInstance: () => PreviewInstance | null;
  getViewer: () => FilePreviewViewer | null;
  destroy: () => void;
}

export const FilePreview = memo(forwardRef<FilePreviewHandle, FilePreviewProps>(
  (
    {
      src,
      plugins,
      options = {},
      onLoading,
      onLoaded,
      onError,
      onPageChange,
      onZoomChange,
      onRotate,
      onDestroy,
      className,
      style,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<FilePreviewViewer | null>(null);
    const instanceRef = useRef<PreviewInstance | null>(null);

    useImperativeHandle(ref, () => ({
      getInstance: () => instanceRef.current,
      getViewer: () => viewerRef.current,
      destroy: () => viewerRef.current?.destroy(),
    }));

    useEffect(() => {
      const viewer = new FilePreviewViewer({ autoRegisterDefaults: false });
      const activePlugins = plugins && plugins.length > 0 ? plugins : getDefaultPlugins();
      viewer.registerPlugins(activePlugins);
      viewerRef.current = viewer;

      const unsubs: Array<() => void> = [];
      if (onLoading) unsubs.push(viewer.on('loading', onLoading));
      if (onLoaded) unsubs.push(viewer.on('loaded', onLoaded));
      if (onError) unsubs.push(viewer.on('error', (e: unknown) => onError(e instanceof Error ? e : new Error(String(e)))));
      if (onPageChange) unsubs.push(viewer.on('page-change', onPageChange));
      if (onZoomChange) unsubs.push(viewer.on('zoom-change', onZoomChange));
      if (onRotate) unsubs.push(viewer.on('rotate', onRotate));
      if (onDestroy) unsubs.push(viewer.on('destroy', onDestroy));

      return () => {
        unsubs.forEach(fn => fn());
        viewer.destroy();
        viewerRef.current = null;
        instanceRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (!viewerRef.current || !containerRef.current || !src) return;

      const doPreview = async () => {
        try {
          instanceRef.current = await viewerRef.current!.preview(
            containerRef.current!,
            src,
            options
          );
        } catch (error: unknown) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          if (onError) {
            onError(error instanceof Error ? error : new Error(String(error)));
          }
        }
      };

      doPreview();
    }, [src, options, onError]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', ...style }}
      />
    );
  }
));

FilePreview.displayName = 'FilePreview';
export default FilePreview;
