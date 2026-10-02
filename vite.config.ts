import { defineConfig, type Plugin } from 'vite';
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
  plugins: [demoSeed()],
  server: { port: 5173, strictPort: true },
});
