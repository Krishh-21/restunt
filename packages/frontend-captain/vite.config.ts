import { defineConfig, mergeConfig } from 'vite';
import { baseViteConfig } from '../../vite.config.base';

export default defineConfig(
  mergeConfig(baseViteConfig, {
    server: {
      port: 5175,
    },
  })
);
