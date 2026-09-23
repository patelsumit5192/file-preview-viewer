import React, { useEffect, useImperativeHandle, useRef, forwardRef, memo } from 'react';
import {
  FilePreviewViewer,
  type FileSource,
  type PreviewPlugin,
  type PreviewViewerOptions,
  type PreviewInstance,
} from '@patel.sumit51/core';

export interface FilePreviewProps {
  src: FileSource;
  plugins?: PreviewPlugin[];
  options?: PreviewViewerOptions;
  onLoading?: () => void;
  onLoaded?: (data: unknown) => void;
  onError?: (error: Error) => void;
  onPageChange?: (data: unknown) => void;
  onZoomChange?: (data: unknown) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface FilePreviewHandle {
  getInstance: () => PreviewInstance | null;
  getViewer: () => FilePreviewViewer | null;
  resetZoom: () => void;
  fitToPage: () => void;
  destroy: () => void;
}

export const FilePreview = memo(forwardRef<FilePreviewHandle, FilePreviewProps>(
  (
    {
      src,
      plugins = [],
      options = {},
      onLoading,
      onLoaded,
      onError,
      onPageChange,
      onZoomChange,
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
      resetZoom: () => viewerRef.current?.resetZoom(),
      fitToPage: () => viewerRef.current?.fitToPage(),
      destroy: () => viewerRef.current?.destroy(),
    }));

    // Initialize viewer on mount
    useEffect(() => {
      const viewer = new FilePreviewViewer();
      plugins.forEach(p => viewer.registerPlugin(p));
      viewerRef.current = viewer;

      const unsubs: Array<() => void> = [];
      if (onLoading) unsubs.push(viewer.on('loading', onLoading));
      if (onLoaded) unsubs.push(viewer.on('loaded', onLoaded));
      if (onError) unsubs.push(viewer.on('error', (e: unknown) => onError(e instanceof Error ? e : new Error(String(e)))));
      if (onPageChange) unsubs.push(viewer.on('page-change', onPageChange));
      if (onZoomChange) unsubs.push(viewer.on('zoom-change', onZoomChange));

      return () => {
        unsubs.forEach(fn => fn());
        viewer.destroy();
        viewerRef.current = null;
        instanceRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Preview file when src or options change
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
        style={{ width: '100%', height: '100%', ...style }}
      />
    );
  }
));

FilePreview.displayName = 'FilePreview';
