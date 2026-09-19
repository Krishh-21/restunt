import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { UserConfig } from 'vite';

export const baseViteConfig: UserConfig = {
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
};

export default defineConfig(baseViteConfig);
