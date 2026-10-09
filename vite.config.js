import { defineConfig } from 'vite';

// Relative base so the build works from any sub-folder (LAMP server, GitHub Pages).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 0
  }
});
