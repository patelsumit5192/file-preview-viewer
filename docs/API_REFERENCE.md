# API Reference — Properties, Methods, Events & Framework Guide

This document provides a comprehensive, exhaustive reference for all **properties**, **configuration options**, **methods**, and **lifecycle events** in `@files-preview-app/preview-file`, along with detailed guides on how to configure and invoke methods across **React**, **Vue 3**, **Angular**, and **Vanilla JavaScript / TypeScript**.

---

## Table of Contents

1. [Supported Input Sources (`FileSource`)](#1-supported-input-sources-filesource)
2. [Viewer Options Reference (`PreviewViewerOptions`)](#2-viewer-options-reference-previewvieweroptions)
3. [Granular Toolbar Configuration (`ToolbarConfig`)](#3-granular-toolbar-configuration-toolbarconfig)
4. [Viewer Engine Methods (`FilePreviewViewer`)](#4-viewer-engine-methods-filepreviewviewer)
5. [Active Instance Methods (`PreviewInstance`)](#5-active-instance-methods-previewinstance)
6. [Events Reference (`PreviewEvent`)](#6-events-reference-previewevent)
7. [Framework Method Configuration & Usage Guide](#7-framework-method-configuration--usage-guide)
   - [7.1 React & Next.js](#71-react--nextjs-files-preview-apppreview-filereact)
   - [7.2 Vue 3 & Nuxt 3](#72-vue-3--nuxt-3-files-preview-apppreview-filevue)
   - [7.3 Angular 14+](#73-angular-14-files-preview-apppreview-fileangular)
   - [7.4 Vanilla JavaScript / TypeScript](#74-vanilla-javascript--typescript-files-preview-apppreview-file)
8. [Extension-Wise Method & Feature Compatibility Matrix](#8-extension-wise-method--feature-compatibility-matrix)

---

## 1. Supported Input Sources (`FileSource`)

The `src` property accepts any of the following types:

```typescript
export type FileSource = string | File | Blob | ArrayBuffer | Uint8Array;
```

| Source Type | Example | When to Use |
|---|---|---|
| **Remote URL** | `'https://example.com/document.pdf'` | Files hosted on CDN, S3, or remote HTTPS endpoints (CORS enabled). |
| **Local URL / Path** | `'/samples/report.xlsx'` | Static assets hosted within your app's `public/` directory. |
| **Blob Object** | `new Blob([buffer], { type: 'application/pdf' })` | Dynamically downloaded binary responses from `fetch()` or Axios. |
| **File Object** | `event.target.files[0]` | Files selected directly by user from `<input type="file">` or dropzone. |
| **ArrayBuffer** | `await response.arrayBuffer()` | Raw binary data stored in memory or Web Workers. |
| **Uint8Array** | `new Uint8Array(buffer)` | Typed byte arrays or chunks received from streams. |
| **Data URI** | `'data:image/png;base64,iVBORw...'` | Base64-encoded file strings. |

---

## 2. Viewer Options Reference (`PreviewViewerOptions`)

Passed via the `options` prop in React, Vue, Angular, or the third parameter to `viewer.preview(container, src, options)`:

```typescript
export interface PreviewViewerOptions extends ToolbarConfig {
  theme?: 'light' | 'dark' | 'auto';
  locale?: string;
  zoom?: number;
  page?: number;
  showToolbar?: boolean;
  toolbar?: boolean | ToolbarConfig;
  toolbarPosition?: 'top' | 'bottom';
  fitMode?: 'page' | 'width';
  showThumbnails?: boolean;
  showFileName?: boolean;
  fileName?: string;
  className?: string;
  pluginOptions?: Record<string, unknown>;
  metadata?: FileMetadata;
  standaloneViewerUrl?: string;
  onOpenSeparateWindow?: (payload: { buffer: ArrayBuffer; metadata: FileMetadata; options: PreviewViewerOptions }) => Window | null;
  [key: string]: unknown;
}
```

### Options Description

| Property | Type | Default | Description |
|---|---|:---:|---|
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | Color theme for the viewer container and toolbar. `'auto'` detects system dark mode via `prefers-color-scheme`. |
| `showToolbar` | `boolean` | `true` | When `false`, completely hides the top/bottom toolbar UI. |
| `toolbar` | `boolean \| ToolbarConfig` | `true` | Fine-grained boolean flags to show/hide individual toolbar buttons (see [Section 3](#3-granular-toolbar-configuration-toolbarconfig)). |
| `toolbarPosition`| `'top' \| 'bottom'` | `'top'` | Visual placement of toolbar above or below content. |
| `showFileName` | `boolean` | `true` | When `true`, renders the file name and format badge (`📄 filename.ext [EXT]`) in the title bar above the toolbar. Set `false` to hide. |
| `fileName` | `string` | `undefined` | Custom file title override displayed in the title bar. If omitted, uses the filename from `src` or metadata. |
| `showThumbnails`| `boolean` | `false` | When `true`, automatically opens the thumbnail sidebar panel immediately upon initial load. |
| `fitMode` | `'page' \| 'width'` | `'page'` | Preferred fit calculation strategy. |
| `zoom` | `number` | `1.0` | Initial zoom scale factor (`1.0` = 100%, `1.5` = 150%, `0.8` = 80%). |
| `page` | `number` | `1` | Initial page number (1-based) to jump to after rendering completes. |
| `locale` | `string` | `'en'` | UI locale language code for accessible button tooltips. |
| `className` | `string` | `''` | Custom CSS class name injected into the root `.fp-viewer` container element. |
| `metadata` | `FileMetadata` | `undefined` | Manual override object for file attributes: `{ name?: string; extension?: string; mimeType?: string; size?: number }`. |
| `standaloneViewerUrl` | `string` | `undefined` | Custom URL opened when the user clicks the "Open in Separate Full Window" button (`open-window`). |
| `onOpenSeparateWindow` | `function` | `undefined` | Custom hook to intercept and handle the separate window launch event. |
| `pluginOptions`| `Record<string, unknown>` | `{}` | Format-specific configuration passed directly to underlying renderer plugins (e.g. PDF.js worker options). |

---

## 3. Granular Toolbar Configuration (`ToolbarConfig`)

You can selectively enable or disable individual toolbar buttons by setting them in `options` or `options.toolbar`:

```typescript
const options: PreviewViewerOptions = {
  theme: 'light',
  showToolbar: true,
  toolbar: {
    // Navigation
    pageNav: true,       // < 1 / N > navigation
    thumbnails: true,    // Page / Sheet Thumbnails button

    // Zoom & View
    zoomIn: true,        // Zoom in button
    zoomOut: true,       // Zoom out button
    fitPage: true,       // Fit to Page button (where applicable)
    rotate: true,        // Rotate clockwise button (where applicable)
    fullscreen: true,    // Fullscreen toggle button

    // Actions
    download: true,      // Download original file button
    print: true,         // Print document button
    copy: true,          // Copy text content button (plain text / code)
    openWindow: true,    // Open in separate browser window / tab button
  }
};
```

### Available Toolbar Button Flags

| Flag Key | Aliases | Description | Default |
|---|---|---|:---:|
| `pageNav` | `pagination`, `prevPage`, `nextPage` | Show page/sheet navigation controls (`<`, `[input] / total`, `>`). | `true` |
| `thumbnails` | `showThumbnails` | Show sidebar thumbnail toggle button. | `true` |
| `zoomIn` | — | Show Zoom In (`+`) button. | `true` |
| `zoomOut` | — | Show Zoom Out (`-`) button. | `true` |
| `fitPage` | `fitToPage`, `fitWidth` | Show Fit to Page / Fit to Width button. | `true` (where supported) |
| `resetZoom` | `zoomReset` | Show Reset Zoom button to restore original/fit-to-page zoom level. | `true` (where supported) |
| `rotate` | `rotateCW`, `rotateCCW` | Show Rotate Clockwise button. | `true` (where supported) |
| `fullscreen` | — | Show Fullscreen expand/collapse button. | `true` |
| `download` | — | Show Download file button. | `true` |
| `print` | — | Show Print dialog button. | `true` |
| `copy` | — | Show Copy Content button (for text/code). | `true` (where supported) |
| `openWindow` | `openSeparateWindow` | Show Open in Separate Full Window button. | `true` |
| `play`, `pause`, `speed` | — | Show media playback controls (audio/video). | `true` (media) |

---

## 4. Viewer Engine Methods (`FilePreviewViewer`)

Available on `FilePreviewViewer` instances (or via `ref.current.getViewer()` in React/Vue, or `preview.getViewer()` in Angular):

| Method | Parameters | Return Type | Description |
|---|---|---|---|
| `preview()` | `container: HTMLElement, source: FileSource, options?: PreviewViewerOptions` | `Promise<PreviewInstance>` | Loads, decodes, and mounts the preview into the target DOM element. Cleans up any prior file automatically. |
| `destroy()` | None | `void` | Releases memory, cancels in-flight fetches/workers, destroys the active instance, and unbinds listeners. |
| `getInstance()` | None | `PreviewInstance \| null` | Returns the currently active document instance for controlling zoom, pages, etc. |
| `on()` | `event: string, handler: EventHandler` | `Unsubscribe: () => void` | Subscribes to lifecycle events. Returns an unsubscribe function. |
| `openInSeparateWindow()` | None | `Window \| null` | Clones current file buffer and opens it in a full-screen isolated browser tab. |
| `setShowFileName(show)` | `show: boolean` | `void` | Dynamically toggles the file name / format badge title bar above the toolbar. |
| `setFileName(name)` | `name: string` | `void` | Dynamically changes the displayed file title in the preview panel. |
| `setToolbarConfig(config)`| `config: ToolbarConfig` | `void` | Dynamically updates enabled/disabled state of toolbar buttons. |
| `getToolbarConfig()` | None | `ToolbarConfig` | Returns the current toolbar configuration object. |
| `hideToolbarAction(id)` | `actionId: string` | `void` | Hides a specific toolbar button by its action ID (e.g. `'print'`, `'download'`). |
| `showToolbarAction(id)` | `actionId: string` | `void` | Shows a previously hidden toolbar action. |
| `enableToolbarAction(id)`| `actionId: string` | `void` | Enables an action button. |
| `disableToolbarAction(id)`| `actionId: string` | `void` | Disables (grays out) an action button. |
| `toggleThumbnails()` | None | `void` | Opens or closes the thumbnail sidebar panel. |
| `toggleFullscreen()` | None | `void` | Toggles browser fullscreen on the viewer container. |
| `fitToPage()` | None | `void` | Programmatically triggers fit-to-page calculation on active document. |
| `resetZoom()` | None | `void` | Programmatically resets zoom level and scroll position to default fit-to-page state. |
| `zoomIn()` | None | `void` | Programmatically zooms in. |
| `zoomOut()` | None | `void` | Programmatically zooms out. |
| `setZoom(level)` | `level: number` | `void` | Programmatically sets exact zoom scale (e.g., `1.5`). |
| `getZoom()` | None | `number` | Returns active zoom factor (defaults to `1.0`). |
| `rotateCW()` | None | `void` | Rotates document or image 90° clockwise. |
| `rotateCCW()` | None | `void` | Rotates document or image 90° counter-clockwise. |
| `goToPage(page)` | `page: number` | `void` | Navigates to a specific page or sheet (1-based index). |
| `nextPage()` | None | `void` | Navigates to the next page or sheet. |
| `prevPage()` | None | `void` | Navigates to the previous page or sheet. |
| `getPageCount()` | None | `number` | Returns total page/sheet count. |
| `getCurrentPage()` | None | `number` | Returns current active page number (1-based). |
| `download()` | None | `void` | Triggers a file download using original file buffer and detected MIME type. |
| `print()` | None | `void` | Opens the native browser print preview dialog. |
| `registerPlugin(plugin)` | `plugin: PreviewPlugin` | `this` | Registers a custom renderer plugin. |
| `registerPlugins(list)` | `plugins: PreviewPlugin[]` | `this` | Registers multiple custom renderer plugins. |

---

## 5. Active Instance Methods (`PreviewInstance`)

When a file is rendered, `viewer.preview()` resolves with a `PreviewInstance`. You can access this via:
- **React**: `ref.current?.getInstance()`
- **Vue 3**: `previewRef.value?.getInstance()`
- **Angular**: `this.previewComponent.getInstance()`
- **Vanilla**: `const instance = await viewer.preview(...)`

| Method | Parameters | Return Type | Description |
|---|---|---|---|
| `destroy()` | None | `void` | Destroys instance resources and unbinds observers. |
| `zoomIn()` | None | `void` | Increments zoom scale by 15-20%. |
| `zoomOut()` | None | `void` | Decrements zoom scale by 15-20%. |
| `getZoom()` | None | `number` | Gets current zoom number (1.0 = 100%). |
| `setZoom(level)` | `level: number` | `void` | Sets absolute zoom scale. |
| `fitToPage()` | None | `void` | Fits page or table to container width. |
| `resetZoom()` | None | `void` | Resets zoom and container scroll offset to default fit-to-page state. |
| `fitToWidth()` | None | `void` | Fits content width to container. |
| `goToPage(page)` | `page: number` | `void` | Jumps to specific page/sheet (1-indexed). |
| `getPageCount()` | None | `number` | Total number of pages, sheets, or slides. |
| `getCurrentPage()` | None | `number` | Active page/sheet number (1-indexed). |
| `rotateCW()` | None | `void` | Rotates 90° clockwise. |
| `rotateCCW()` | None | `void` | Rotates 90° counter-clockwise. |
| `getRotation()` | None | `number` | Current rotation in degrees (0, 90, 180, 270). |
| `getThumbnails()` | None | `Thumbnail[] \| Promise<Thumbnail[]>` | Returns thumbnail items rendered in sidebar. |
| `toggleThumbnails()`| None | `void` | Toggles the thumbnail sidebar. |
| `download()` | None | `void` | Downloads current file. |
| `print()` | None | `void` | Prints current document. |
| `copy()` | None | `void` | Copies text to system clipboard (Code / Plain Text). |
| `play()` | None | `void` | Plays media (Audio / Video). |
| `pause()` | None | `void` | Pauses media. |
| `isPlaying()` | None | `boolean` | Checks whether media is playing. |

---

## 6. Events Reference (`PreviewEvent`)

Subscribe to viewer events using framework event props (`onLoaded`, `@loaded`, `(loaded)`) or `viewer.on('event', handler)`.

```typescript
export type PreviewEvent =
  | 'loading'
  | 'loaded'
  | 'error'
  | 'page-change'
  | 'zoom-change'
  | 'rotate'
  | 'destroy';
```

| Event | Payload Type | Description |
|---|---|---|
| `'loading'` | `{ source: FileSource }` | Fired when file download, buffer parsing, or decoding begins. |
| `'loaded'` | `{ metadata: FileMetadata, plugin: string }` | Fired when the file is successfully parsed and mounted. Contains file name, size, MIME type, and rendering plugin ID. |
| `'error'` | `Error` | Fired when network, decoding, or format parsing encounters an error. |
| `'page-change'`| `{ page: number, total?: number }` | Fired when page, worksheet tab, or presentation slide changes. |
| `'zoom-change'`| `{ zoom: number }` | Fired when zoom scale changes. |
| `'rotate'` | `{ rotation: number }` | Fired when document rotation changes (0, 90, 180, 270). |
| `'destroy'` | `null` | Fired when viewer is destroyed and cleaned up. |

---

## 7. Framework Method Configuration & Usage Guide

### 7.1 React & Next.js (`@files-preview-app/preview-file/react`)

#### Import & Handle Types
```tsx
import React, { useRef, useState } from 'react';
import { FilePreview, type FilePreviewHandle } from '@files-preview-app/preview-file/react';
import '@files-preview-app/preview-file/styles.css';
```

#### Calling Methods via `useRef<FilePreviewHandle>`
The `ref` provides three methods:
1. `getInstance()`: returns `PreviewInstance | null` (document-level methods)
2. `getViewer()`: returns `FilePreviewViewer | null` (viewer-level methods)
3. `destroy()`: destroys viewer and cleans up DOM

#### Complete Working React Example
```tsx
import React, { useRef, useState } from 'react';
import { FilePreview, type FilePreviewHandle } from '@files-preview-app/preview-file/react';
import '@files-preview-app/preview-file/styles.css';

export function DocumentViewer() {
  const previewRef = useRef<FilePreviewHandle>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fileNameVisible, setFileNameVisible] = useState(true);

  // --- Programmatic Method Calls ---
  const handleZoomIn = () => previewRef.current?.getInstance()?.zoomIn?.();
  const handleZoomOut = () => previewRef.current?.getInstance()?.zoomOut?.();
  const handleFitToPage = () => previewRef.current?.getInstance()?.fitToPage?.();
  const handleRotate = () => previewRef.current?.getInstance()?.rotateCW?.();
  const handleDownload = () => previewRef.current?.getInstance()?.download?.();
  const handlePrint = () => previewRef.current?.getInstance()?.print?.();

  const handleNextPage = () => {
    const next = currentPage + 1;
    if (next <= totalPages) {
      previewRef.current?.getInstance()?.goToPage?.(next);
    }
  };

  const handlePrevPage = () => {
    const prev = currentPage - 1;
    if (prev >= 1) {
      previewRef.current?.getInstance()?.goToPage?.(prev);
    }
  };

  const toggleTitleBar = () => {
    const nextState = !fileNameVisible;
    setFileNameVisible(nextState);
    // Call viewer-level method
    previewRef.current?.getViewer()?.setShowFileName(nextState);
  };

  const openSeparateWindow = () => {
    previewRef.current?.getViewer()?.openInSeparateWindow();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '16px' }}>
      {/* Custom Control Bar Calling Viewer & Instance Methods */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <button onClick={handlePrevPage} disabled={currentPage <= 1}>◀ Prev</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button onClick={handleNextPage} disabled={currentPage >= totalPages}>Next ▶</button>

        <span style={{ borderLeft: '1px solid #ccc', margin: '0 8px', height: '20px' }} />

        <button onClick={handleZoomIn}>Zoom +</button>
        <button onClick={handleZoomOut}>Zoom -</button>
        <button onClick={handleFitToPage}>Fit View</button>
        <button onClick={handleRotate}>Rotate</button>

        <span style={{ borderLeft: '1px solid #ccc', margin: '0 8px', height: '20px' }} />

        <button onClick={toggleTitleBar}>Toggle Title Bar</button>
        <button onClick={openSeparateWindow}>Open Full Window</button>
        <button onClick={handleDownload}>Download</button>
        <button onClick={handlePrint}>Print</button>
      </div>

      {/* Viewer Component */}
      <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <FilePreview
          ref={previewRef}
          src="https://example.com/financial-report.xlsx"
          options={{
            theme: 'light',
            showToolbar: true,
            showFileName: true,
            toolbarPosition: 'top'
          }}
          onLoading={() => console.log('File is loading...')}
          onLoaded={(info: any) => {
            console.log('Loaded:', info);
            const count = previewRef.current?.getInstance()?.getPageCount?.() ?? 1;
            setTotalPages(count);
          }}
          onError={(err) => console.error('Failed to preview:', err)}
          onPageChange={(data: any) => {
            if (data?.page) setCurrentPage(data.page);
          }}
          onZoomChange={(data: any) => console.log('Zoom:', data?.zoom)}
          onRotate={(data: any) => console.log('Rotation:', data?.rotation)}
          onDestroy={() => console.log('Viewer destroyed')}
        />
      </div>
    </div>
  );
}
```

#### Next.js (Client Component)
```tsx
'use client';

import dynamic from 'next/dynamic';
import '@files-preview-app/preview-file/styles.css';

const FilePreview = dynamic(
  () => import('@files-preview-app/preview-file/react').then((m) => m.FilePreview),
  { ssr: false }
);

export default function Page() {
  return (
    <div style={{ height: '850px' }}>
      <FilePreview src="/sample.pdf" />
    </div>
  );
}
```

---

### 7.2 Vue 3 & Nuxt 3 (`@files-preview-app/preview-file/vue`)

#### Composition API (`<script setup lang="ts">`)
The component template ref exposes:
1. `getInstance()`: returns `PreviewInstance | null`
2. `getViewer()`: returns `FilePreviewViewer | null`
3. `destroy()`: clean up

#### Complete Working Vue 3 Example
```vue
<template>
  <div class="viewer-container" style="height: 100vh; display: flex; flex-direction: column; padding: 16px;">
    <!-- External Buttons Calling Methods -->
    <div class="actions" style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center;">
      <button @click="prevPage" :disabled="currentPage <= 1">◀ Prev</button>
      <span>{{ currentPage }} / {{ totalPages }}</span>
      <button @click="nextPage" :disabled="currentPage >= totalPages">Next ▶</button>

      <span style="border-left: 1px solid #ccc; margin: 0 8px; height: 20px;"></span>

      <button @click="zoomIn">Zoom In (+)</button>
      <button @click="zoomOut">Zoom Out (-)</button>
      <button @click="rotate">Rotate</button>
      <button @click="openSeparateWindow">Open in Separate Window</button>
      <button @click="download">Download</button>
      <button @click="print">Print</button>
    </div>

    <!-- FilePreview Component -->
    <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
      <FilePreview
        ref="previewRef"
        :src="fileSource"
        :options="{
          theme: 'light',
          showToolbar: true,
          showFileName: true
        }"
        @loading="onLoading"
        @loaded="onLoaded"
        @error="onError"
        @page-change="onPageChange"
        @zoom-change="onZoomChange"
        @rotate="onRotate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FilePreview } from '@files-preview-app/preview-file/vue';
import '@files-preview-app/preview-file/styles.css';

const previewRef = ref<InstanceType<typeof FilePreview> | null>(null);
const fileSource = ref('/sample.docx');
const currentPage = ref(1);
const totalPages = ref(1);

// --- Programmatic Methods ---
function zoomIn() {
  previewRef.value?.getInstance()?.zoomIn?.();
}

function zoomOut() {
  previewRef.value?.getInstance()?.zoomOut?.();
}

function rotate() {
  previewRef.value?.getInstance()?.rotateCW?.();
}

function prevPage() {
  if (currentPage.value > 1) {
    previewRef.value?.getInstance()?.goToPage?.(currentPage.value - 1);
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    previewRef.value?.getInstance()?.goToPage?.(currentPage.value + 1);
  }
}

function openSeparateWindow() {
  previewRef.value?.getViewer()?.openInSeparateWindow();
}

function download() {
  previewRef.value?.getInstance()?.download?.();
}

function print() {
  previewRef.value?.getInstance()?.print?.();
}

// --- Events ---
function onLoading() {
  console.log('Loading file...');
}

function onLoaded(data: any) {
  console.log('File loaded successfully:', data);
  const count = previewRef.value?.getInstance()?.getPageCount?.() ?? 1;
  totalPages.value = count;
}

function onError(err: any) {
  console.error('File load error:', err);
}

function onPageChange(data: any) {
  if (data?.page) currentPage.value = data.page;
}

function onZoomChange(data: any) {
  console.log('Zoom changed:', data?.zoom);
}

function onRotate(data: any) {
  console.log('Rotated to:', data?.rotation);
}
</script>
```

#### Nuxt 3 `<ClientOnly>`
```vue
<template>
  <ClientOnly>
    <div style="height: 800px;">
      <FilePreview src="/documents/contract.pdf" />
    </div>
    <template #fallback>
      <div>Loading preview...</div>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import { FilePreview } from '@files-preview-app/preview-file/vue';
import '@files-preview-app/preview-file/styles.css';
</script>
```

---

### 7.3 Angular 14+ (`@files-preview-app/preview-file/angular`)

#### Standalone Component Example
In Angular, use `@ViewChild('preview')` to reference `FilePreviewComponent`:
1. `this.preview.getInstance()`: returns `PreviewInstance | null`
2. `this.preview.getViewer()`: returns `FilePreviewViewer | null`
3. `this.preview.destroy()`: destroys viewer

```typescript
import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FilePreviewComponent } from '@files-preview-app/preview-file/angular';

@Component({
  selector: 'app-preview-demo',
  standalone: true,
  imports: [CommonModule, FilePreviewComponent],
  template: `
    <div style="display: flex; flex-direction: column; height: 100vh; padding: 16px;">
      <!-- Action Toolbar -->
      <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
        <button (click)="prevPage()" [disabled]="currentPage <= 1">◀ Prev</button>
        <span>Page {{ currentPage }} of {{ totalPages }}</span>
        <button (click)="nextPage()" [disabled]="currentPage >= totalPages">Next ▶</button>

        <span style="border-left: 1px solid #ccc; margin: 0 8px; height: 20px;"></span>

        <button (click)="zoomIn()">Zoom (+)</button>
        <button (click)="zoomOut()">Zoom (-)</button>
        <button (click)="rotate()">Rotate</button>
        <button (click)="openSeparateWindow()">Open in Separate Window</button>
        <button (click)="download()">Download</button>
        <button (click)="print()">Print</button>
      </div>

      <!-- Preview Component -->
      <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <fp-file-preview
          #preview
          [src]="fileUrl"
          [options]="{
            theme: 'light',
            showToolbar: true,
            showFileName: true
          }"
          (loading)="onLoading()"
          (loaded)="onLoaded($event)"
          (error)="onError($event)"
          (pageChange)="onPageChange($event)"
          (zoomChange)="onZoomChange($event)"
          (rotate)="onRotate($event)"
        />
      </div>
    </div>
  `
})
export class PreviewDemoComponent {
  @ViewChild('preview') preview!: FilePreviewComponent;

  fileUrl = 'https://example.com/presentation.pptx';
  currentPage = 1;
  totalPages = 1;

  // --- Programmatic Methods ---
  zoomIn(): void {
    this.preview.getInstance()?.zoomIn?.();
  }

  zoomOut(): void {
    this.preview.getInstance()?.zoomOut?.();
  }

  rotate(): void {
    this.preview.getInstance()?.rotateCW?.();
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.preview.getInstance()?.goToPage?.(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.preview.getInstance()?.goToPage?.(this.currentPage + 1);
    }
  }

  openSeparateWindow(): void {
    this.preview.getViewer()?.openInSeparateWindow();
  }

  download(): void {
    this.preview.getInstance()?.download?.();
  }

  print(): void {
    this.preview.getInstance()?.print?.();
  }

  // --- Event Callbacks ---
  onLoading(): void {
    console.log('Loading file...');
  }

  onLoaded(event: unknown): void {
    console.log('File loaded:', event);
    this.totalPages = this.preview.getInstance()?.getPageCount?.() ?? 1;
  }

  onError(err: Error): void {
    console.error('Preview error:', err);
  }

  onPageChange(event: any): void {
    if (event?.page) this.currentPage = event.page;
  }

  onZoomChange(event: any): void {
    console.log('Zoom:', event?.zoom);
  }

  onRotate(event: any): void {
    console.log('Rotation:', event?.rotation);
  }
}
```

---

### 7.4 Vanilla JavaScript / TypeScript (`@files-preview-app/preview-file`)

#### Direct DOM Usage
```typescript
import { FilePreviewViewer } from '@files-preview-app/preview-file';
import '@files-preview-app/preview-file/styles.css';

const container = document.getElementById('preview-container')!;

// 1. Initialize viewer
const viewer = new FilePreviewViewer();

// 2. Subscribe to events
viewer.on('loading', () => console.log('Loading...'));
viewer.on('loaded', ({ metadata, plugin }) => {
  console.log(`Rendered ${metadata.name} using ${plugin}`);
});
viewer.on('error', (err) => console.error('Error:', err));
viewer.on('page-change', ({ page, total }) => {
  console.log(`Page: ${page} / ${total}`);
});

// 3. Render document
const instance = await viewer.preview(container, '/document.pdf', {
  theme: 'light',
  showToolbar: true,
  showFileName: true,
  showThumbnails: false,
});

// 4. Call methods programmatically
document.getElementById('btn-zoom-in')?.addEventListener('click', () => instance.zoomIn?.());
document.getElementById('btn-zoom-out')?.addEventListener('click', () => instance.zoomOut?.());
document.getElementById('btn-rotate')?.addEventListener('click', () => instance.rotateCW?.());
document.getElementById('btn-fit')?.addEventListener('click', () => instance.fitToPage?.());
document.getElementById('btn-open-win')?.addEventListener('click', () => viewer.openInSeparateWindow());
document.getElementById('btn-download')?.addEventListener('click', () => instance.download?.());

// 5. Clean up when done
// viewer.destroy();
```

---

## 8. Extension-Wise Method & Feature Compatibility Matrix

Each file format plugin adheres to the universal standard while honoring the natural paradigm of its file type:

| Format Category | Extensions | Page Navigation (`goToPage`) | Thumbnails Sidebar (`toggleThumbnails`) | Rotate (`rotateCW`) | Auto Fit-to-Width | Copy (`copy`) | Download & Print | Separate Full Window | Status |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **PDF** | `.pdf` | ✅ Multi-page (`< 1 / N >`) | ✅ Page thumbnails | ✅ CW & CCW | ✅ Fit to Page / Width | ❌ | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
| **Spreadsheets & Excel Extended** | `.xlsx`, `.xls`, `.ods`, `.xlsm`, `.xlsb`, `.xltx`, `.xltm` | ✅ Sheet nav (`< 1 / N >`) | ✅ Sheet thumbnails (`#107c41`) | ❌ (Spreadsheet) | ✅ Auto-fit width | ❌ | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
| **CSV Table** | `.csv`, `.tsv` | ❌ (Continuous single load) | ✅ Sheet thumbnail (`#107c41`) | ❌ (Table) | ✅ Auto-fit width | ❌ | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
| **Plain Text** | `.txt` | ✅ Multi-page (`< 1 / N >`) | ✅ Page thumbnails | ❌ (Document) | ✅ Auto-fit width | ✅ Supported | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
| **Archives** | `.zip` | ❌ (Tree browser) | ❌ | ❌ | ❌ | ❌ | ✅ Single & ZIP | ✅ Supported | **LOCKED** 🔒 |
| **Rich Text** | `.rtf` | ✅ Multi-page (`< 1 / N >`) | ✅ Page thumbnails | ✅ CW & CCW | ✅ Auto-fit width / page | ✅ Supported | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
| **Images & Vector** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`, `.tiff`, `.tif`, `.avif` | ❌ (Single image) | ❌ | ✅ CW & CCW (90°/180°/270°) | ✅ Auto Fit-to-Width & Reset Zoom | ❌ | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
| **Code (190+ Langs)** | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.py`, `.java`, `.c`, `.cpp`, `.h`, `.cs`, `.go`, `.rs`, `.sql`, `.php`, `.json`, `.yaml`, `.yml`, `.sh`, `.bash`, `.css`, `.scss`, `.less`, `.xml`, `.toml`, `.ini`, `.env` | ❌ (Single file / Multi-page for page-split) | ❌ | ❌ (Code editor) | ✅ Auto Fit-to-Width & Reset Zoom | ✅ Clean Code (No line numbers) | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
| **HTML Webpages** | `.html`, `.htm`, `.xhtml` | ❌ (Single document) | ❌ | ❌ (Document) | ✅ Auto Fit-to-Width & Reset Zoom | ✅ Copy HTML | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
| **Rich Markdown** | `.md`, `.markdown`, `.mdown`, `.mkd` | ❌ (Continuous document) | ❌ | ❌ (Document) | ✅ Auto Fit-to-Width & Reset Zoom | ✅ Copy Markdown | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
| **Word Documents** | `.docx`, `.doc`, `.odt` | ✅ Multi-page | ✅ Page thumbnails | ❌ | ✅ Auto-fit width | ❌ | ✅ Supported | ✅ Supported | Available |
| **Video Media** | `.mp4`, `.webm`, `.m4v`, `.ogv`, `.ogg`, `.mov`, `.avi`, `.mkv`, `.flv`, `.wmv`, `.3gp`, `.mpg`, `.mpeg` | ❌ (Seek bar) | ❌ | ✅ Video rotate | ✅ Auto Fit-to-Width (Responsive) | ❌ | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
| **Audio Media** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma`, `.opus`, `.weba` | ❌ (Seek bar) | ❌ | ❌ | ✅ Centered Player (Responsive) | ❌ | ✅ Supported | ✅ Supported | Available |
| **3D Models** | `.stl`, `.obj` | ❌ (360° orbit) | ❌ | ❌ (3D Camera) | ✅ Reset view & Fit-to-Width | ❌ | ✅ Supported | ✅ Supported | **LOCKED** 🔒 |
