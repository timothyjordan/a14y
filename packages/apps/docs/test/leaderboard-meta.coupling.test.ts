import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_FILES,
  DISCOVERY_FILE_CHECK_IDS,
  DISCOVERY_CHECKS_OMITTED_FROM_COPY,
  leaderboardPageDescription,
} from '../src/lib/leaderboard-meta';
import { listAllScorecards, getScorecardByVersion } from '../src/lib/scorecard-data';

/**
 * The leaderboard copy names the discovery files by hand, because it is
 * prose. That makes it exactly the kind of hardcoded list that drifts
 * from the thing it describes, which is the failure TJ-1337 was about:
 * a hand-maintained list quietly falling behind the real data.
 *
 * These tests couple the copy to the scorecard in both directions, so
 * adding or removing a site-level discovery check fails the build until
 * someone decides whether the copy should mention it.
 */

/** Every site-level `<thing>.exists` check id across all scorecards. */
function discoveryCheckIds(): string[] {
  const ids = new Set<string>();
  for (const card of listAllScorecards()) {
    for (const check of getScorecardByVersion(card.version).siteChecks) {
      if (check.id.endsWith('.exists')) ids.add(check.id);
    }
  }
  return [...ids].sort();
}

describe('DISCOVERY_FILES stays coupled to the scorecard', () => {
  it('finds discovery checks at all (guards against a vacuous pass)', () => {
    expect(discoveryCheckIds().length).toBeGreaterThan(0);
  });

  it('names a check id for every file in the copy', () => {
    for (const file of DISCOVERY_FILES) {
      expect(DISCOVERY_FILE_CHECK_IDS[file], `${file} has no mapped check id`).toBeTruthy();
    }
  });

  it('maps every named file to a check that really exists', () => {
    const real = new Set(discoveryCheckIds());
    for (const [file, id] of Object.entries(DISCOVERY_FILE_CHECK_IDS)) {
      expect(real.has(id), `${file} maps to "${id}", which is not a site-level exists check`).toBe(
        true,
      );
    }
  });

  it('accounts for every discovery check, in the copy or in the omissions list', () => {
    // The direction that catches drift. A new site-level discovery
    // check lands here first, and this fails until it is either named
    // in DISCOVERY_FILES or listed as a deliberate omission.
    const named = new Set<string>([
      ...Object.values(DISCOVERY_FILE_CHECK_IDS),
      ...DISCOVERY_CHECKS_OMITTED_FROM_COPY,
    ]);
    const unaccounted = discoveryCheckIds().filter((id) => !named.has(id));
    expect(
      unaccounted,
      'a new site-level discovery check exists. Decide whether the leaderboard copy ' +
        'should name it: add it to DISCOVERY_FILES + DISCOVERY_FILE_CHECK_IDS, or to ' +
        'DISCOVERY_CHECKS_OMITTED_FROM_COPY with a reason.',
    ).toEqual([]);
  });

  it('does not list an omission that is no longer a real check', () => {
    // The reverse staleness: a check retired from the scorecard should
    // not linger in the omissions list pretending to be a decision.
    const real = new Set(discoveryCheckIds());
    for (const id of DISCOVERY_CHECKS_OMITTED_FROM_COPY) {
      expect(real.has(id), `"${id}" is listed as omitted but is not a current check`).toBe(true);
    }
  });

  it('actually renders every named file into the description', () => {
    // Ties the constant to the shipped copy, so a file cannot be listed
    // here while the sentence that mentions it drifts away.
    const description = leaderboardPageDescription('Example', 'https://example.com', 50);
    for (const file of DISCOVERY_FILES) {
      expect(description, `description omits ${file}`).toContain(file);
    }
  });
});
