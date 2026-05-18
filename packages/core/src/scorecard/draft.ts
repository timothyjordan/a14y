import type { ScorecardManifest } from './types';
import { SCORECARD_0_2_0 } from './v0_2';

/**
 * Draft scorecard — the in-progress rubric the next published scorecard
 * will be cut from.
 *
 * Unlike the frozen `v0_*.ts` manifests, THIS FILE IS MUTABLE. It is the
 * only place where new check ids should be pinned, where existing pins
 * should be bumped to a new implementation version, or where deprecated
 * checks should be removed before the cut. Contributions to the scorecard
 * land here via PRs to `main`.
 *
 * On cut day, this file is copied to a frozen `v0_N.ts`, the `-draft`
 * suffix is dropped, and `draft.ts` is reseeded from the freshly cut
 * manifest with the next planned version. See RELEASING.md for the full
 * cut procedure.
 *
 * The version uses a semver pre-release identifier (`-draft`) so that:
 *   - it parses cleanly in any semver-aware tooling;
 *   - it sorts before the eventual stable release of the same number;
 *   - consumers can opt in explicitly via `--scorecard 0.3.0-draft` or the
 *     `'draft'` alias resolved by the registry.
 */
export const SCORECARD_DRAFT: ScorecardManifest = {
  version: '0.3.0-draft',
  releasedAt: 'unreleased',
  description:
    'Draft scorecard — subject to change before release. PRs adding or revising checks land here, then this manifest is frozen at cut time. See CONTRIBUTING.md.',
  // Pinned to per-check-mean-v1 ahead of the v0.3.0 cut. The real impl ships
  // in TJ-561; until then computeScore() returns flat-pool-v1 numbers as a
  // stub so this contract change can be reviewed in isolation. See the
  // "Scoring methodology" section on /scorecards/ for the rationale.
  scoringMethodology: 'per-check-mean-v1',
  checks: {
    ...SCORECARD_0_2_0.checks,
    'markdown.navigation-stripped': '1.0.0',
    'markdown.size-reduction': '1.0.0',
    'markdown.valid-markdown': '1.0.0',
  },
};
