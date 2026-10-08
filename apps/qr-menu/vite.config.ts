import { offlineShell } from '../../scripts/offline-shell';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react(),offlineShell('qr-menu')],
  base: './',
  envDir: path.resolve(__dirname, '../..'),
  server: { port: 3003, proxy: { '/api': 'http://localhost:5000' } },
});
