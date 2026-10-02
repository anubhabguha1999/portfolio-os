import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { BRAND } from './src/config/brand';
import { localRuntimeAssets } from './scripts/vite-local-assets';
import { contentPagesDev } from './scripts/vite-content-pages';

export default defineConfig({
  // Absolute asset paths: the app now uses clean URLs such as /resume/abc.
  base: '/',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  plugins: [
    react(),
    tailwindcss(),
    localRuntimeAssets(fileURLToPath(new URL('.', import.meta.url))),
    contentPagesDev(fileURLToPath(new URL('.', import.meta.url))),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: BRAND.name,
        short_name: BRAND.shortName,
        description: BRAND.description,
        theme_color: '#08080b',
        background_color: '#08080b',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'design'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,webmanifest}'],
        // OCR and PDF runtime files are large and only needed when a PDF is imported.
        globIgnores: ['ocr/**', 'pdfjs/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Crawler files, verification files and the static content pages (scripts/content-pages.mjs)
        // must come from the network, not the SPA shell.
        navigateFallbackDenylist: [/\.(xml|txt|json)$/, /^\/\.well-known\//, /^\/google[0-9a-f]+\.html$/, /^\/(resume-examples|portfolio-examples|guides)(\/|$)/],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
