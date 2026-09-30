import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@patel.sumit51/core', 'fflate'],
  noExternal: ['pptx-browser'],
  treeshake: true,
});
