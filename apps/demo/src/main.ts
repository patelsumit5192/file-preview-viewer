import { FilePreviewViewer } from '@files-preview-app/preview-file';
import '@files-preview-app/preview-file/styles.css';

// Initialize the universal viewer
const viewer = new FilePreviewViewer();
const viewport = document.getElementById('preview-viewport') as HTMLElement;
const fileNameEl = document.getElementById('file-name') as HTMLElement;
const fileMetaEl = document.getElementById('file-meta') as HTMLElement;
const snippetCodeEl = document.getElementById('snippet-code') as HTMLElement;
const dropzone = document.getElementById('dropzone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;

let currentTheme: 'light' | 'dark' = 'light';
let activeFileExt = '.docx';
let activeFileName = 'document.docx';
let currentTab: 'react' | 'angular' | 'vue' | 'vanilla' = 'react';
let lastLoadedSource: string | File | Blob = '';

/**
 * Robust URL resolver for sample assets on GitHub Pages or local Vite dev
 */
function getSampleUrl(filename: string): string {
  let path = window.location.pathname;
  if (path.endsWith('index.html')) {
    path = path.slice(0, -'index.html'.length);
  }
  if (!path.endsWith('/')) {
    path += '/';
  }
  return `${window.location.origin}${path}samples/${filename}`;
}

// Samples generator — zero external third-party URL dependencies to avoid CORS blocks
const samples: Record<string, () => { name: string; ext: string; data: string | Blob }> = {
  pdf: () => ({
    name: 'sample.pdf',
    ext: '.pdf',
    data: getSampleUrl('sample.pdf')
  }),
  docx: () => ({
    name: 'document.docx',
    ext: '.docx',
    data: getSampleUrl('document.docx')
  }),
  doc: () => ({
    name: 'document.doc',
    ext: '.doc',
    data: getSampleUrl('document.doc')
  }),
  xlsx: () => ({
    name: 'financial-report.xlsx',
    ext: '.xlsx',
    data: getSampleUrl('financial-report.xlsx')
  }),
  xls: () => ({
    name: 'spreadsheet.xls',
    ext: '.xls',
    data: getSampleUrl('spreadsheet.xls')
  }),
  pptx: () => ({
    name: 'presentation.pptx',
    ext: '.pptx',
    data: getSampleUrl('presentation.pptx')
  }),
  ppt: () => ({
    name: 'presentation.ppt',
    ext: '.ppt',
    data: getSampleUrl('presentation.ppt')
  }),
  csv: () => {
    const csvContent = `ID,Product Name,Category,Quantity,Price,Revenue
101,Universal Viewer SDK,Software,150,$49.99,$7498.50
102,Cloud Sync Add-on,Services,80,$19.99,$1599.20
103,Enterprise Support,Services,15,$499.00,$7485.00
104,React Adapter Pro,Software,220,$29.99,$6597.80
105,Angular Ivy Plugin,Software,190,$29.99,$5698.10
106,Vue 3 Wrapper,Software,175,$29.99,$5248.25
107,3D STL Model Suite,Software,65,$79.00,$5135.00
108,PowerPoint Deck Pack,Templates,310,$15.00,$4650.00`;
    return {
      name: 'sales-report.csv',
      ext: '.csv',
      data: new Blob([csvContent], { type: 'text/csv' })
    };
  },
  zip: () => ({
    name: 'project-files.zip',
    ext: '.zip',
    data: getSampleUrl('project-files.zip')
  }),
  markdown: () => {
    const mdContent = `# Universal File Preview — @files-preview-app/preview-file

> A single, all-in-one client-side file preview library for **React, Angular, Vue, and Vanilla JS**.

## ✨ Key Features
- 🔒 **100% Client-Side**: No cloud servers or Google/Office iframes. Complete data privacy.
- 🆓 **100% Free**: Zero paywalls, MIT & Apache-2.0 permissive licenses.
- 🎛️ **Full Toolbar**: Zoom, Rotate, Page Jump, Thumbnails, Print, and Download.
- ⚡ **Instant Preview**: Fast startup engine with async background rendering.

### 📋 Supported Format Summary
| Format | Extension | Engine |
|---|---|---|
| PDF | \`.pdf\` | PDF.js |
| Word | \`.docx\` | docx-preview |
| Excel | \`.xlsx\` | exceljs |
| PowerPoint | \`.pptx\` | pptx-browser |
| Archive | \`.zip\` | fflate |
| 3D Model | \`.stl\`, \`.obj\` | Three.js |
| Markdown | \`.md\` | marked |
| Images | \`.jpg\`, \`.png\`, \`.webp\`, \`.svg\` | Native + Panzoom |
| Audio/Video | \`.mp3\`, \`.mp4\`, \`.wav\`, \`.webm\` | Native HTML5 Media |

\`\`\`typescript
// Quick import in any framework
import { FilePreview } from '@files-preview-app/preview-file/react';
\`\`\`
`;
    return {
      name: 'README.md',
      ext: '.md',
      data: new Blob([mdContent], { type: 'text/markdown' })
    };
  },
  '3d': () => {
    // Generate a minimal binary STL cube
    const header = new Uint8Array(80);
    const numTriangles = 12;
    const recordSize = 50;
    const totalSize = 84 + numTriangles * recordSize;
    const buffer = new ArrayBuffer(totalSize);
    new Uint8Array(buffer, 0, 80).set(header);
    new DataView(buffer).setUint32(80, numTriangles, true);

    const v = [
      [-20, -20, -20], [20, -20, -20], [20, 20, -20], [-20, 20, -20],
      [-20, -20,  20], [20, -20,  20], [20, 20,  20], [-20, 20,  20]
    ];
    const faces = [
      [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
      [4, 5, 1], [4, 1, 0], [3, 2, 6], [3, 6, 7],
      [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]
    ];

    let offset = 84;
    const view = new DataView(buffer);
    for (const [a, b, c] of faces) {
      view.setFloat32(offset + 0, 0, true);
      view.setFloat32(offset + 4, 0, true);
      view.setFloat32(offset + 8, 0, true);
      const v1 = v[a], v2 = v[b], v3 = v[c];
      view.setFloat32(offset + 12, v1[0], true);
      view.setFloat32(offset + 16, v1[1], true);
      view.setFloat32(offset + 20, v1[2], true);
      view.setFloat32(offset + 24, v2[0], true);
      view.setFloat32(offset + 28, v2[1], true);
      view.setFloat32(offset + 32, v2[2], true);
      view.setFloat32(offset + 36, v3[0], true);
      view.setFloat32(offset + 40, v3[1], true);
      view.setFloat32(offset + 44, v3[2], true);
      offset += 50;
    }

    return {
      name: 'cube.stl',
      ext: '.stl',
      data: new Blob([buffer], { type: 'model/stl' })
    };
  },
  code: () => {
    const tsCode = `import { FilePreviewViewer } from '@files-preview-app/preview-file';

export async function initViewer(containerId: string, url: string) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error('Container element not found');

  const viewer = new FilePreviewViewer();
  const instance = await viewer.preview(container, url, {
    theme: 'light',
    showToolbar: true,
    toolbarPosition: 'top',
  });

  console.log('Preview initialized successfully!');
  return instance;
}
`;
    return {
      name: 'viewer-service.ts',
      ext: '.ts',
      data: new Blob([tsCode], { type: 'text/typescript' })
    };
  },
  svg: () => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="100%" stop-color="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" rx="16" fill="url(#grad)" />
      <circle cx="200" cy="120" r="50" fill="#ffffff" opacity="0.9" />
      <polygon points="185,100 225,120 185,140" fill="#3b82f6" />
      <text x="200" y="220" font-family="-apple-system, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">
        Universal File Preview
      </text>
      <text x="200" y="245" font-family="-apple-system, sans-serif" font-size="13" fill="#e0e7ff" text-anchor="middle">
        Vector SVG Graphics
      </text>
    </svg>`;
    return {
      name: 'graphic.svg',
      ext: '.svg',
      data: new Blob([svgContent], { type: 'image/svg+xml' })
    };
  },
  rtf: () => ({
    name: 'document.rtf',
    ext: '.rtf',
    data: getSampleUrl('document.rtf')
  }),
  odt: () => ({
    name: 'document.odt',
    ext: '.odt',
    data: getSampleUrl('document.odt')
  }),
  ods: () => ({
    name: 'spreadsheet.ods',
    ext: '.ods',
    data: getSampleUrl('spreadsheet.ods')
  }),
  html: () => ({
    name: 'webpage.html',
    ext: '.html',
    data: getSampleUrl('webpage.html')
  }),
  photo: () => ({
    name: 'photo.jpg',
    ext: '.jpg',
    data: getSampleUrl('photo.jpg')
  }),
  audio: () => ({
    name: 'audio.mp3',
    ext: '.mp3',
    data: getSampleUrl('audio.mp3')
  }),
  video: () => ({
    name: 'video.mp4',
    ext: '.mp4',
    data: getSampleUrl('video.mp4')
  })
};

// Render file in viewer
async function loadFile(source: string | File | Blob, name: string, ext?: string) {
  lastLoadedSource = source;
  activeFileName = name;
  activeFileExt = ext || name.slice(name.lastIndexOf('.')).toLowerCase();
  fileNameEl.textContent = name;
  fileMetaEl.textContent = 'Rendering...';

  try {
    await viewer.preview(viewport, source, {
      theme: currentTheme,
      showToolbar: true,
      toolbarPosition: 'top'
    });
    fileMetaEl.textContent = `Ready · ${activeFileExt.toUpperCase()} format`;
    updateSnippet();
  } catch (err: any) {
    fileMetaEl.textContent = `Preview error: ${err.message}`;
  }
}

// Update code snippet for active tab and file
function updateSnippet() {
  const snippets: Record<string, string> = {
    react: `import { FilePreview } from '@files-preview-app/preview-file/react';
import '@files-preview-app/preview-file/styles.css';

<FilePreview
  src={file} // URL string, File, Blob, or ArrayBuffer (${activeFileExt})
  options={{ theme: '${currentTheme}', showToolbar: true }}
  onLoaded={(meta) => console.log('Loaded:', meta)}
/>`,
    angular: `import { FilePreviewComponent } from '@files-preview-app/preview-file/angular';

<fp-file-preview
  [src]="fileSource" // ${activeFileName}
  [options]="{ theme: '${currentTheme}', showToolbar: true }"
  (loaded)="onLoaded($event)"
/>`,
    vue: `<script setup>
import { FilePreview } from '@files-preview-app/preview-file/vue';
import '@files-preview-app/preview-file/styles.css';
</script>

<template>
  <FilePreview :src="file" :options="{ theme: '${currentTheme}', showToolbar: true }" />
</template>`,
    vanilla: `import { FilePreviewViewer } from '@files-preview-app/preview-file';
import '@files-preview-app/preview-file/styles.css';

const viewer = new FilePreviewViewer();
await viewer.preview(document.getElementById('container'), fileSource, {
  theme: '${currentTheme}',
  showToolbar: true
});`
  };

  snippetCodeEl.textContent = snippets[currentTab] || '';
}

// Wire up snippet tabs
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const target = e.currentTarget as HTMLElement;
    target.classList.add('active');
    currentTab = (target.getAttribute('data-tab') as any) || 'react';
    updateSnippet();
  });
});

// Wire up sample buttons
document.querySelectorAll('.sample-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sample-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const key = btn.getAttribute('data-sample');
    if (key && samples[key]) {
      const sample = samples[key]();
      loadFile(sample.data, sample.name, sample.ext);
    }
  });
});

// File upload & drag and drop
fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) {
    const file = fileInput.files[0];
    document.querySelectorAll('.sample-btn').forEach(b => b.classList.remove('active'));
    loadFile(file, file.name);
  }
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer?.files?.[0]) {
    const file = e.dataTransfer.files[0];
    document.querySelectorAll('.sample-btn').forEach(b => b.classList.remove('active'));
    loadFile(file, file.name);
  }
});

// Theme toggle
themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.className = `theme-${currentTheme}`;
  themeToggle.textContent = currentTheme === 'light' ? '🌙' : '☀️';
  // Re-render the current file with the updated theme
  if (lastLoadedSource) {
    loadFile(lastLoadedSource, activeFileName, activeFileExt);
  }
});

// Initial load with Markdown sample
const initialBtn = document.querySelector('[data-sample="markdown"]') as HTMLElement;
if (initialBtn) initialBtn.classList.add('active');
const initial = samples.markdown();
loadFile(initial.data, initial.name, initial.ext);
