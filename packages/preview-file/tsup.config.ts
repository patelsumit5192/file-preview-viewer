import { defineConfig } from 'tsup';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.tsx',
    vue: 'src/vue.ts',
    angular: 'src/angular.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: [
    'react',
    'react-dom',
    'vue',
    '@angular/core',
    '@angular/common',
    'pdfjs-dist',
    'docx-preview',
    'exceljs',
    'papaparse',
    'highlight.js',
    '@panzoom/panzoom',
    'dompurify',
    'fflate',
    'marked',
    'pptx-browser',
    'three'
  ],
  noExternal: [
    '@patel.sumit51/core',
    '@patel.sumit51/plugin-pdf',
    '@patel.sumit51/plugin-media',
    '@patel.sumit51/plugin-docx',
    '@patel.sumit51/plugin-excel',
    '@patel.sumit51/plugin-csv',
    '@patel.sumit51/plugin-code',
    '@patel.sumit51/plugin-archive',
    '@patel.sumit51/plugin-markdown',
    '@patel.sumit51/plugin-pptx',
    '@patel.sumit51/plugin-3d',
    '@patel.sumit51/react',
    '@patel.sumit51/vue',
    '@patel.sumit51/angular'
  ],
  onSuccess: async () => {
    const src = path.resolve(__dirname, '../core/src/toolbar/toolbar.css');
    const dest = path.resolve(__dirname, 'dist/styles.css');
    fs.copyFileSync(src, dest);
  }
});
