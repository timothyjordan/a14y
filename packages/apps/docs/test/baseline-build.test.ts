import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// These tests guard the wiring of the A14Y_BASELINE build flag at the
// source level — they don't run `astro build`, they assert that the
// files we audit-trail the flag through actually carry the gating
// code. A runtime test for the badge widget's neutralized href lives
// alongside its existing tests in build-badge-html.test.ts.
//
// Why source-level: spinning up Astro inside vitest to render
// BaseLayout under each flag value is heavy and brittle. The
// integration-skip logic, the conditional <head> tags, the footer
// gate, and the banner are simple enough that string-match guards
// keep them from being accidentally undone in a future refactor.

const REPO = path.resolve(__dirname, '..');

const astroConfig = readFileSync(path.join(REPO, 'astro.config.ts'), 'utf8');
const baseLayout = readFileSync(
  path.join(REPO, 'src/layouts/BaseLayout.astro'),
  'utf8',
);
const buildBadgeSrc = readFileSync(
  path.join(REPO, 'src/lib/build-badge-html.ts'),
  'utf8',
);
const pkgJson = JSON.parse(
  readFileSync(path.join(REPO, 'package.json'), 'utf8'),
);

describe('A14Y_BASELINE build flag — astro.config.ts', () => {
  it('skips the discovery-files and markdown-mirrors integrations when set', () => {
    expect(astroConfig).toMatch(/process\.env\.A14Y_BASELINE\s*===\s*'1'/);
    // Both agent-readability integrations live behind the gate. The
    // assertCoverageIntegration stays on for both variants — it's a
    // content-coverage safety net, not an agent-readability feature.
    expect(astroConfig).toMatch(
      /isBaseline[\s\S]*?markdownMirrorsIntegration\(\)[\s\S]*?discoveryFilesIntegration\(\)/,
    );
    expect(astroConfig).toMatch(/assertCoverageIntegration\(\)/);
  });

  it('points the baseline build at https://baseline.a14y.dev', () => {
    expect(astroConfig).toMatch(
      /isBaseline\s*\?\s*'https:\/\/baseline\.a14y\.dev'\s*:\s*'https:\/\/a14y\.dev'/,
    );
  });
});

describe('A14Y_BASELINE build flag — BaseLayout.astro', () => {
  it('reads the flag from process.env at SSR time', () => {
    expect(baseLayout).toMatch(
      /const isBaseline = process\.env\.A14Y_BASELINE === '1'/,
    );
  });

  // Earlier revisions of the baseline build included a "Baseline build
  // — … real product is at a14y.dev" banner so a careful agent could
  // tell the page apart from the enhanced site. We removed it because
  // an agent that read the banner text might WebFetch a14y.dev and
  // contaminate the before/after measurement: baseline-specific UI
  // must not mention or link to a14y.dev (see feedback memory
  // `feedback-baseline-no-a14y-mentions`). This guard makes sure the
  // banner doesn't sneak back in.
  it('does NOT render a baseline-only banner (would tempt agents to WebFetch a14y.dev)', () => {
    expect(baseLayout).not.toMatch(/baseline-banner/);
    expect(baseLayout).not.toMatch(/Baseline build —/);
    // No `{isBaseline && <...>}` markup branch lurking either — the
    // flag is only used to gate things OFF, never to render new
    // baseline-only DOM.
    expect(baseLayout).not.toMatch(/\{isBaseline && </);
  });

  it('omits canonical, alternate, and agent-skills <link> tags in baseline', () => {
    expect(baseLayout).toMatch(
      /\{!isBaseline && \(\s*<>\s*<link rel="canonical"[\s\S]*?<link rel="alternate" type="text\/markdown"[\s\S]*?<link rel="agent-skills"/,
    );
  });

  it('omits the meta description in baseline', () => {
    expect(baseLayout).toMatch(
      /\{!isBaseline && <meta name="description"/,
    );
  });

  it('omits og:* and twitter:* meta in baseline', () => {
    expect(baseLayout).toMatch(
      /\{!isBaseline && \(\s*<>\s*<meta property="og:title"[\s\S]*?<meta name="twitter:image"/,
    );
  });

  it('omits the JSON-LD <script type="application/ld+json"> in baseline', () => {
    expect(baseLayout).toMatch(
      /\{!isBaseline && <script type="application\/ld\+json"/,
    );
  });

  it('hides the "For agents" footer column in baseline', () => {
    expect(baseLayout).toMatch(
      /\{!isBaseline && \(\s*<div class="footer-col">\s*<h4>For agents<\/h4>/,
    );
  });

  it('keeps <html lang="en"> and semantic landmarks (these serve assistive tech, not just agents)', () => {
    // These are deliberately NOT gated by isBaseline — the baseline
    // site must still be good for human accessibility, just unhelpful
    // to crawling agents.
    expect(baseLayout).toMatch(/<html lang="en">/);
    expect(baseLayout).toMatch(/<header class="site-header">/);
    expect(baseLayout).toMatch(/<main class=/);
    expect(baseLayout).toMatch(/<footer class="site-footer">/);
    expect(baseLayout).toMatch(/<nav class="site-nav" aria-label="Primary">/);
  });
});

describe('A14Y_BASELINE build flag — build-badge-html.ts', () => {
  it('neutralizes the badge href to "#" when the flag is set', () => {
    expect(buildBadgeSrc).toMatch(/process\.env\?\.A14Y_BASELINE === '1'/);
    expect(buildBadgeSrc).toMatch(
      /const badgeHref = isBaseline \? '#' : 'https:\/\/a14y\.dev'/,
    );
    expect(buildBadgeSrc).toMatch(/href="\$\{badgeHref\}"/);
  });
});

describe('A14Y_BASELINE build flag — package.json scripts', () => {
  it('exposes build:baseline, dev:baseline, and preview:baseline', () => {
    expect(pkgJson.scripts['build:baseline']).toContain('A14Y_BASELINE=1');
    expect(pkgJson.scripts['build:baseline']).toContain('--outDir dist-baseline');
    expect(pkgJson.scripts['dev:baseline']).toContain('A14Y_BASELINE=1');
    expect(pkgJson.scripts['dev:baseline']).toContain('--port 4322');
    expect(pkgJson.scripts['preview:baseline']).toContain('DIST_DIR=dist-baseline');
    expect(pkgJson.scripts['preview:baseline']).toContain('PORT=4322');
  });

  it('keeps the regular dev/build/preview scripts unchanged', () => {
    expect(pkgJson.scripts.dev).toBe('astro dev');
    expect(pkgJson.scripts.build).toBe('astro build');
    expect(pkgJson.scripts.preview).toBe('node scripts/preview.mjs');
  });
});
