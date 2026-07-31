import { test, expect } from '@playwright/test';

/**
 * The per-site leaderboard pages carried 61% of the site's search
 * impressions and converted zero clicks, because their titles and
 * descriptions never named the discovery files people were searching
 * for (TJ-1348). These assert what a crawler actually receives.
 *
 * `merriam-webster` is the fixture on purpose: it is the site from the
 * one visible non-brand query in the Search Console export
 * (`merriam-webster robots sitemap.xml`).
 *
 * The `.md` mirrors are not asserted here. They are written at
 * `astro:build:done` from the rendered HTML, so they do not exist under
 * `astro dev`, which is what this suite runs against. Their wiring is
 * covered by the readRenderedMetadata and decodeHtmlEntities unit tests.
 */

const DISCOVERY_FILES = ['llms.txt', 'AGENTS.md', 'robots.txt', 'sitemap.xml'];

test.describe('leaderboard per-site metadata', () => {
  test('the title names the files people search for', async ({ page }) => {
    await page.goto('/leaderboard/merriam-webster/');
    const title = await page.title();

    expect(title).toContain('Merriam-Webster');
    for (const file of ['llms.txt', 'robots.txt', 'sitemap.xml']) {
      expect(title, `title should name ${file}`).toContain(file);
    }
    // Brand recognition: `a14y` is the site's best-converting query.
    expect(title).toContain('a14y');
    // An ampersand would reach the markdown mirrors escaped.
    expect(title).not.toContain('&');
    expect(title).not.toContain('—');
    expect(title.trim()).toBe(title);
  });

  test('the description leads with the score and names every discovery file', async ({ page }) => {
    await page.goto('/leaderboard/merriam-webster/');
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');

    expect(description).toBeTruthy();
    expect(description!).toMatch(/Merriam-Webster scores \d{1,3}\/100 for agent readability\./);
    for (const file of DISCOVERY_FILES) {
      expect(description!, `description should name ${file}`).toContain(file);
    }
    // The host, not the full URL: the budget is better spent on words.
    expect(description!).toContain('www.merriam-webster.com');
    expect(description!).not.toContain('https://');
    for (const junk of ['undefined', 'null', 'NaN']) {
      expect(description!).not.toContain(junk);
    }
  });

  test('titles stay distinct across sites so no two results collide', async ({ page }) => {
    const titles: string[] = [];
    for (const slug of ['merriam-webster', 'stripe', '1password']) {
      await page.goto(`/leaderboard/${slug}/`);
      titles.push(await page.title());
    }
    expect(new Set(titles).size).toBe(titles.length);
  });
});
