import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 100000,
  },
  server: {
    port: 3000,
    host: true,
  },
});
