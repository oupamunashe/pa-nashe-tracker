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
  webServer: {
    command: 'npx vite --mode demo --port 5174 --strictPort',
    url: 'http://localhost:5174/pa-nashe-tracker/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
