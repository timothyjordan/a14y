import { test, expect } from '@playwright/test';

/**
 * TJ-1345. The research section on the homepage. The homepage is the
 * only page on the site that has ever converted a search click, so this
 * is the one surface where linking the research can actually reach
 * anyone. These assert what a visitor receives.
 */

test.describe('homepage research section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders as a section with its own heading', async ({ page }) => {
    const section = page.locator('.research-findings');
    await expect(section).toBeVisible();
    await expect(
      section.getByRole('heading', { name: 'What actually moves a score', level: 2 }),
    ).toBeVisible();
  });

  test('each finding leads with a claim a reader learns without clicking', async ({ page }) => {
    const section = page.locator('.research-findings');
    for (const claim of [
      'Most of the web is not ready.',
      'A few fixes do most of the work.',
      'Publishing a file is not the same as getting it read.',
    ]) {
      await expect(section.getByRole('heading', { name: claim, level: 3 })).toBeVisible();
    }
  });

  test('every link in the section resolves', async ({ page, request }) => {
    const hrefs = await page.locator('.research-findings a').evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!),
    );
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), `${href} should be served`).toBe(200);
    }
  });

  test('links the three under-distributed articles and not scorecard-evals', async ({ page }) => {
    const hrefs = await page.locator('.research-findings a').evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!),
    );
    for (const slug of ['state-of-agent-readability', 'per-feature-ablation', 'llms-txt-linking']) {
      expect(hrefs.some((h) => h.includes(slug)), `${slug} should be linked`).toBe(true);
    }
    // The lead paragraph already sends people to scorecard-evals; a
    // featured slot here would spend space on the one article that
    // already has distribution.
    expect(hrefs.some((h) => h.includes('scorecard-evals'))).toBe(false);
  });

  test('the "In one study" lead link is left intact', async ({ page }) => {
    const lead = page.locator('.lead-evidence-link');
    await expect(lead).toBeVisible();
    await expect(lead).toHaveText('In one study');
    await expect(lead).toHaveAttribute('href', /scorecard-evals/);
  });

  test('the survey numbers match the dataset the study reports', async ({ page, request }) => {
    // Guards against the numbers being typed in by hand and drifting
    // away from the study the section cites.
    const body = await page.locator('.finding--lead .finding-body').innerText();
    const median = body.match(/median scores (\d+) of 100/)?.[1];
    const best = body.match(/best of them managed (\d+)/)?.[1];
    expect(median).toBeTruthy();
    expect(best).toBeTruthy();
    expect(Number(best)).toBeGreaterThan(Number(median));

    // The survey page is generated from the same dataset, so its own
    // headline count must agree with the homepage's.
    const total = body.match(/scored the ([\d,]+) most-visited/)?.[1];
    expect(total).toBeTruthy();
    const survey = await request.get('/research/state-of-agent-readability/');
    expect(survey.status()).toBe(200);
    expect(await survey.text()).toContain(total!);
  });

  test('the histogram describes the buckets it actually draws', async ({ page }) => {
    // The description was hardcoded to "each 10-point score bucket from
    // 0-9 to 90-100", which the published dataset has never matched.
    const svg = page.locator('.research-findings figure svg');
    await expect(svg).toHaveAttribute('role', 'img');

    const labels = await page
      .locator('.research-findings .hist-label')
      .evaluateAll((els) => els.map((e) => e.textContent!.trim()));
    expect(labels.length).toBeGreaterThan(0);

    // textContent, not innerText: <desc> is not a rendered box, so
    // innerText comes back empty.
    const desc = await page
      .locator('.research-findings figure svg desc')
      .evaluate((el) => el.textContent!.trim());
    expect(desc).toContain(labels[0]!);
    expect(desc).toContain(labels[labels.length - 1]!);
  });

  test('drops the chart on a phone rather than squeezing it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.finding-chart')).toBeHidden();
    // The claim and its numbers still carry the finding.
    await expect(
      page.getByRole('heading', { name: 'Most of the web is not ready.', level: 3 }),
    ).toBeVisible();
  });

  test('the section itself never overflows the viewport at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Scoped to this section on purpose. The page as a whole does
    // overflow at 390px, but the offender is nav.site-nav in the shared
    // header, which predates this work and affects every page. Asserting
    // document-level here would make this spec fail for someone else's
    // bug and hide a regression of our own.
    const overflow = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      const offenders: string[] = [];
      for (const el of document.querySelectorAll('.research-findings, .research-findings *')) {
        const box = el.getBoundingClientRect();
        if (box.width > 0 && box.right > limit + 1) {
          offenders.push(`${el.tagName.toLowerCase()}.${el.className || '(none)'}`);
        }
      }
      return offenders;
    });
    expect(overflow).toEqual([]);
  });
});
