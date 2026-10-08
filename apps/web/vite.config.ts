import { offlineShell } from '../../scripts/offline-shell';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react(),offlineShell('web')],
  base: './',
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/socket.io': { target: 'http://localhost:5000', ws: true },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
