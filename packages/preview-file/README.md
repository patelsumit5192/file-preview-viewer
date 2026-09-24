# @file-preview-viewer/viewer

<p align="center">
  <a href="https://patelsumit5192.github.io/preview-file/">
    <img src="https://img.shields.io/badge/Live%20Demo-Explore%20Online-brightgreen?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Live Demo" />
  </a>
  <a href="https://www.npmjs.com/package/@file-preview-viewer/viewer">
    <img src="https://img.shields.io/npm/v/@file-preview-viewer/viewer.svg?style=for-the-badge&color=blue" alt="npm version" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License: MIT" />
  </a>
  <a href="https://github.com/patelsumit5192/preview-file">
    <img src="https://img.shields.io/badge/GitHub-Repo-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" />
  </a>
</p>

> **The all-in-one, 100% client-side file preview library for React, Next.js, Angular, Vue 3, Nuxt 3, and Vanilla JavaScript / TypeScript.**  
> Preview **PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV/TSV, ZIP Archives, Rich Markdown, 3D Models (.stl, .obj), Images, Video, Audio, and Code/Text (190+ languages)** with a built-in customizable toolbar (zoom, rotate, thumbnails, page jump, download, print). 100% free, permissive open-source, and client-side (zero cloud or server needed).

---

## 🌐 Live Interactive Demo

Try the interactive demo with instant sample files directly in your browser:  
👉 **[Launch Live Demo (GitHub Pages)](https://patelsumit5192.github.io/preview-file/)**

- Instant samples for **PDF, DOCX, XLSX, PPTX, CSV, ZIP, Markdown, 3D STL, SVG, and Code**
- Drag-and-drop your own files from your computer
- Live framework code generator (React, Angular, Vue, Vanilla)
- Light & Dark mode toggle

---

## 📦 Installation

Install the **single all-in-one package** in your project:

```bash
npm install @file-preview-viewer/viewer
```

Or using Yarn, pnpm, or Bun:
```bash
pnpm add @file-preview-viewer/viewer
# or
yarn add @file-preview-viewer/viewer
# or
bun add @file-preview-viewer/viewer
```

Import the toolbar and viewer stylesheet in your global CSS or root component:
```css
import '@file-preview-viewer/viewer/styles.css';
```

---

## 🎯 Supported Frameworks & Version Matrix

| Framework | Supported Versions | Package Entry Point | Integration Notes |
|---|---|---|---|
| **React** | `>=16.8.0` (React 17, 18, 19) | `@file-preview-viewer/viewer/react` | Full Hooks, `forwardRef`, `FilePreviewHandle` |
| **Next.js** | 13.x, 14.x, 15.x | `@file-preview-viewer/viewer/react` | App Router (`'use client'`) & Pages Router |
| **Angular** | `>=14.0.0` (Angular 15, 16, 17, 18, 19) | `@file-preview-viewer/viewer/angular` | Standalone Component & NgModule, `@ViewChild` |
| **Vue 3** | `>=3.0.0` (Vue 3.2, 3.3, 3.4, 3.5+) | `@file-preview-viewer/viewer/vue` | Composition API (`<script setup>`) & Options API |
| **Nuxt 3** | `>=3.0.0` | `@file-preview-viewer/viewer/vue` | Wrapped inside `<ClientOnly>` component |
| **Vanilla JS / TS** | ES2020+ | `@file-preview-viewer/viewer` | Pure DOM API, Vite, Webpack, Rollup, Parcel, esbuild |
| **Svelte / Solid** | All versions | `@file-preview-viewer/viewer` | Direct DOM container attachment |

---

## 🚀 Framework Integration Guides

### 1. React (`@file-preview-viewer/viewer/react`)

#### Basic Usage
```tsx
import React, { useState } from 'react';
import { FilePreview } from '@file-preview-viewer/viewer/react';
import '@file-preview-viewer/viewer/styles.css';

export default function App() {
  const [file, setFile] = useState<File | string>(
    'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf'
  );

  return (
    <div style={{ padding: '20px' }}>
      <input
        type="file"
        onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
      />

      <div style={{ width: '100%', height: '750px', marginTop: '16px' }}>
        <FilePreview
          src={file}
          options={{
            theme: 'light', // 'light' | 'dark' | 'auto'
            showToolbar: true,
            toolbarPosition: 'top', // 'top' | 'bottom'
            showThumbnails: false,
          }}
          onLoading={() => console.log('File loading started')}
          onLoaded={(info) => console.log('Loaded successfully:', info)}
          onError={(err) => console.error('Preview error:', err)}
          onPageChange={(data) => console.log('Page switched:', data)}
          onZoomChange={(data) => console.log('Zoom scale:', data)}
        />
      </div>
    </div>
  );
}
```

#### Advanced React (Programmatic Controls via `ref`)
```tsx
import React, { useRef, useState } from 'react';
import { FilePreview, type FilePreviewHandle } from '@file-preview-viewer/viewer/react';
import '@file-preview-viewer/viewer/styles.css';

export default function AdvancedViewer() {
  const previewRef = useRef<FilePreviewHandle>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [file, setFile] = useState<string>('https://example.com/contract.docx');

  // Trigger instance methods programmatically
  const handleZoomIn = () => previewRef.current?.getInstance()?.zoomIn?.();
  const handleZoomOut = () => previewRef.current?.getInstance()?.zoomOut?.();
  const handleRotate = () => previewRef.current?.getInstance()?.rotateCW?.();
  const handleDownload = () => previewRef.current?.getInstance()?.download?.();
  const handlePrint = () => previewRef.current?.getInstance()?.print?.();
  const handleNextPage = () => {
    const next = currentPage + 1;
    previewRef.current?.getInstance()?.goToPage?.(next);
  };

  return (
    <div>
      {/* Custom external controls */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button onClick={handleZoomIn}>Zoom In (+)</button>
        <button onClick={handleZoomOut}>Zoom Out (-)</button>
        <button onClick={handleRotate}>Rotate (90°)</button>
        <button onClick={handleNextPage}>Next Page</button>
        <button onClick={handleDownload}>Download File</button>
        <button onClick={handlePrint}>Print</button>
      </div>

      <div style={{ width: '100%', height: '800px' }}>
        <FilePreview
          ref={previewRef}
          src={file}
          options={{ theme: 'light', showToolbar: true }}
          onPageChange={(data: any) => setCurrentPage(data.page)}
        />
      </div>
    </div>
  );
}
```

---

### 2. Next.js (App Router & Pages Router)

Because file previews use client-side DOM and canvas APIs, disable SSR using Next.js `dynamic`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import '@file-preview-viewer/viewer/styles.css';

// Disable SSR for the preview component
const FilePreview = dynamic(
  () => import('@file-preview-viewer/viewer/react').then((mod) => mod.FilePreview),
  { ssr: false }
);

export default function NextPreviewPage() {
  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <FilePreview
        src="https://example.com/spreadsheet.xlsx"
        options={{ theme: 'auto', showToolbar: true }}
      />
    </main>
  );
}
```

---

### 3. Angular (`@file-preview-viewer/viewer/angular`)

#### Standalone Component (Angular 14, 15, 16, 17, 18, 19)
```typescript
import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FilePreviewComponent } from '@file-preview-viewer/viewer/angular';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [CommonModule, FilePreviewComponent],
  template: `
    <div class="viewer-wrapper" style="width: 100%; height: 800px;">
      <!-- File Selector -->
      <input type="file" (change)="onFileChange($event)" />

      <!-- Custom Actions -->
      <div class="actions" style="margin: 10px 0;">
        <button (click)="zoomIn()">Zoom In</button>
        <button (click)="zoomOut()">Zoom Out</button>
        <button (click)="download()">Download</button>
      </div>

      <!-- Preview Component -->
      <fp-file-preview
        #preview
        [src]="selectedFile"
        [options]="{ theme: 'light', showToolbar: true, toolbarPosition: 'top' }"
        (loading)="onLoading()"
        (loaded)="onLoaded($event)"
        (error)="onError($event)"
        (pageChange)="onPageChange($event)"
        (zoomChange)="onZoomChange($event)"
      />
    </div>
  `,
  styleUrls: ['@file-preview-viewer/viewer/styles.css']
})
export class DocumentViewerComponent {
  @ViewChild('preview') previewComponent!: FilePreviewComponent;

  selectedFile: string | File = 'https://example.com/presentation.pptx';

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.selectedFile = input.files[0];
    }
  }

  // Programmatic controls
  zoomIn() {
    this.previewComponent.getInstance()?.zoomIn?.();
  }

  zoomOut() {
    this.previewComponent.getInstance()?.zoomOut?.();
  }

  download() {
    this.previewComponent.getInstance()?.download?.();
  }

  // Event handlers
  onLoading() {
    console.log('Loading file...');
  }

  onLoaded(event: unknown) {
    console.log('File successfully loaded:', event);
  }

  onError(err: Error) {
    console.error('Failed to preview file:', err);
  }

  onPageChange(data: unknown) {
    console.log('Page switched:', data);
  }

  onZoomChange(data: unknown) {
    console.log('Zoom changed:', data);
  }
}
```

#### Traditional NgModule (Angular 14+)
```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FilePreviewComponent } from '@file-preview-viewer/viewer/angular';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, FilePreviewComponent],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

---

### 4. Vue 3 (`@file-preview-viewer/viewer/vue`)

#### Composition API (`<script setup>`)
```vue
<template>
  <div class="preview-container" style="width: 100%; height: 800px;">
    <!-- Controls Bar -->
    <div class="toolbar-actions" style="margin-bottom: 12px; display: flex; gap: 8px;">
      <input type="file" @change="handleFileSelect" />
      <button @click="zoomIn">Zoom In (+)</button>
      <button @click="zoomOut">Zoom Out (-)</button>
      <button @click="rotate">Rotate (90°)</button>
      <button @click="download">Download</button>
    </div>

    <!-- Universal Preview Component -->
    <FilePreview
      ref="previewRef"
      :src="fileSource"
      :options="{
        theme: 'light',
        showToolbar: true,
        toolbarPosition: 'top'
      }"
      @loading="onLoading"
      @loaded="onLoaded"
      @error="onError"
      @page-change="onPageChange"
      @zoom-change="onZoomChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FilePreview } from '@file-preview-viewer/viewer/vue';
import '@file-preview-viewer/viewer/styles.css';

const previewRef = ref<InstanceType<typeof FilePreview> | null>(null);
const fileSource = ref<string | File>('https://example.com/archive.zip');

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    fileSource.value = target.files[0];
  }
}

// Programmatic methods
function zoomIn() {
  previewRef.value?.getInstance()?.zoomIn?.();
}

function zoomOut() {
  previewRef.value?.getInstance()?.zoomOut?.();
}

function rotate() {
  previewRef.value?.getInstance()?.rotateCW?.();
}

function download() {
  previewRef.value?.getInstance()?.download?.();
}

// Event callbacks
function onLoading() {
  console.log('Rendering file...');
}

function onLoaded(metadata: unknown) {
  console.log('Preview ready:', metadata);
}

function onError(err: unknown) {
  console.error('Preview error:', err);
}

function onPageChange(pageData: unknown) {
  console.log('Page switched:', pageData);
}

function onZoomChange(zoomData: unknown) {
  console.log('Zoom changed:', zoomData);
}
</script>
```

#### Nuxt 3 Integration
Wrap inside `<ClientOnly>` to avoid server-side rendering:
```vue
<template>
  <ClientOnly>
    <div style="height: 800px;">
      <FilePreview src="/documents/sample.pdf" />
    </div>
    <template #fallback>
      <div>Loading preview component...</div>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import { FilePreview } from '@file-preview-viewer/viewer/vue';
import '@file-preview-viewer/viewer/styles.css';
</script>
```

---

### 5. Vanilla JavaScript / TypeScript (`@file-preview-viewer/viewer`)

Use directly with any build tool (Vite, Webpack, Rollup) or via `<script type="module">`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Universal File Preview</title>
  <!-- Link Stylesheet -->
  <link rel="stylesheet" href="node_modules/@file-preview-viewer/viewer/dist/styles.css" />
  <style>
    #viewer-container {
      width: 100%;
      height: 850px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div style="margin-bottom: 12px; display: flex; gap: 8px;">
    <input type="file" id="file-picker" />
    <button id="btn-zoom-in">Zoom In</button>
    <button id="btn-zoom-out">Zoom Out</button>
    <button id="btn-download">Download</button>
  </div>

  <div id="viewer-container"></div>

  <script type="module">
    import { FilePreviewViewer } from './node_modules/@file-preview-viewer/viewer/dist/index.js';

    const container = document.getElementById('viewer-container');
    const filePicker = document.getElementById('file-picker');

    // 1. Instantiate viewer
    const viewer = new FilePreviewViewer();

    // 2. Listen to lifecycle events
    viewer.on('loading', () => console.log('File loading started'));
    viewer.on('loaded', (info) => console.log('File loaded:', info));
    viewer.on('error', (err) => console.error('Preview error:', err));
    viewer.on('page-change', (data) => console.log('Page switched:', data));

    // 3. Render initial file
    let instance = await viewer.preview(
      container,
      'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
      {
        theme: 'light',
        showToolbar: true,
        toolbarPosition: 'top'
      }
    );

    // 4. Handle file selection from local disk
    filePicker.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        instance = await viewer.preview(container, file, { theme: 'light' });
      }
    });

    // 5. Connect custom buttons to instance methods
    document.getElementById('btn-zoom-in').addEventListener('click', () => instance?.zoomIn?.());
    document.getElementById('btn-zoom-out').addEventListener('click', () => instance?.zoomOut?.());
    document.getElementById('btn-download').addEventListener('click', () => instance?.download?.());
  </script>
</body>
</html>
```

---

## 🎛️ Complete Methods Reference

### 1. `FilePreviewViewer` (Viewer Class Methods)

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `preview()` | `container: HTMLElement`, `source: FileSource`, `options?: PreviewViewerOptions` | `Promise<PreviewInstance>` | Renders any supported file into the target DOM element. Cleans up previous renders automatically. |
| `getInstance()` | None | `PreviewInstance \| null` | Returns the active preview instance, exposing zoom, navigation, export, and rotation methods. |
| `openInSeparateWindow()` | None | `Window \| null` | Clones current file buffer and opens it in a full-screen isolated browser tab. |
| `setShowFileName(show)` | `show: boolean` | `void` | Dynamically toggles the file name and format badge title bar above the toolbar. |
| `setFileName(name)` | `name: string` | `void` | Dynamically updates the displayed file title in the preview panel. |
| `setToolbarConfig(config)` | `config: ToolbarConfig` | `void` | Dynamically reconfigures which toolbar buttons/actions are shown. |
| `getToolbarConfig()` | None | `ToolbarConfig` | Returns the active toolbar configuration. |
| `hideToolbarAction(id)` | `actionId: string` | `void` | Hides a specific toolbar action by ID or alias (e.g. `'zoomIn'`, `'print'`, `'download'`). |
| `showToolbarAction(id)` | `actionId: string` | `void` | Shows a previously hidden toolbar action. |
| `enableToolbarAction(id)` | `actionId: string` | `void` | Enables a disabled toolbar action button. |
| `disableToolbarAction(id)` | `actionId: string` | `void` | Disables a toolbar action button. |
| `toggleThumbnails()` | None | `void` | Toggles the page/sheet thumbnail sidebar panel. |
| `toggleFullscreen()` | None | `void` | Toggles browser fullscreen on the viewer container. |
| `fitToPage()` | None | `void` | Scales document page or table so it fits the frame width with minimal margins. |
| `zoomIn()` | None | `void` | Programmatically zooms in. |
| `zoomOut()` | None | `void` | Programmatically zooms out. |
| `setZoom(level)` | `level: number` | `void` | Programmatically sets exact zoom scale (e.g. `1.5` = 150%). |
| `getZoom()` | None | `number` | Returns current zoom level. |
| `rotateCW()` | None | `void` | Rotates document or image 90° clockwise. |
| `rotateCCW()` | None | `void` | Rotates document or image 90° counter-clockwise. |
| `goToPage(page)` | `page: number` | `void` | Navigates to a specific page or sheet (1-based index). |
| `nextPage()` | None | `void` | Navigates to next page or sheet. |
| `prevPage()` | None | `void` | Navigates to previous page or sheet. |
| `getPageCount()` | None | `number` | Returns total page/sheet count. |
| `getCurrentPage()` | None | `number` | Returns current active page number (1-based). |
| `download()` | None | `void` | Downloads current file with original name and detected MIME type. |
| `print()` | None | `void` | Triggers browser print dialog for document. |
| `on(event, handler)` | `event: string`, `handler: (data: any) => void` | `Unsubscribe: () => void` | Subscribes to lifecycle events. Returns an unsubscribe cleanup function. |
| `registerPlugin(plugin)` | `plugin: PreviewPlugin` | `this` | Registers a custom renderer plugin. |
| `registerPlugins(list)` | `plugins: PreviewPlugin[]` | `this` | Registers multiple renderer plugins at once. |
| `destroy()` | None | `void` | Destroys the active instance, removes toolbar DOM, cancels network abort controllers, and clears listeners. |

---

### 2. `PreviewInstance` (Active Document Instance Methods)

Retrieved via `viewer.getInstance()` or `previewRef.current.getInstance()`.

| Category | Method | Return Type | Description | Example Usage |
|---|---|---|---|---|
| **Zoom** | `zoomIn()` | `void` | Increments zoom level by 20% | `instance.zoomIn()` |
| **Zoom** | `zoomOut()` | `void` | Decrements zoom level by 20% | `instance.zoomOut()` |
| **Zoom** | `setZoom(level)` | `void` | Sets absolute zoom scale (e.g. `1.5` = 150%) | `instance.setZoom(1.5)` |
| **Zoom** | `getZoom()` | `number` | Gets current zoom scale number | `const z = instance.getZoom()` |
| **Zoom** | `fitToPage()` | `void` | Resets zoom to fit container viewport | `instance.fitToPage()` |
| **Pagination** | `goToPage(page)` | `void` | Jumps to specific page, sheet, or slide (1-indexed) | `instance.goToPage(3)` |
| **Pagination** | `getPageCount()` | `number` | Returns total page, sheet, or slide count | `const total = instance.getPageCount()` |
| **Pagination** | `getCurrentPage()` | `number` | Returns current 1-indexed page or sheet | `const cur = instance.getCurrentPage()` |
| **Rotation** | `rotateCW()` | `void` | Rotates document, image, or video 90° clockwise | `instance.rotateCW()` |
| **Rotation** | `rotateCCW()` | `void` | Rotates 90° counter-clockwise | `instance.rotateCCW()` |
| **Rotation** | `getRotation()` | `number` | Returns rotation angle in degrees (0, 90, 180, 270) | `const deg = instance.getRotation()` |
| **Media** | `play()` | `void` | Starts video or audio playback | `instance.play()` |
| **Media** | `pause()` | `void` | Pauses video or audio playback | `instance.pause()` |
| **Media** | `isPlaying()` | `boolean` | Checks if media is currently playing | `if (instance.isPlaying()) ...` |
| **Thumbnails** | `getThumbnails()` | `Thumbnail[]` | Returns list of thumbnails for sidebar | `const thumbs = instance.getThumbnails()` |
| **Thumbnails** | `toggleThumbnails()`| `void` | Toggles the page thumbnails sidebar panel | `instance.toggleThumbnails()` |
| **Export** | `download()` | `void` | Downloads original file with proper name & MIME | `instance.download()` |
| **Export** | `print()` | `void` | Opens browser print dialog formatted for clean output | `instance.print()` |
| **Lifecycle** | `destroy()` | `void` | Releases memory, cancels rendering, revokes blob URLs | `instance.destroy()` |
---

## 🛠️ Toolbar Configuration & Feature Toggles

All toolbar features and buttons are completely configurable through options and instance methods.
If an action is set to `false`, its button will not appear in the toolbar.

### Via Initialization Options:
```typescript
// Flat options:
await viewer.preview(container, file, {
  zoomIn: false,     // Hide zoom in button
  print: false,      // Hide print button
  openWindow: false, // Hide "Open in Separate Full Window" button
  download: true     // Keep download enabled
});

// Or nested toolbar object:
await viewer.preview(container, file, {
  toolbar: {
    zoomIn: false,
    print: false,
    copy: false
  }
});
```

### Via Runtime Instance Methods:
```typescript
// Hide an action dynamically
viewer.hideToolbarAction('zoomIn');
viewer.hideToolbarAction('print');

// Show a hidden action
viewer.showToolbarAction('zoomIn');

// Disable/enable an action button without removing it
viewer.disableToolbarAction('fitPage');
viewer.enableToolbarAction('fitPage');

// Reconfigure the entire toolbar at runtime
viewer.setToolbarConfig({
  zoomIn: false,
  zoomOut: false,
  download: true
});
```

### Available Toolbar Toggle Keys:
| Option Key | Corresponding Action | Description |
|---|---|---|
| `zoomIn` | Zoom In | Zoom in button |
| `zoomOut` | Zoom Out | Zoom out button |
| `fitPage` / `fitToPage` | Fit to Page | Scales document to fill frame width with minimal side margins |
| `rotate` / `rotateCW` | Rotate | 90° Clockwise rotation |
| `fullscreen` | Fullscreen | Fullscreen frame toggle |
| `thumbnails` | Thumbnails | Sidebar thumbnail toggle |
| `download` | Download | File download button |
| `print` | Print | Browser clean print button |
| `openWindow` / `openSeparateWindow` | Open in Separate Window | Opens preview in a standalone window |
| `copy` | Copy Text | Copy document text to clipboard |
| `pageNav` / `pagination` | Pagination | Previous, next, and jump-to-page input |

---

## 📡 Complete Events Reference

All events can be listened to via framework bindings (`onLoaded`, `(loaded)`, `@loaded`) or `viewer.on('event', handler)`:

| Event Name | Framework Prop / Event | Payload Type | Description |
|---|---|---|---|
| `'loading'` | `onLoading` / `(loading)` / `@loading` | `{ source: FileSource }` | Emitted immediately when file parsing and decoding starts. |
| `'loaded'` | `onLoaded` / `(loaded)` / `@loaded` | `{ metadata: FileMetadata, plugin: string }` | Emitted when file rendering completes successfully. Contains detected metadata. |
| `'error'` | `onError` / `(error)` / `@error` | `Error` | Emitted if file download, decoding, or rendering fails. |
| `'page-change'` | `onPageChange` / `(pageChange)` / `@page-change` | `{ page: number, totalPages?: number }` | Emitted when user navigates to another page, Excel sheet, or PPT slide. |
| `'zoom-change'` | `onZoomChange` / `(zoomChange)` / `@zoom-change` | `{ zoom: number }` | Emitted whenever zoom level changes. |
| `'rotate'` | `onRotate` / `(rotate)` / `@rotate` | `{ rotation: number }` | Emitted when orientation rotates (0°, 90°, 180°, 270°). |
| `'destroy'` | `onDestroy` / `(destroy)` / `@destroy` | `null` | Emitted when viewer is cleaned up. |

### Practical Event Examples

#### 1. Show File Metadata Badge on Loaded
```typescript
viewer.on('loaded', ({ metadata, plugin }) => {
  console.log('File Name:', metadata.name);
  console.log('File Size:', (metadata.size / 1024).toFixed(1) + ' KB');
  console.log('Detected MIME:', metadata.mimeType);
  console.log('Renderer Plugin:', plugin);
});
```

#### 2. Display Custom Error Toast Notification
```typescript
viewer.on('error', (err) => {
  showToastNotification(`Cannot open file: ${err.message}`, { type: 'error' });
});
```

#### 3. Synchronize External Page Counter
```typescript
viewer.on('page-change', ({ page, totalPages }) => {
  pageIndicatorEl.innerText = `Page ${page} of ${totalPages || '?'}`;
});
```

---

## ⚙️ Complete Properties & Options Reference

### 1. `src` Property (Accepts 5 Source Formats)

The `src` prop accepts any of the following types:

| Format | Type | Example |
|---|---|---|
| **Local File** | `File` | From `<input type="file">` event: `e.target.files[0]` |
| **URL String** | `string` | Remote or local URL: `'https://example.com/file.pdf'` |
| **Blob** | `Blob` | `new Blob([binaryData], { type: 'application/pdf' })` |
| **ArrayBuffer** | `ArrayBuffer` | Direct binary buffer: `await response.arrayBuffer()` |
| **TypedArray** | `Uint8Array` | Byte array: `new Uint8Array(buffer)` |
| **Base64 URI** | `string` | Data URI: `'data:image/png;base64,iVBORw0...'` |

---

### 2. `options` Object Reference

Passed to `options` prop in React/Angular/Vue or third argument to `viewer.preview(container, src, options)`:

| Option Property | Type | Default | Description |
|---|---|---|---|
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | UI theme. `'auto'` adapts to system dark mode preferences. |
| `showToolbar` | `boolean` | `true` | Set `false` to hide built-in toolbar (e.g. when using your own custom buttons). |
| `toolbar` | `boolean \| ToolbarConfig` | `true` | Fine-grained button visibility flags (`zoomIn`, `print`, `download`, `pageNav`, etc.). |
| `toolbarPosition` | `'top' \| 'bottom'` | `'top'` | Positions toolbar at the top or bottom of the viewer container. |
| `showFileName` | `boolean` | `true` | When `true`, displays file name and format badge in title bar above toolbar. |
| `fileName` | `string` | `undefined` | Custom file title override displayed in title bar. |
| `fitMode` | `'width' \| 'page'` | `'width'` | Preferred fit calculation strategy ('width' fits container width preserving aspect ratio). |
| `showThumbnails` | `boolean` | `false` | Opens page thumbnails sidebar panel automatically on load. |
| `className` | `string` | `''` | Custom CSS class attached to the root viewer container element. |
| `zoom` | `number` | `1.0` | Initial zoom multiplier (`1.0` = 100%, `1.5` = 150%). |
| `page` | `number` | `1` | Initial page, slide, or sheet number to display on load (1-based). |
| `locale` | `string` | `'en'` | UI label language localization. |
| `metadata` | `FileMetadata` | `undefined` | Manual override object for file attributes (`name`, `extension`, `mimeType`, `size`). |
| `standaloneViewerUrl` | `string` | `undefined` | Custom URL opened when user clicks "Open in Separate Full Window". |
| `onOpenSeparateWindow` | `function` | `undefined` | Custom callback hook to handle opening preview in separate window. |
| `pluginOptions` | `Record<string, unknown>` | `{}` | Custom options passed directly to underlying format renderer plugins. |

> 📖 **For exhaustive details and TypeScript interfaces, see the full [API Reference Documentation](../../docs/API_REFERENCE.md).**

---

## 🎨 CSS Variables (Theming & Custom Styling)

Customize colors, borders, and typography using standard CSS custom properties:

```css
/* Custom Brand Theme */
.fp-viewer {
  --fp-bg: #ffffff;             /* Viewer background */
  --fp-toolbar-bg: #f8fafc;     /* Toolbar background */
  --fp-border: #e2e8f0;         /* Borders and dividers */
  --fp-text: #0f172a;           /* Text color */
  --fp-primary: #3b82f6;        /* Active buttons and highlights */
  --fp-btn-hover: #f1f5f9;      /* Toolbar button hover color */
  --fp-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Dark Theme Overrides */
.fp-theme-dark {
  --fp-bg: #0f172a;
  --fp-toolbar-bg: #1e293b;
  --fp-border: #334155;
  --fp-text: #f8fafc;
  --fp-primary: #60a5fa;
  --fp-btn-hover: #334155;
}
```

---

## 📂 Supported Formats Matrix (All 10 Categories)

Every file format is rendered 100% in the browser using permissive open-source engines:

| Category | File Extensions | Engine | License | Supported Features |
|---|---|---|---|---|
| **PDF** | `.pdf` | PDF.js (`pdfjs-dist`) | Apache-2.0 | Multi-page canvas rendering, Zoom In/Out, Fit to page, Rotate CW/CCW, Page jump, Thumbnails sidebar, Print, Download |
| **Word Document** | `.docx` | `docx-preview` | Apache-2.0 | Preserves styles, tables, bullets, images, fonts, Zoom In/Out, Fit to page, Print, Download |
| **Excel Spreadsheet** | `.xlsx`, `.xls` | `exceljs` | MIT | Multi-sheet tab bar, styled grid cells, borders, formatting, Zoom, Print, Download |
| **PowerPoint** | `.pptx`, `.ppsx` | `pptx-browser` | MIT | Slide-by-slide canvas rendering, slide thumbnails sidebar, navigation jump, Zoom, Fit to slide, Print, Download |
| **CSV / TSV Data** | `.csv`, `.tsv` | `papaparse` | MIT | Auto-detects comma/tab delimiter, tabular grid with header styling, Zoom, Print, Download |
| **ZIP Archives** | `.zip` | `fflate` | MIT | Hierarchical file tree/table explorer, compression stats, instant search filter, single-file extract/download, download ZIP |
| **Rich Markdown** | `.md`, `.markdown` | `marked` + `dompurify` | MIT / Apache-2.0 | GitHub Flavored Markdown (tables, checklists, blockquotes), syntax-highlighted code blocks, XSS sanitized, font zoom, Print, Download |
| **3D Models** | `.stl`, `.obj` | `three` (Three.js) | MIT | 360° mouse orbit controls, perspective camera, ambient & directional lighting, wireframe vs solid toggle, reset view, Download |
| **Images & Vector** | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg`, `.ico`, `.tiff` | Native + `@panzoom/panzoom` + `dompurify` | MIT / Apache-2.0 | Smooth pan & zoom, rotate 90°, SVG DOM sanitization, Print, Download |
| **Video & Audio** | `.mp4`, `.webm`, `.ogg`, `.mov`, `.mp3`, `.wav`, `.flac`, `.aac` | Native HTML5 Media | MIT | Play/Pause, seek bar, volume control, video rotate, fullscreen, Download |
| **Code & Text** | `.js`, `.ts`, `.jsx`, `.tsx`, `.html`, `.css`, `.json`, `.xml`, `.yaml`, `.py`, `.java`, `.cpp`, `.sql`, `.sh`, etc. (190+ languages) | `highlight.js` | BSD-3-Clause | Syntax highlighting, line numbers gutter, font zoom in/out, Print, Download |

---

## 🛡️ Security & Privacy Guarantee

- 🔒 **100% Client-Side**: Files never leave the user's browser. No documents are uploaded to third-party clouds or external rendering servers.
- 🛡️ **XSS Protection**: All HTML, Markdown, and SVG inputs are strictly sanitized with `DOMPurify`.
- 🆓 **100% Permissive Open-Source**: All libraries used are audited under **MIT**, **Apache-2.0**, or **BSD-3-Clause**. No GPL, AGPL, copyleft claims, or paid commercial subscriptions. See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

---

## 👨‍💻 Author & Community

**Sumit Patel**
- 🌐 GitHub: [@patelsumit5192](https://github.com/patelsumit5192)
- 📦 NPM: [patel.sumit51](https://www.npmjs.com/~patel.sumit51)
- 💻 Repository: [https://github.com/patelsumit5192/preview-file](https://github.com/patelsumit5192/preview-file)
- 🚀 Live Demo: [https://patelsumit5192.github.io/preview-file/](https://patelsumit5192.github.io/preview-file/)

---

## 📄 License

MIT © 2026 Sumit Patel
