import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import LeaderboardTable from '../src/components/research/LeaderboardTable.astro';
import {
  getLatestAvailableScorecard,
  getLeaderboard,
  getResearchData,
  leaderboardEntryBadgeUrl,
} from '../src/lib/research-data';

describe('LeaderboardTable Badge column (TJ-642 activation)', () => {
  it('renders a "Badge" column header at the end of the table, after Top failures', async () => {
    const container = await AstroContainer.create();
    const entries = getLeaderboard().slice(0, 1);
    const scorecardVersion =
      getLatestAvailableScorecard() ?? getResearchData().scorecardVersion;
    const html = await container.renderToString(LeaderboardTable, {
      props: { entries, scorecardVersion },
    });
    // The header should include "Top failures" then "Badge" in order.
    const failIdx = html.indexOf('>Top failures<');
    const badgeIdx = html.indexOf('>Badge<');
    expect(failIdx).toBeGreaterThan(-1);
    expect(badgeIdx).toBeGreaterThan(failIdx);
  });

  it('renders a "Badge" link in every row pointing at /badge/?... with a per-site aria-label', async () => {
    const container = await AstroContainer.create();
    const entries = getLeaderboard().slice(0, 3);
    const scorecardVersion =
      getLatestAvailableScorecard() ?? getResearchData().scorecardVersion;
    const html = await container.renderToString(LeaderboardTable, {
      props: { entries, scorecardVersion },
    });

    for (const entry of entries) {
      const expectedUrl = leaderboardEntryBadgeUrl(entry, scorecardVersion);
      expect(html).toContain(`href="${expectedUrl}"`);
      expect(html).toContain(`aria-label="Embed Agent-Ready badge for ${entry.name}"`);
    }
  });

  it('uses an anchor for the badge link so the row-click handler does not hijack it', async () => {
    const container = await AstroContainer.create();
    const entries = getLeaderboard().slice(0, 1);
    const scorecardVersion =
      getLatestAvailableScorecard() ?? getResearchData().scorecardVersion;
    const html = await container.renderToString(LeaderboardTable, {
      props: { entries, scorecardVersion },
    });
    // The inline row-click script returns when it sees an anchor. Be
    // certain the badge CTA is an <a>, not a <button> or div.
    expect(html).toMatch(/<a[^>]*class="lb-badge-link"[^>]*>Badge<\/a>/);
  });
});
