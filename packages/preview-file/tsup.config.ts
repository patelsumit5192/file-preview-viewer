import { defineConfig } from 'tsup';

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
    'dompurify'
  ],
  noExternal: [
    '@patel.sumit51/core',
    '@patel.sumit51/plugin-pdf',
    '@patel.sumit51/plugin-media',
    '@patel.sumit51/plugin-docx',
    '@patel.sumit51/plugin-excel',
    '@patel.sumit51/plugin-csv',
    '@patel.sumit51/plugin-code',
    '@patel.sumit51/react',
    '@patel.sumit51/vue',
    '@patel.sumit51/angular'
  ]
});
