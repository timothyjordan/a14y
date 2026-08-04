/**
 * TJ-1432: /scorecards/scoring/ showed up in GSC as "Crawled - currently not
 * indexed". It was the only content hub linked purely from deep scorecard /
 * leaderboard pages, never from the global chrome. BaseLayout renders on every
 * page, so a link here is a site-wide internal link that helps the page clear
 * Google's indexing bar.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const layout = readFileSync(
  path.resolve(__dirname, '../src/layouts/BaseLayout.astro'),
  'utf-8',
);

describe('global chrome links /scorecards/scoring/ (TJ-1432)', () => {
  it('BaseLayout links to the scoring methodologies hub', () => {
    // Present on every page because BaseLayout wraps them all.
    expect(layout).toMatch(/href=\{`\$\{base\}\/scorecards\/scoring\/`\}/);
  });

  it('gives the link human-readable text, not a bare URL', () => {
    expect(layout).toMatch(
      /href=\{`\$\{base\}\/scorecards\/scoring\/`\}>\s*Scoring methodologies\s*<\/a>/,
    );
  });

  it('still links the parent scorecards index (the new link is additive)', () => {
    expect(layout).toMatch(/href=\{`\$\{base\}\/scorecards\/`\}>\s*Scorecards\s*<\/a>/);
  });
});
