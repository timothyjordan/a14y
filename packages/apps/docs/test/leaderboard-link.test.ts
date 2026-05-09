import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import LeaderboardTable from '../src/components/research/LeaderboardTable.astro';
import { getLeaderboard, getResearchData } from '../src/lib/research-data';

describe('LeaderboardTable', () => {
  it('links each row to the internal /research/<slug>/ page, not the external site', async () => {
    const container = await AstroContainer.create();
    const entries = getLeaderboard().slice(0, 3);
    const html = await container.renderToString(LeaderboardTable, {
      props: {
        entries,
        scorecardVersion: getResearchData().scorecardVersion,
      },
    });

    for (const entry of entries) {
      expect(html).toContain(`href="/research/${entry.slug}/"`);
      // Whole-row click target: every row carries its scorecard URL on
      // data-href so the inline script can navigate from any cell.
      expect(html).toContain(`data-href="/research/${entry.slug}/"`);
    }
    // External-link attributes should be gone — those were the old CTA.
    // The external URL is still surfaced on the per-site scorecard page,
    // never on the leaderboard row.
    const colNameAnchorMatches = html.match(/<td class="col-name"[^>]*>[\s\S]*?<\/td>/g) ?? [];
    expect(colNameAnchorMatches.length).toBeGreaterThan(0);
    for (const cell of colNameAnchorMatches) {
      expect(cell).not.toContain('rel="nofollow noopener"');
      expect(cell).not.toContain('target="_blank"');
    }
  });
});
