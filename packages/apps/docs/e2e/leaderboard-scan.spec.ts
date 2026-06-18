import { test, expect } from '@playwright/test';

test('expanding a leaderboard row runs a scan and shows a score', async ({ page }) => {
  // Stub the scan proxy so no real network egress happens. Adjust the glob to
  // match SCAN_PROXY_URL's shape (read src/lib/scan/config.ts).
  await page.route('**/*proxy*/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html',
      body: '<html lang="en"><head><title>t</title></head><body><h1>h</h1><p>' + 'x'.repeat(400) + '</p></body></html>' });
  });
  await page.goto('/research/web/');
  const firstToggle = page.locator('.lb-scan-toggle').first();
  await firstToggle.click();
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.scan-score-num').first()).toBeVisible({ timeout: 20000 });
});
