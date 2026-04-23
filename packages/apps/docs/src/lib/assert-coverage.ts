import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listScorecards, getScorecard } from '@a14y/core';
import type { AstroIntegration } from 'astro';

/**
 * Build-time integrity check.
 *
 * Walks every shipped scorecard manifest, collects the union of every
 * check id pinned in any manifest, and asserts that
 * `src/content/checks/<id>.md` exists for each one. Throws a single
 * error listing every missing id so the author can fix them all in one
 * pass instead of playing whack-a-mole.
 *
 * This mirrors the runtime guarantee in @a14y/core's
 * `getScorecard()`: a frozen scorecard cannot silently drift if a
 * documentation file is renamed, deleted, or never created.
 */
export function assertCoverage(contentDir?: string): void {
  const dir =
    contentDir ??
    fileURLToPath(new URL('../content/checks/', import.meta.url));

  const allIds = new Set<string>();
  for (const card of listScorecards()) {
    const resolved = getScorecard(card.version);
    for (const c of [...resolved.siteChecks, ...resolved.pageChecks]) {
      allIds.add(c.id);
    }
  }

  const missing: string[] = [];
  for (const id of allIds) {
    const file = path.join(dir, `${id}.md`);
    if (!existsSync(file)) missing.push(id);
  }

  if (missing.length > 0) {
    const lines = missing.sort().map((id) => `  - ${id}.md`);
    throw new Error(
      `Docs site is missing content for ${missing.length} check id(s):\n${lines.join(
        '\n',
      )}\n\nCreate each file under src/content/checks/ with the schema declared in src/content/config.ts.`,
    );
  }
}

/** Astro integration wrapper that runs the assertion at build start. */
export function assertCoverageIntegration(): AstroIntegration {
  return {
    name: 'agentready-assert-coverage',
    hooks: {
      'astro:build:start': () => {
        assertCoverage();
      },
    },
  };
}
