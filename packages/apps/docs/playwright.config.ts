import { defineConfig, devices } from '@playwright/test';

// E2E runner for the docs site. The leaderboard click-to-scan spec drives a real
// browser against `astro dev`; cross-origin scan fetches are intercepted by the
// spec's own `page.route` stub, so no scan proxy needs to run. The dev server
// only needs PUBLIC_SCAN_PROXY_URL to be *set* (non-empty) so the client engine
// has a base URL to call — the value points at the stubbed host.
const PORT = Number(process.env.E2E_PORT ?? 4321);
const PROXY_URL = process.env.PUBLIC_SCAN_PROXY_URL ?? 'http://localhost:8787';
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PUBLIC_SCAN_PROXY_URL: PROXY_URL },
  },
});
