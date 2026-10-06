// Browser smoke test of the production build (_site/), served like GitHub Pages.
//   npm run build && npm run smoke
// The deploy runs it before publishing, so a build that doesn't load never goes live.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:8139/ucg-routine-planner/', browserName: 'chromium' },
  webServer: { command: 'node tools/preview.mjs', url: 'http://localhost:8139/ucg-routine-planner/', reuseExistingServer: !process.env.CI },
});
