import { test, expect } from '@playwright/test';

/**
 * TJ-1426. The page container's width must not depend on which font has
 * loaded.
 *
 * `--max-width-prose` was `68ch`. The `ch` unit is the width of the
 * current font's `0` glyph, and Atkinson Hyperlegible Next is wide
 * enough that every prose page rendered at 693px on the system-ui
 * fallback and snapped to 748px when the webfont arrived: a 55px
 * horizontal reflow on 15 pages.
 *
 * These load each page twice, once with webfonts blocked and once with
 * them loaded, and require the container to be the same width both
 * times. Blocking the font is what makes this a real test: with the
 * font cached, the bug is invisible.
 */

const PROSE_PAGES = [
  '/spec/',
  '/glossary/',
  '/scorecards/',
  '/scorecards/0.2.0/checks/llms-txt.exists/',
  '/privacy/',
];

const WIDE_PAGES = ['/', '/leaderboard/', '/press/'];

const FONT_GLOB = '**/*.{woff,woff2,ttf,otf}';

async function containerWidth(
  browser: import('@playwright/test').Browser,
  baseURL: string,
  path: string,
  { blockFonts }: { blockFonts: boolean },
) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (blockFonts) await context.route(FONT_GLOB, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(baseURL + path, { waitUntil: 'networkidle' });
  if (!blockFonts) await page.evaluate(() => document.fonts.ready);
  const width = await page.evaluate(() =>
    Math.round(document.querySelector('main')!.getBoundingClientRect().width),
  );
  await context.close();
  return width;
}

test.describe('page width does not depend on font loading', () => {
  for (const path of [...PROSE_PAGES, ...WIDE_PAGES]) {
    test(`${path} is the same width with and without the webfont`, async ({
      browser,
      baseURL,
    }) => {
      const withFont = await containerWidth(browser, baseURL!, path, { blockFonts: false });
      const withoutFont = await containerWidth(browser, baseURL!, path, { blockFonts: true });
      expect(
        withoutFont,
        `${path} reflows ${withoutFont - withFont}px when the webfont loads`,
      ).toBe(withFont);
    });
  }
});

test.describe('the two width tiers stay intact', () => {
  // The widths themselves are a design decision, not an accident: 748px
  // is roughly 63 characters per line, and the wide tier exists for the
  // landing, leaderboard, and other layout-heavy pages. Pinning them
  // here means a future token edit has to be deliberate.
  test('prose pages render at the reading width', async ({ browser, baseURL }) => {
    for (const path of PROSE_PAGES) {
      const width = await containerWidth(browser, baseURL!, path, { blockFonts: false });
      expect(width, `${path} should use the prose tier`).toBe(748);
    }
  });

  test('wide pages render at the wide width', async ({ browser, baseURL }) => {
    for (const path of WIDE_PAGES) {
      const width = await containerWidth(browser, baseURL!, path, { blockFonts: false });
      expect(width, `${path} should use the wide tier`).toBe(1120);
    }
  });
});
