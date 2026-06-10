import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const page = readFileSync(
  path.resolve(__dirname, '../src/pages/leaderboard/[slug]/index.astro'),
  'utf-8',
);

describe('per-site report page embed-badge CTA (TJ-642 activation)', () => {
  it('imports buildBadgeUrl from @a14y/core', () => {
    expect(page).toMatch(
      /import\s*\{\s*buildBadgeUrl\s*\}\s*from\s*['"]@a14y\/core['"]/,
    );
  });

  it('renders an "Embed your badge" anchor inside the scorecard hero', () => {
    expect(page).toMatch(/class="embed-badge-cta"/);
    expect(page).toMatch(/href=\{buildBadgeUrl\(run\)\}/);
    expect(page).toMatch(/Embed your badge/);
  });

  it('sets a per-site aria-label so screen readers read which site the badge belongs to', () => {
    expect(page).toMatch(/aria-label=\{`Embed Agent-Ready badge for \$\{entry\.name\}`\}/);
  });
});
