import { test, expect } from '@playwright/test';

/**
 * TJ-1349. The header nav used to run off the right edge and take the
 * whole document's horizontal scroll with it.
 *
 * There were two broken bands, not one. Below 480px the four primary
 * links could not share a row with the brand (up to +161px at 320px),
 * and between 641px and 767px the secondary links came back at full
 * size before there was room for them (+51px at 700px), which covers
 * tablets and half-width laptop windows.
 *
 * The widths below deliberately straddle every breakpoint edge.
 */

const WIDTHS = [320, 360, 390, 414, 480, 559, 560, 640, 700, 767, 799, 800, 900, 1024, 1440];

// One of each layout family: prose, wide, and a data-heavy page whose
// own content is the most likely thing to overflow independently.
const PAGES = ['/spec/', '/', '/leaderboard/'];

test.describe('the document never scrolls horizontally', () => {
  for (const width of WIDTHS) {
    test(`no overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of PAGES) {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => {
          const de = document.documentElement;
          return de.scrollWidth - de.clientWidth;
        });
        expect(overflow, `${path} at ${width}px overflows by ${overflow}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe('--site-header-height tracks the real header', () => {
  // The token offsets in-page anchor targets and positions the
  // leaderboard's sticky table head. When the nav wraps to a second row
  // the header grows, and a stale token would tuck both under it.
  for (const width of [320, 390, 559, 560, 800, 1440]) {
    test(`token matches the rendered height at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/spec/');
      await page.evaluate(() => document.fonts.ready);
      const { rendered, token } = await page.evaluate(() => ({
        rendered: Math.round(document.querySelector('.site-header')!.getBoundingClientRect().height),
        token: parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--site-header-height'),
        ),
      }));
      expect(token, `header renders ${rendered}px but the token says ${token}px`).toBe(rendered);
    });
  }
});

test.describe('every destination stays reachable', () => {
  test('the four primary links are visible and clickable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/spec/');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const name of ['Spec', 'Scorecards', 'Leaderboard', 'Research']) {
      const link = nav.getByRole('link', { name, exact: true });
      await expect(link, `${name} should be visible`).toBeVisible();
      // In the viewport, not merely rendered somewhere off to the right.
      const box = await link.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    }
  });

  test('the theme toggle is reachable and works on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/spec/');
    const toggle = page.getByRole('button', { name: 'Toggle dark mode' });
    await expect(toggle).toBeVisible();
    const box = await toggle.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);

    const before = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
    await toggle.click();
    const after = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
    expect(after).not.toBe(before);
  });

  test('the secondary links return once there is room for them', async ({ page }) => {
    // The full nav needs 779px. Below 800 these step aside; at 800 and
    // above all seven fit on one row.
    await page.setViewportSize({ width: 800, height: 800 });
    await page.goto('/spec/');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const name of ['Tools', 'Press', 'GitHub']) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    }

    await page.setViewportSize({ width: 700, height: 800 });
    for (const name of ['Tools', 'Press', 'GitHub']) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeHidden();
    }
  });
});

test.describe('the toggle sits with the brand once the nav wraps', () => {
  test('phone: toggle shares the brand row, nav takes its own', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/spec/');
    await page.evaluate(() => document.fonts.ready);
    const rows = await page.evaluate(() => {
      const top = (sel: string) =>
        Math.round(document.querySelector(sel)!.getBoundingClientRect().top);
      return { brand: top('.brand'), toggle: top('.theme-toggle'), nav: top('.site-nav') };
    });
    expect(Math.abs(rows.toggle - rows.brand)).toBeLessThan(12);
    expect(rows.nav).toBeGreaterThan(rows.brand + 12);
  });

  test('desktop: all three sit on one row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/spec/');
    await page.evaluate(() => document.fonts.ready);
    const rows = await page.evaluate(() => {
      const mid = (sel: string) => {
        const r = document.querySelector(sel)!.getBoundingClientRect();
        return Math.round(r.top + r.height / 2);
      };
      return { brand: mid('.brand'), toggle: mid('.theme-toggle'), nav: mid('.site-nav') };
    });
    expect(Math.abs(rows.nav - rows.brand)).toBeLessThan(6);
    expect(Math.abs(rows.toggle - rows.brand)).toBeLessThan(6);
  });
});

/**
 * Fallout from letting the tool cards shrink (TJ-1349). Before, the
 * cards were stuck at 379px and pushed the homepage sideways; now they
 * fit, but the absolutely-positioned Copy button would sit on top of
 * the command it copies if nothing moved it.
 */
test.describe('tool cards stay legible once they shrink', () => {
  for (const width of [320, 390, 480]) {
    test(`copy button does not cover the command at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const overlaps = await page.evaluate(() =>
        [...document.querySelectorAll('.tool-cmd-wrap')].map((wrap) => {
          const pre = wrap.querySelector('.tool-cmd')!.getBoundingClientRect();
          const btn = wrap.querySelector('.tool-cmd-copy')!.getBoundingClientRect();
          return !(
            btn.left >= pre.right ||
            btn.right <= pre.left ||
            btn.top >= pre.bottom ||
            btn.bottom <= pre.top
          );
        }),
      );
      expect(overlaps.length).toBeGreaterThan(0);
      expect(overlaps.every((o) => o === false)).toBe(true);
    });
  }

  test('the copy button still copies on a phone', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    const button = page.locator('#cli .tool-cmd-copy').first();
    await button.click();
    await expect(button).toHaveAttribute('data-state', 'copied');
  });
});
