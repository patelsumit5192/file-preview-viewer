# @files-preview-app/preview-file

> **Universal, all-in-one client-side file preview package for React, Angular, Vue, and Vanilla JS.**  
> Preview **PDF, Word (.docx), Excel (.xlsx), CSV, Images, Video, Audio, and Code/Text** with a built-in toolbar (zoom, rotate, thumbnails, page jump, download, print). 100% free, permissive open-source, and client-side (no cloud or server needed).

[![npm version](https://img.shields.io/npm/v/@files-preview-app/preview-file.svg)](https://www.npmjs.com/package/@files-preview-app/preview-file)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ðŸ“¦ Installation

Just install this **single package** in your project:

```bash
npm install @files-preview-app/preview-file
```

Or using Yarn / pnpm:
```bash
yarn add @files-preview-app/preview-file
# or
pnpm add @files-preview-app/preview-file
```

Import the toolbar stylesheet in your main CSS or component:
```css
import '@files-preview-app/preview-file/styles.css';
```

---

## ðŸš€ Quick Start by Framework

### 1. React (`@files-preview-app/preview-file/react`)

```tsx
import React, { useState } from 'react';
import { FilePreview } from '@files-preview-app/preview-file/react';
import '@files-preview-app/preview-file/styles.css';

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | string>('https://example.com/sample.pdf');

  return (
    <div>
      {/* File input for local files */}
      <input
        type="file"
        onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
      />

      {/* Preview container */}
      <div style={{ width: '100%', height: '800px', marginTop: '16px' }}>
        <FilePreview
          src={selectedFile}
          options={{
            theme: 'light', // 'light' | 'dark' | 'auto'
            showToolbar: true,
            toolbarPosition: 'top' // 'top' | 'bottom'
          }}
          onLoaded={(info) => console.log('File loaded successfully:', info)}
          onError={(error) => console.error('Preview error:', error)}
        />
      </div>
    </div>
  );
}
```

---

### 2. Angular (`@files-preview-app/preview-file/angular`)

In your standalone component or NgModule:

```typescript
import { Component } from '@angular/core';
import { FilePreviewComponent } from '@files-preview-app/preview-file/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FilePreviewComponent],
  template: `
    <div style="width: 100%; height: 800px;">
      <input type="file" (change)="onFileSelected($event)" />
      
      <fp-file-preview
        [src]="fileSource"
        [options]="{ theme: 'light', showToolbar: true }"
        (loaded)="onLoaded($event)"
        (error)="onError($event)"
      />
    </div>
  `,
  styleUrls: ['@files-preview-app/preview-file/styles.css']
})
export class AppComponent {
  fileSource: string | File = 'https://example.com/report.xlsx';

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.fileSource = input.files[0];
    }
  }

  onLoaded(event: unknown) {
    console.log('Preview ready', event);
  }

  onError(err: Error) {
    console.error('Preview failed', err);
  }
}
```

---

### 3. Vue 3 (`@files-preview-app/preview-file/vue`)

```vue
<template>
  <div style="width: 100%; height: 800px;">
    <input type="file" @change="onFileChange" />

    <FilePreview
      :src="currentFile"
      :options="{ theme: 'dark', showToolbar: true }"
      @loaded="handleLoaded"
      @error="handleError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FilePreview } from '@files-preview-app/preview-file/vue';
import '@files-preview-app/preview-file/styles.css';

const currentFile = ref<File | string>('/sample.docx');

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files?.[0]) {
    currentFile.value = target.files[0];
  }
}

function handleLoaded(data: unknown) {
  console.log('Loaded:', data);
}

function handleError(err: unknown) {
  console.error('Error:', err);
}
</script>
```

---

### 4. Vanilla JavaScript / TypeScript (`@files-preview-app/preview-file`)

```html
<link rel="stylesheet" href="node_modules/@files-preview-app/preview-file/dist/styles.css" />

<div id="viewer-container" style="width: 100%; height: 800px;"></div>

<script type="module">
  import { FilePreviewViewer } from '@files-preview-app/preview-file';

  const container = document.getElementById('viewer-container');
  const viewer = new FilePreviewViewer();

  // Preview from URL, File, Blob, or ArrayBuffer
  await viewer.preview(container, 'https://example.com/invoice.pdf', {
    theme: 'light',
    showToolbar: true
  });
</script>
```

---

## ðŸ“‚ Supported Extensions & Built-in Controls

The viewer automatically recognizes the file extension and magic binary bytes, activating the corresponding renderer and controls:

| File Format | Extensions | Controls Available |
|---|---|---|
| **PDF** | `.pdf` | Zoom In/Out, Fit to Page, Rotate CW/CCW, Page Navigation Jump, Thumbnails Sidebar, Download, Print |
| **Word Document** | `.docx` | Full layout rendering, Zoom In/Out, Fit to Page, Download, Print |
| **Excel Spreadsheet** | `.xlsx`, `.xls` | Multi-Sheet Tabs Navigation, Formatted Grid Table, Zoom In/Out, Download, Print |
| **PowerPoint** | `.pptx`, `.ppsx` | Slide-by-Slide Navigation, Slide Thumbnails Sidebar, Zoom In/Out, Fit to Slide, Download, Print |
| **CSV / TSV Data** | `.csv`, `.tsv` | Tabular Grid with Header Styling, Comma/Tab auto-detection, Zoom In/Out, Download, Print |
| **ZIP Archives** | `.zip` | File Tree & Table Explorer, Compression Stats, Search Filter, Individual File Download, Download Zip |
| **Rich Markdown** | `.md`, `.markdown` | Rendered GitHub Markdown (Tables, Checklists, Blockquotes), Syntax Highlighted Code, Font Zoom, Download, Print |
| **3D Models** | `.stl`, `.obj` | 360° Orbit Mouse Controls, Perspective Camera, Lighting, Wireframe Toggle, Zoom, Reset View, Download |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg`, `.ico`, `.tiff` | Pan & Zoom, Reset / Fit, Rotate 90Â°, Download, Print |
| **Video** | `.mp4`, `.webm`, `.ogg`, `.mov` | Play / Pause, Rotate, Fullscreen, Download |
| **Audio** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac` | Play / Pause, Volume, Seek, Download |
| **Code & Text** | `.js`, `.ts`, `.jsx`, `.tsx`, `.html`, `.css`, `.json`, `.xml`, `.yaml`, `.py`, `.java`, `.cpp`, `.sql`, `.md`, `.txt`, `.sh`, etc. (190+ languages) | Syntax Highlighting via highlight.js, Font Scaling Zoom In/Out, Download, Print |

---

## ðŸ“¥ How to Pass Values (`src` prop)

You can pass the file source in **any** of the following formats:

### 1. From HTML `<input type="file">` (File object)
```tsx
const file = event.target.files[0];
<FilePreview src={file} />
```

### 2. URL String (Public URL or CDN)
```tsx
<FilePreview src="https://example.com/documents/contract.pdf" />
```

### 3. Blob Object
```tsx
const blob = new Blob([data], { type: 'application/pdf' });
<FilePreview src={blob} />
```

### 4. ArrayBuffer or Uint8Array
```tsx
const buffer = await response.arrayBuffer();
<FilePreview src={buffer} />
```

### 5. Base64 Data URI
```tsx
<FilePreview src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." />
```

---

## ðŸŽ›ï¸ Toolbar Features Matrix

| Control | How it Works |
|---|---|
| **Thumbnails** | Toggles a collapsible sidebar showing miniature rendered previews of each page/sheet. |
| **Zoom In / Zoom Out** | Dynamically scales document, canvas, or font size without pixelation. |
| **Fit to Page** | Automatically fits the preview perfectly within your container dimensions. |
| **Page Jump** | Numeric input field allowing users to type a page or sheet number and jump instantly. |
| **Rotate** | Rotates documents, images, and videos 90 degrees clockwise or counterclockwise. |
| **Play / Pause** | Controls video and audio playback directly from the unified toolbar. |
| **Download** | Downloads the original file to the user's disk with proper filename and MIME type. |
| **Print** | Opens the browser print dialog formatted specifically for clean printing. |

---

## ðŸŽ¨ Viewer Options

Pass configuration via the `options` object:

```typescript
interface PreviewViewerOptions {
  /** Color theme: 'light' | 'dark' | 'auto' (default: 'light') */
  theme?: 'light' | 'dark' | 'auto';
  /** Show top toolbar (default: true) */
  showToolbar?: boolean;
  /** Toolbar placement: 'top' | 'bottom' (default: 'top') */
  toolbarPosition?: 'top' | 'bottom';
  /** Show thumbnails panel on initial load (default: false) */
  showThumbnails?: boolean;
  /** Custom wrapper CSS class name */
  className?: string;
  /** Initial zoom multiplier (1.0 = 100%) */
  zoom?: number;
}
```

---

## ðŸ›¡ï¸ Security & Licensing

- **100% Client-Side**: No document or file data is ever sent to any remote server or third-party cloud.
- **XSS Protection**: HTML and SVG previews are sanitized with `DOMPurify`.
- **Strictly Permissive Licenses**: Every dependency used is audited and verified under **MIT**, **Apache-2.0**, or **BSD-3-Clause**. No GPL, AGPL, commercial paywalls, or restrictive terms.

See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for full licensing details.

---

## ðŸ‘¨â€ðŸ’» Author

**Sumit Patel**
- GitHub: [@patelsumit5192](https://github.com/patelsumit5192)
- npm: [patel.sumit51](https://www.npmjs.com/~patel.sumit51)
- Repository: [https://github.com/patelsumit5192/preview-file](https://github.com/patelsumit5192/preview-file)

---

## ðŸ“„ License

MIT Â© 2026 Sumit Patel
