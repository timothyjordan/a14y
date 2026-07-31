import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const page = readFileSync(path.resolve(__dirname, '../src/pages/index.astro'), 'utf-8');
const css = readFileSync(path.resolve(__dirname, '../src/styles/global.css'), 'utf-8');

/**
 * TJ-1345. The homepage is the only page on the site that has ever
 * converted a search click, and until now it linked to the research
 * exactly once, from an inline anchor mid-paragraph in the lead. This
 * section gives the research a destination.
 *
 * These are source-level guards, matching the convention in
 * homepage-hero.test.ts, since .astro pages cannot be imported into
 * vitest. The rendered behaviour is covered by
 * e2e/homepage-research-section.spec.ts.
 */
describe('homepage research section (TJ-1345)', () => {
  const section = page.slice(
    page.indexOf('class="section research-findings"'),
    page.indexOf('</BaseLayout>'),
  );

  it('exists, with its own heading rather than a bare list of links', () => {
    expect(section).toContain('id="findings-heading"');
    expect(section).toMatch(/<h2 id="findings-heading">What actually moves a score<\/h2>/);
  });

  it('leads each finding with the claim, not the article title', () => {
    // The point of the section: a reader who never clicks still learns
    // what the research found. Article titles would make it a link
    // strip, which is the thing this explicitly is not.
    for (const claim of [
      'Most of the web is not ready.',
      'A few fixes do most of the work.',
      'Publishing a file is not the same as getting it read.',
    ]) {
      expect(section).toContain(claim);
    }
  });

  it('links the three articles that had no homepage distribution', () => {
    for (const slug of [
      'state-of-agent-readability',
      'per-feature-ablation',
      'llms-txt-linking',
    ]) {
      expect(section, `${slug} should be linked`).toContain(`/research/${slug}/`);
    }
  });

  it('does not spend a slot on scorecard-evals, which the lead already sends people to', () => {
    expect(section).not.toContain('scorecard-evals');
  });

  it('leaves the "In one study" lead link untouched', () => {
    // Explicitly out of scope: it earns the claim in the lead with a
    // real number, in the right place. A future edit to this section
    // must not quietly absorb it.
    expect(page).toContain('>In one study</a>');
    expect(page).toContain('const evidenceUrl = caseStudyUrl(evidenceStudy.slug, base)');
  });

  it('reads the survey numbers from the dataset rather than hardcoding them', () => {
    // A hardcoded median would drift the moment the bulk publish runs,
    // and a wrong number on the homepage is worse than no number.
    expect(section).toContain('{bulkTotal.toLocaleString');
    expect(section).toContain('{bulkMedian}');
    expect(section).toContain('{bulkMax}');
    expect(page).toMatch(/const bulkMedian = bulkScores\.length/);
    expect(page).toMatch(/const bulkMax = bulkScores\.length/);
  });

  it('drops the survey finding entirely when the bulk dataset is absent', () => {
    // Fresh checkouts have not run the bulk publish. Rendering a
    // "median scores 0 of 100" claim would be a lie, so the finding is
    // gated on the data existing.
    expect(section).toMatch(/\{bulkLb && \(/);
  });

  it('reuses the existing histogram component rather than a new chart', () => {
    expect(page).toContain("import ScoreHistogram from '~/components/research/ScoreHistogram.astro'");
    expect(section).toContain('<ScoreHistogram buckets={bulkBuckets} />');
  });
});

describe('homepage research section styling (TJ-1345)', () => {
  const block = css.slice(css.indexOf('Research findings (homepage)'));

  it('separates findings with rules rather than card chrome', () => {
    // The page already carries a card grid (tools) and a numbered
    // sequence (steps) above. A third card grid would read as one more
    // row of teasers.
    expect(block).toContain('.research-findings .finding {');
    expect(block).toMatch(/\.research-findings \.finding \{[^}]*border-top: 1px solid var\(--border\)/);
    expect(block).not.toMatch(/\.finding[^}]*box-shadow/);
  });

  it('never uses a coloured side stripe as an accent', () => {
    expect(block).not.toMatch(/\.finding[\s\S]{0,200}border-(left|right):\s*(?![01]px)/);
  });

  it('hides the chart on narrow screens instead of squeezing it', () => {
    expect(block).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.finding-chart \{ display: none; \}/);
  });

  it('collapses the lead finding to one column before the pair wraps', () => {
    expect(block).toMatch(/@media \(max-width: 860px\)[\s\S]*?\.finding--lead \{ grid-template-columns: 1fr;/);
  });

  it('honours prefers-reduced-motion for the link arrow', () => {
    expect(block).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.finding-links a:hover::after \{ transform: none; \}/,
    );
  });
});
