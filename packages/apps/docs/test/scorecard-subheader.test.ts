import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ScorecardSubHeader from '../src/components/ScorecardSubHeader.astro';
import { getLatestScorecardVersion, getScorecardByVersion } from '../src/lib/scorecard-data';

const BASE_LAYOUT_PATH = fileURLToPath(new URL('../src/layouts/BaseLayout.astro', import.meta.url));

describe('ScorecardSubHeader', () => {
  it('renders the version selector and release date for the active version', async () => {
    const container = await AstroContainer.create();
    const version = getLatestScorecardVersion();
    const html = await container.renderToString(ScorecardSubHeader, {
      props: { version },
    });

    const releasedAt = getScorecardByVersion(version).releasedAt;
    expect(html).toContain('class="scorecard-subheader"');
    expect(html).toContain('data-version-selector');
    expect(html).toContain(`released ${releasedAt}`);
  });
});

describe('BaseLayout scorecard sub-header wiring', () => {
  const layoutSource = fs.readFileSync(BASE_LAYOUT_PATH, 'utf-8');

  it('renders the sub-header outside the primary nav', () => {
    // Sub-header is a sibling of <header>, not a child of <nav>. Both
    // assertions matter: the bug being fixed was the version selector
    // sitting inside .site-nav alongside the primary links.
    const navBlock = layoutSource.match(/<nav[\s\S]*?<\/nav>/);
    expect(navBlock).not.toBeNull();
    expect(navBlock![0]).not.toContain('VersionSelector');
    expect(navBlock![0]).not.toContain('ScorecardSubHeader');
    expect(layoutSource).toMatch(/<\/header>\s*\{showVersionSelector && <ScorecardSubHeader/);
  });

  it('only renders the sub-header when showVersionSelector is true', () => {
    expect(layoutSource).toContain('{showVersionSelector && <ScorecardSubHeader');
  });
});
