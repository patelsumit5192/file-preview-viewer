# @file-preview

Universal file preview library — framework-agnostic, plugin-based, 100% client-side.

## Features
- **100% Client-Side**: No server required for file processing or previewing.
- **Plugin-Based Architecture**: Only load what you need.
- **Framework-Agnostic**: Works with React, Vue, Angular, or Vanilla JS.
- **Built-in Toolbar**: Out of the box zooming, panning, pagination, and printing.

## Quick Start

### React
```tsx
import { FilePreview } from '@patel.sumit51/react';
import { PdfPlugin } from '@patel.sumit51/plugin-pdf';

export default function App() {
  return (
    <FilePreview 
      url="sample.pdf"
      plugins={[PdfPlugin]}
    />
  );
}
```

### Vue
```vue
<template>
  <FilePreview :url="url" :plugins="plugins" />
</template>

<script setup>
import { FilePreview } from '@patel.sumit51/vue';
import { PdfPlugin } from '@patel.sumit51/plugin-pdf';

const url = 'sample.pdf';
const plugins = [PdfPlugin];
</script>
```

### Angular
```ts
import { Component } from '@angular/core';
import { PdfPlugin } from '@patel.sumit51/plugin-pdf';

@Component({
  selector: 'app-root',
  template: `<file-preview [url]="url" [plugins]="plugins"></file-preview>`
})
export class AppComponent {
  url = 'sample.pdf';
  plugins = [PdfPlugin];
}
```

## Supported File Types
| Type | Extension | Plugin |
|---|---|---|
| PDF | .pdf | `@patel.sumit51/plugin-pdf` |
| Images | .jpg, .png, .gif, .svg | `@patel.sumit51/plugin-image` |
| Text / Code | .txt, .json, .js, .css, etc | `@patel.sumit51/plugin-text` |
| Audio / Video | .mp4, .mp3, etc | `@patel.sumit51/plugin-media` |
| Word | .docx | `@patel.sumit51/plugin-docx` |
| Excel | .xlsx, .csv | `@patel.sumit51/plugin-excel` |

## License
MIT License - Copyright (c) 2026 Sumit and @file-preview contributors.

## Third-Party Licenses
This project uses permissive open-source libraries. See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) for details.
