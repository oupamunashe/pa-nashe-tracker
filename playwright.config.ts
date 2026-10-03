import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174/pa-nashe-tracker/',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      // demo mode: MemoryAdapter on the reference seed (or the synthetic fixture with ?synthetic)
      command: 'npx vite --mode demo --port 5174 --strictPort',
      url: 'http://localhost:5174/pa-nashe-tracker/',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // a real production build (service worker, SupabaseAdapter) pointed at a fake Supabase that the
      // offline test answers inside Playwright. Never deployed.
      command: 'PN_OUT_DIR=dist-e2e VITE_SUPABASE_URL=http://fake.supabase.test VITE_SUPABASE_ANON_KEY=e2e-anon-key npx vite build --logLevel warn && npx vite preview --outDir dist-e2e --port 5176 --strictPort',
      url: 'http://localhost:5176/pa-nashe-tracker/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
