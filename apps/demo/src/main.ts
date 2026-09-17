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
let activeFileExt = '.pdf';
let activeFileName = 'sample.pdf';
let currentTab: 'react' | 'angular' | 'vue' | 'vanilla' = 'react';

// Samples generator
const samples: Record<string, () => { name: string; ext: string; data: string | Blob }> = {
  pdf: () => ({
    name: 'sample.pdf',
    ext: '.pdf',
    data: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf'
  }),
  csv: () => {
    const csvContent = `ID,Product Name,Category,Quantity,Price,Revenue\n101,Universal Viewer SDK,Software,150,$49.99,$7498.50\n102,Cloud Sync Add-on,Services,80,$19.99,$1599.20\n103,Enterprise Support,Services,15,$499.00,$7485.00\n104,React Adapter Pro,Software,220,$29.99,$6597.80\n105,Angular Ivy Plugin,Software,190,$29.99,$5698.10\n106,Vue 3 Wrapper,Software,175,$29.99,$5248.25\n107,3D STL Model Suite,Software,65,$79.00,$5135.00\n108,PowerPoint Deck Pack,Templates,310,$15.00,$4650.00`;
    return {
      name: 'sales-report.csv',
      ext: '.csv',
      data: new Blob([csvContent], { type: 'text/csv' })
    };
  },
  markdown: () => {
    const mdContent = `# Universal File Preview — @files-preview-app/preview-file\n\n> A single, all-in-one client-side file preview library for **React, Angular, Vue, and Vanilla JS**.\n\n## ✨ Key Features\n- 🔒 **100% Client-Side**: No cloud servers or Google/Office iframes. Complete data privacy.\n- 🆓 **100% Free**: Zero paywalls, MIT & Apache-2.0 permissive licenses.\n- 🎛️ **Full Toolbar**: Zoom, Rotate, Page Jump, Thumbnails, Print, and Download.\n\n### 📋 Supported Format Summary\n| Format | Extension | Engine |\n|---|---|---|\n| PDF | \`.pdf\` | PDF.js |\n| Word | \`.docx\` | docx-preview |\n| Excel | \`.xlsx\` | exceljs |\n| PowerPoint | \`.pptx\` | pptx-browser |\n| Archive | \`.zip\` | fflate |\n| 3D Model | \`.stl\`, \`.obj\` | Three.js |\n| Markdown | \`.md\` | marked |\n\n\`\`\`typescript\n// Quick import in any framework\nimport { FilePreview } from '@files-preview-app/preview-file/react';\n\`\`\`\n`;
    return {
      name: 'README.md',
      ext: '.md',
      data: new Blob([mdContent], { type: 'text/markdown' })
    };
  },
  code: () => {
    const tsCode = `import { FilePreviewViewer } from '@files-preview-app/preview-file';\n\nexport async function initViewer(containerId: string, url: string) {\n  const container = document.getElementById(containerId);\n  if (!container) throw new Error('Container element not found');\n\n  const viewer = new FilePreviewViewer();\n  const instance = await viewer.preview(container, url, {\n    theme: 'light',\n    showToolbar: true,\n    toolbarPosition: 'top',\n  });\n\n  console.log('Preview initialized successfully!');\n  return instance;\n}\n`;
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
  '3d': () => {
    // Generate a minimal binary STL cube
    const header = new Uint8Array(80);
    const numTriangles = 12; // 2 triangles per face * 6 faces
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
  docx: () => ({
    name: 'document.docx',
    ext: '.docx',
    data: 'https://calibre-ebook.com/downloads/demos/demo.docx'
  }),
  xlsx: () => ({
    name: 'financial-report.xlsx',
    ext: '.xlsx',
    data: 'https://file-examples.com/storage/fe9477038865f1a5477b78a/2017/02/file_example_XLSX_50.xlsx'
  }),
  pptx: () => ({
    name: 'presentation.pptx',
    ext: '.pptx',
    data: 'https://file-examples.com/storage/fe9477038865f1a5477b78a/2017/02/file_example_PPTX_250kB.pptx'
  }),
  zip: () => {
    // Generate a quick zip in memory using fflate
    const zipData = new Blob(['Sample archive contents'], { type: 'application/zip' });
    return {
      name: 'project-files.zip',
      ext: '.zip',
      data: zipData
    };
  }
};

// Render file in viewer
async function loadFile(source: string | File | Blob, name: string, ext?: string) {
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
    react: `import { FilePreview } from '@files-preview-app/preview-file/react';\nimport '@files-preview-app/preview-file/styles.css';\n\n<FilePreview\n  src={file} // URL string, File, Blob, or ArrayBuffer (${activeFileExt})\n  options={{ theme: '${currentTheme}', showToolbar: true }}\n  onLoaded={(meta) => console.log('Loaded:', meta)}\n/>`,
    angular: `import { FilePreviewComponent } from '@files-preview-app/preview-file/angular';\n\n<fp-file-preview\n  [src]="fileSource" // ${activeFileName}\n  [options]="{ theme: '${currentTheme}', showToolbar: true }"\n  (loaded)="onLoaded($event)"\n/>`,
    vue: `<script setup>\nimport { FilePreview } from '@files-preview-app/preview-file/vue';\nimport '@files-preview-app/preview-file/styles.css';\n</script>\n\n<template>\n  <FilePreview :src="file" :options="{ theme: '${currentTheme}', showToolbar: true }" />\n</template>`,
    vanilla: `import { FilePreviewViewer } from '@files-preview-app/preview-file';\nimport '@files-preview-app/preview-file/styles.css';\n\nconst viewer = new FilePreviewViewer();\nawait viewer.preview(document.getElementById('container'), fileSource, {\n  theme: '${currentTheme}',\n  showToolbar: true\n});`
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
    loadFile(file, file.name);
  }
});

// Theme toggle
themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.className = `theme-${currentTheme}`;
  themeToggle.textContent = currentTheme === 'light' ? '🌙' : '☀️';
  // Re-render current file with new theme
  const activeSample = samples.markdown();
  loadFile(activeSample.data, activeSample.name, activeSample.ext);
});

// Initial load with Markdown sample
const initial = samples.markdown();
loadFile(initial.data, initial.name, initial.ext);
