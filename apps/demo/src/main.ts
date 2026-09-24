import { FilePreviewViewer, getTransferPayload } from '@file-preview-viewer/viewer';
import '@file-preview-viewer/viewer/styles.css';

// Initialize the universal viewer
const viewer = new FilePreviewViewer();
(window as any).viewer = viewer;
(window as any).FilePreviewViewer = FilePreviewViewer;
const viewport = document.getElementById('preview-viewport') as HTMLElement;
const fileNameEl = document.getElementById('file-name') as HTMLElement;
const fileMetaEl = document.getElementById('file-meta') as HTMLElement;
const snippetCodeEl = document.getElementById('snippet-code') as HTMLElement;
const dropzone = document.getElementById('dropzone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
const headerThumbnailsBtn = document.getElementById('header-thumbnails-btn');

// URL parameter routing & fullscreen standalone window handling (defined early to prevent TDZ)
const urlParams = new URLSearchParams(window.location.search);
const isFullscreen = urlParams.get('mode') === 'fullscreen';
const transferId = urlParams.get('transferId');
const sampleParam = urlParams.get('sample');
const fileParam = urlParams.get('file');

if (isFullscreen) {
  document.body.classList.add('fullscreen-mode');
}

let currentTheme: 'light' | 'dark' = 'light';
let isFileNameVisible = true;
let activeFileExt = '.pdf';
let activeFileName = 'sample.pdf';
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
  docm: () => ({
    name: 'document.docm',
    ext: '.docm',
    data: getSampleUrl('document.docm')
  }),
  dotx: () => ({
    name: 'document.dotx',
    ext: '.dotx',
    data: getSampleUrl('document.dotx')
  }),
  doc: () => ({
    name: 'document.doc',
    ext: '.doc',
    data: getSampleUrl('document.doc')
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
  odt: () => ({
    name: 'document.odt',
    ext: '.odt',
    data: getSampleUrl('document.odt')
  }),
  txt: () => ({
    name: 'document.txt',
    ext: '.txt',
    data: getSampleUrl('document.txt')
  }),
  xlsx: () => ({
    name: 'financial-report.xlsx',
    ext: '.xlsx',
    data: getSampleUrl('financial-report.xlsx')
  }),
  xlsm: () => ({
    name: 'budget-forecast.xlsm',
    ext: '.xlsm',
    data: getSampleUrl('budget-forecast.xlsm')
  }),
  xls: () => ({
    name: 'spreadsheet.xls',
    ext: '.xls',
    data: getSampleUrl('spreadsheet.xls')
  }),
  ods: () => ({
    name: 'spreadsheet.ods',
    ext: '.ods',
    data: getSampleUrl('spreadsheet.ods')
  }),
  image: () => ({
    name: 'photo.jpg',
    ext: '.jpg',
    data: getSampleUrl('photo.jpg')
  }),
  photo: () => ({
    name: 'photo.jpg',
    ext: '.jpg',
    data: getSampleUrl('photo.jpg')
  }),
  csv: () => {
    const csvContent = `ID,Product Name,Category,Quantity,Price,Revenue
101,Enterprise Cloud Server 4U,Hardware,15,$4299.00,$64485.00
102,Ultra-Wide 4K IPS Monitor 38",Displays,45,$899.50,$40477.50
103,Managed Kubernetes Cluster,Cloud Services,12,$1250.00,$15000.00
104,High-Speed NVMe Storage 4TB,Storage,110,$289.99,$31898.90
105,Ergonomic Mechanical Keyboard,Peripherals,210,$149.00,$31290.00
106,Noise-Canceling Studio Headset,Audio,95,$199.95,$18995.25
107,Smart 100W USB-C Docking Station,Accessories,160,$129.99,$20798.40
108,Precision Optical CAD Mouse,Peripherals,185,$89.50,$16557.50`;
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
    const mdContent = `# Distributed Event Streaming & Consensus Platform

> High-throughput, distributed event streaming architecture designed for sub-millisecond replication, fault-tolerant event sourcing, and high-availability enterprise workloads.

## 🚀 Architecture Overview
- **Zero-Copy Network I/O**: Direct page cache kernel transfers for ultra-low latency.
- **Raft Distributed Consensus**: Strong consistency across leader and follower quorums.
- **Multi-Partition Parallelism**: Horizontal scaling with dynamic consumer rebalancing.
- **End-to-End Cryptographic Integrity**: TLS 1.3 encryption and SHA-256 payload verification.

### 📊 System Performance Benchmarks
| Cluster Topology | Node Count | Throughput (msg/sec) | P99 Latency | Durability Level |
|---|---|---|---|---|
| Edge Cluster | 3 Nodes | 125,000 / sec | 1.2 ms | In-Memory Replicated |
| Enterprise Production | 7 Nodes | 850,000 / sec | 2.4 ms | Disk Sync & Quorum Ack |
| Global Multi-Region | 15 Nodes | 2,400,000 / sec | 4.8 ms | Cross-Region Geo-Replicated |

### 🛠️ Configuration Example
\`\`\`yaml
cluster:
  name: production-us-east
  partitions: 64
  replication_factor: 3
  retention:
    hours: 168
    bytes_per_partition: 50GiB
\`\`\`
`;
    return {
      name: 'architecture.md',
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
  obj: () => ({
    name: 'pyramid.obj',
    ext: '.obj',
    data: getSampleUrl('pyramid.obj')
  }),
  code: () => {
    const tsCode = `/**
 * High-Performance Least-Recently-Used (LRU) Cache Implementation
 * Provides O(1) amortized read, write, and eviction operations.
 */

export interface CacheNode<K, V> {
  key: K;
  value: V;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
  expiresAt?: number;
}

export interface LRUCacheOptions {
  maxSize: number;
  defaultTtlMs?: number;
  onEvict?: <K, V>(key: K, value: V) => void;
}

export class LRUCache<K, V> {
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private readonly map = new Map<K, CacheNode<K, V>>();
  private head: CacheNode<K, V> | null = null;
  private tail: CacheNode<K, V> | null = null;
  private hits = 0;
  private misses = 0;

  constructor(options: LRUCacheOptions) {
    this.maxSize = Math.max(1, options.maxSize);
    this.defaultTtlMs = options.defaultTtlMs ?? 0;
  }

  public get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }
    if (node.expiresAt && Date.now() > node.expiresAt) {
      this.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.moveToHead(node);
    return node.value;
  }

  public set(key: K, value: V, ttlMs?: number): void {
    const existing = this.map.get(key);
    const expiresAt = (ttlMs ?? this.defaultTtlMs) > 0 ? Date.now() + (ttlMs ?? this.defaultTtlMs) : undefined;

    if (existing) {
      existing.value = value;
      existing.expiresAt = expiresAt;
      this.moveToHead(existing);
      return;
    }

    const node: CacheNode<K, V> = { key, value, prev: null, next: this.head, expiresAt };
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;

    this.map.set(key, node);
    if (this.map.size > this.maxSize) {
      this.evict();
    }
  }

  public delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  private moveToHead(node: CacheNode<K, V>): void {
    if (node === this.head) return;
    this.removeNode(node);
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
  }

  private removeNode(node: CacheNode<K, V>): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;
  }

  private evict(): void {
    if (!this.tail) return;
    const evicted = this.tail;
    this.removeNode(evicted);
    this.map.delete(evicted.key);
  }

  public getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.map.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total).toFixed(4) : '0.0000'
    };
  }
}
`;
    return {
      name: 'lru-cache.ts',
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
        Cloud Infrastructure
      </text>
      <text x="200" y="245" font-family="-apple-system, sans-serif" font-size="13" fill="#e0e7ff" text-anchor="middle">
        Distributed Systems Architecture
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
  html: () => ({
    name: 'webpage.html',
    ext: '.html',
    data: getSampleUrl('webpage.html')
  }),
  audio: () => ({
    name: 'audio.mp3',
    ext: '.mp3',
    data: getSampleUrl('audio.mp3')
  }),
  wav: () => ({
    name: 'sample.wav',
    ext: '.wav',
    data: getSampleUrl('sample.wav')
  }),
  video: () => ({
    name: 'video.mp4',
    ext: '.mp4',
    data: getSampleUrl('video.mp4')
  })
};

// Render file in viewer
async function loadFile(source: string | File | Blob | ArrayBuffer, name: string, ext?: string) {
  lastLoadedSource = source as any;
  activeFileName = name;
  activeFileExt = ext || name.slice(name.lastIndexOf('.')).toLowerCase();
  fileNameEl.textContent = name;
  fileMetaEl.textContent = 'Rendering...';

  try {
    const inst = await viewer.preview(viewport, source as any, {
      theme: currentTheme,
      showToolbar: true,
      showFileName: isFileNameVisible,
      toolbarPosition: 'top',
      _isSeparateWindow: isFullscreen,
      metadata: {
        name,
        extension: activeFileExt
      }
    });
    const cleanExt = activeFileExt.replace('.', '').toUpperCase();
    fileMetaEl.textContent = `Ready · ${cleanExt} format`;
    updateSnippet();

    const pageCount = (inst as any)?.getPageCount?.() ?? 1;
    if (headerThumbnailsBtn) {
      headerThumbnailsBtn.style.display = pageCount > 1 ? 'inline-flex' : 'none';
    }
  } catch (err: any) {
    fileMetaEl.textContent = `Preview error: ${err.message}`;
  }
}

// Update code snippet for active tab and file
function updateSnippet() {
  const snippets: Record<string, string> = {
    react: `import { FilePreview } from '@file-preview-viewer/viewer/react';
import '@file-preview-viewer/viewer/styles.css';

<FilePreview
  src={file} // URL string, File, Blob, or ArrayBuffer (${activeFileExt})
  options={{ theme: '${currentTheme}', showToolbar: true }}
  onLoaded={(meta) => console.log('Loaded:', meta)}
/>`,
    angular: `import { FilePreviewComponent } from '@file-preview-viewer/viewer/angular';

<fp-file-preview
  [src]="fileSource" // ${activeFileName}
  [options]="{ theme: '${currentTheme}', showToolbar: true }"
  (loaded)="onLoaded($event)"
/>`,
    vue: `<script setup>
import { FilePreview } from '@file-preview-viewer/viewer/vue';
import '@file-preview-viewer/viewer/styles.css';
</script>

<template>
  <FilePreview :src="file" :options="{ theme: '${currentTheme}', showToolbar: true }" />
</template>`,
    vanilla: `import { FilePreviewViewer } from '@file-preview-viewer/viewer';
import '@file-preview-viewer/viewer/styles.css';

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

// Wire up "Open in Separate Full Window" button in preview header
const openWindowHeaderBtn = document.getElementById('open-window-btn');
if (openWindowHeaderBtn) {
  if (isFullscreen) {
    openWindowHeaderBtn.style.display = 'none';
  } else {
    openWindowHeaderBtn.addEventListener('click', () => {
      viewer.openInSeparateWindow();
    });
  }
}

// Wire up "Thumbnails" button in preview header
if (headerThumbnailsBtn) {
  headerThumbnailsBtn.addEventListener('click', () => {
    viewer.toggleThumbnails();
  });
}

// Wire up "Find (Ctrl+F)" button in preview header
const headerSearchBtn = document.getElementById('header-search-btn');
if (headerSearchBtn) {
  headerSearchBtn.addEventListener('click', () => {
    viewer.toggleSearch();
  });
}

// Wire up "Toggle File Name" button in preview header
const toggleFileNameBtn = document.getElementById('toggle-filename-btn');
const fileNameBtnText = document.getElementById('filename-btn-text');
if (toggleFileNameBtn) {
  toggleFileNameBtn.addEventListener('click', () => {
    isFileNameVisible = !isFileNameVisible;
    viewer.setShowFileName(isFileNameVisible);
    if (fileNameBtnText) {
      fileNameBtnText.textContent = `File Name: ${isFileNameVisible ? 'ON' : 'OFF'}`;
    }
    const activeFileInfo = document.querySelector('.active-file-info') as HTMLElement;
    if (activeFileInfo) {
      activeFileInfo.style.opacity = isFileNameVisible ? '1' : '0.2';
    }
  });
}

// Expose on window for automated verification and debugging
(window as any).__viewer = viewer;
(window as any).__loadFile = loadFile;
(window as any).__samples = samples;

setInterval(() => {
  let el = document.getElementById('browser-logs');
  if (!el) {
    el = document.createElement('pre');
    el.id = 'browser-logs';
    document.body.appendChild(el);
  }
  el.textContent = JSON.stringify((window as any).__consoleLogs || [], null, 2);
}, 300);


async function initDemo() {
  if (transferId) {
    fileMetaEl.textContent = 'Loading transferred document...';
    let transferred = await getTransferPayload(transferId);
    if (!transferred && (window as any).__lastTransfer) {
      transferred = (window as any).__lastTransfer;
    }
    if (!transferred && (window.opener as any)?.__lastTransfer) {
      transferred = (window.opener as any).__lastTransfer;
    }
    if (transferred && transferred.buffer) {
      const meta = (transferred as any).metadata || {};
      const name = meta.name || 'document';
      const ext = meta.extension || (name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '');
      document.title = `${name} - Full Preview`;
      await loadFile(transferred.buffer, name, ext);
      return;
    }
  }

  if (sampleParam && samples[sampleParam]) {
    const btn = document.querySelector(`[data-sample="${sampleParam}"]`) as HTMLElement;
    if (btn) btn.classList.add('active');
    const s = samples[sampleParam]();
    await loadFile(s.data, s.name, s.ext);
  } else if (fileParam) {
    const fileName = urlParams.get('name') || fileParam.split('/').pop() || 'document';
    await loadFile(fileParam, fileName);
  } else {
    // Initial load with PDF document sample
    const initialBtn = document.querySelector('[data-sample="pdf"]') as HTMLElement;
    if (initialBtn) initialBtn.classList.add('active');
    const initial = samples.pdf();
    await loadFile(initial.data, initial.name, initial.ext);
  }
}

initDemo();
