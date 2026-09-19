import { defineConfig, mergeConfig } from 'vite';
import { baseViteConfig } from '../../vite.config.base';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(
  mergeConfig(baseViteConfig, {
    server: {
      port: 5176,
    },
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        },
        manifest: {
          name: 'Dinely QR Menu',
          short_name: 'Dinely QR',
          description: 'QR Code Digital Menu',
          theme_color: '#ffffff',
        },
      }),
    ],
  })
);
