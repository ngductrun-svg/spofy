import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000', '/media': 'http://127.0.0.1:3000' } },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
