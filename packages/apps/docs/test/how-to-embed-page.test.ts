import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const page = readFileSync(
  path.resolve(__dirname, '../src/pages/badge/how-to-embed.astro'),
  'utf-8',
);

describe('/badge/how-to-embed/ guide page (TJ-642 activation)', () => {
  it('uses BaseLayout and declares an h1', () => {
    expect(page).toMatch(
      /import\s+BaseLayout\s+from\s+['"]~\/layouts\/BaseLayout\.astro['"]/,
    );
    expect(page).toMatch(/<h1>[\s\S]*?How to embed your a14y badge[\s\S]*?<\/h1>/);
  });

  it('covers the three ways to get a snippet (leaderboard, CLI, extension)', () => {
    expect(page).toMatch(/From the leaderboard/i);
    expect(page).toMatch(/From the CLI/i);
    // "From the … Chrome extension" with the markup-wrapped link in between.
    expect(page).toMatch(/From the[\s\S]*Chrome extension/i);
    expect(page).toMatch(/npx a14y check yoursite\.com --scorecard 0\.3\.0-draft/);
  });

  it('links back to /badge/ and /leaderboard/ so readers can act on the guidance', () => {
    expect(page).toContain('${base}/badge/');
    expect(page).toContain('${base}/leaderboard/');
    expect(page).toContain('${base}/chrome-extension/');
  });

  it('warns that scores are pinned to a scorecard version per snapshot', () => {
    expect(page).toMatch(/pinned to a scorecard version/i);
  });
});
