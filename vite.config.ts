import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Dev-only: serves a backup JSON at /__seed.json for `npm run dev:demo` (MemoryAdapter).
// Never part of a build – private data must not end up in dist/.
function demoSeed(): Plugin {
  return {
    name: 'pn-demo-seed',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__seed.json', (req, res) => {
        const file = resolve(process.env.SEED || 'private/data/seed-reference/backup.json');
        const synthetic = resolve('tests/fixtures/synthetic-backup.json');
        const path = !req.url?.includes('synthetic') && existsSync(file) ? file : synthetic;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(path));
      });
    },
  };
}

export default defineConfig({
  base: '/pa-nashe-tracker/',
  build: { outDir: process.env.PN_OUT_DIR || 'dist', chunkSizeWarningLimit: 600 },   // xlsx is its own lazy chunk
  plugins: [
    demoSeed(),
    // Installable app + offline app shell (SPEC §2.4). Data stays out of the service worker: Supabase requests
    // are never cached here – the adapter keeps its own IndexedDB copy.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pa-Nashe Tracker',
        short_name: 'Pa-Nashe',
        description: 'Household budget, savings and spending tracker for Piepie and Munny.',
        lang: 'en-ZA',
        theme_color: '#1F6B5C',
        background_color: '#EEF2EF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/pa-nashe-tracker/',
        scope: '/pa-nashe-tracker/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,      // the Excel library chunk, so export works offline
        navigateFallback: '/pa-nashe-tracker/index.html',
        navigateFallbackDenylist: [/\/__seed\.json/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, strictPort: true },
});
