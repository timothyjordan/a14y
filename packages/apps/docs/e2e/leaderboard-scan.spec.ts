import { test, expect } from '@playwright/test';

// The client-side scan routes every cross-origin fetch through the scan proxy
// as `${PUBLIC_SCAN_PROXY_URL}/?url=<target>`. The proxy answers 200 and carries
// the real upstream status in `x-a14y-status`; because the page reads that header
// cross-origin, the stub MUST also expose it via CORS, or @a14y/core throws
// "scan proxy error" and no score renders. Run with PUBLIC_SCAN_PROXY_URL set
// (e.g. http://localhost:8787) so the engine has a base URL to call.
const PAGE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Example</title>' +
  '<meta name="description" content="An example page with enough descriptive text to satisfy the meta description check.">' +
  '<link rel="canonical" href="https://ex.com/"></head><body><h1>Example</h1><h2>A</h2><h2>B</h2><p>' +
  'word '.repeat(150) +
  '</p></body></html>';

test('expanding a leaderboard row runs a scan and shows a score', async ({ page }) => {
  await page.route(
    (url) => url.href.includes('localhost:8787'),
    (route) =>
      route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'x-a14y-status, content-type, location',
          'x-a14y-status': '200',
          'content-type': 'text/html; charset=utf-8',
        },
        body: PAGE_HTML,
      }),
  );

  await page.goto('/research/web/');
  const firstToggle = page.locator('.lb-scan-toggle').first();
  await firstToggle.click();
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
  const scoreNum = page.locator('.scan-score-num').first();
  await expect(scoreNum).toBeVisible({ timeout: 30000 });

  // The shared scan-results stylesheet must load on the leaderboard, not just
  // the homepage: the score number is 2.6rem (~41.6px) when styled, vs the
  // ~16px browser default if the CSS is missing (the bug this guards against).
  const fontSizePx = await scoreNum.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSizePx).toBeGreaterThan(30);
});
