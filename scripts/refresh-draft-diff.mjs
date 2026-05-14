#!/usr/bin/env node
/**
 * Refreshes packages/core/src/scorecard/draft-changes.json based on the
 * net diff between the latest published scorecard and the current draft.
 *
 * Two modes:
 *
 *   node scripts/refresh-draft-diff.mjs            # workflow mode (writes JSON)
 *   node scripts/refresh-draft-diff.mjs --local    # preview mode (prints, no write)
 *
 * Workflow mode expects these env vars to be set by the GitHub Actions job:
 *
 *   PR_NUMBER       — PR number triggering the run (or "" for workflow_dispatch / audit on main)
 *   PR_URL          — full PR HTML URL (or "" when not in a PR context)
 *   PR_AUTHOR       — GitHub username of the contributor
 *   PR_AUTHOR_URL   — full URL to the contributor's GitHub profile
 *   MERGED_AT       — ISO timestamp (optional; defaults to now)
 *
 * Reconciliation rules:
 *
 *   - For every net-diff change (added / removed / bumped) not yet recorded
 *     in draft-changes.json, append a new entry attributed to the current
 *     PR (or to "audit" if PR context is empty).
 *   - For every entry already in draft-changes.json that still matches a
 *     net-diff change, preserve its original attribution.
 *   - For every entry whose check id + kind no longer appears in the net
 *     diff (because a later PR superseded the earlier one), drop it. This
 *     is the conflict-resolution behavior.
 *
 * The script imports compiled core, so the workflow must build core before
 * invoking it. Local preview mode does the same — run
 * `npm run build --workspace @a14y/core` once and the import resolves.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(REPO_ROOT, 'packages/core/src/scorecard/draft-changes.json');

const args = new Set(process.argv.slice(2));
const isLocal = args.has('--local');

const core = await loadCore();
const { SCORECARDS, LATEST_SCORECARD, DRAFT_SCORECARD_VERSION, loadDraftChanges } = core;

const latestChecks = SCORECARDS[LATEST_SCORECARD]?.checks;
const draftChecks = SCORECARDS[DRAFT_SCORECARD_VERSION]?.checks;
if (!latestChecks || !draftChecks) {
  console.error(
    `Could not load scorecards. Available: ${Object.keys(SCORECARDS).join(', ')}`,
  );
  process.exit(1);
}

const netDiff = diffCheckMaps(latestChecks, draftChecks);
const existing = loadDraftChanges();
const reconciled = reconcile(existing, netDiff);

if (isLocal) {
  printPreview(existing, reconciled);
  process.exit(0);
}

const nextJsonText = `${JSON.stringify(reconciled, null, 2)}\n`;
const currentJsonText = await fs.readFile(JSON_PATH, 'utf8');
if (nextJsonText === currentJsonText) {
  console.log('[refresh-draft-diff] No changes to draft-changes.json.');
  process.exit(0);
}

await fs.writeFile(JSON_PATH, nextJsonText, 'utf8');
console.log('[refresh-draft-diff] draft-changes.json updated.');

// ────────────────────────────────────────────────────────────────────────

async function loadCore() {
  // Use the CJS build via createRequire — the ESM build emits
  // extension-less internal imports, which native Node ESM cannot
  // resolve. The CJS build's resolver tolerates that just fine.
  const corePath = path.join(REPO_ROOT, 'packages/core/dist/cjs/index.js');
  try {
    await fs.access(corePath);
  } catch {
    console.error(
      `[refresh-draft-diff] Could not find compiled core at ${corePath}.\n` +
        'Run: npm run build --workspace @a14y/core',
    );
    process.exit(1);
  }
  const require = createRequire(import.meta.url);
  return require(corePath);
}

function diffCheckMaps(from, to) {
  const added = [];
  const removed = [];
  const bumped = [];
  for (const [id, toImpl] of Object.entries(to)) {
    const fromImpl = from[id];
    if (fromImpl === undefined) {
      added.push({ id, toImpl });
    } else if (fromImpl !== toImpl) {
      bumped.push({ id, fromImpl, toImpl });
    }
  }
  for (const [id, fromImpl] of Object.entries(from)) {
    if (to[id] === undefined) removed.push({ id, fromImpl });
  }
  return { added, removed, bumped };
}

function reconcile(existing, netDiff) {
  const netKey = (entry) => `${entry.kind}::${entry.checkId}`;
  const netKeys = new Set();
  for (const c of netDiff.added) netKeys.add(`added::${c.id}`);
  for (const c of netDiff.bumped) netKeys.add(`bumped::${c.id}`);
  for (const c of netDiff.removed) netKeys.add(`removed::${c.id}`);

  // Keep only entries that still match a net-diff change.
  const kept = existing.changes.filter((entry) => netKeys.has(netKey(entry)));
  const keptKeys = new Set(kept.map(netKey));

  const attribution = buildAttributionContext();
  const fresh = [];

  for (const c of netDiff.added) {
    const key = `added::${c.id}`;
    if (keptKeys.has(key)) continue;
    fresh.push({
      checkId: c.id,
      kind: 'added',
      toImpl: c.toImpl,
      ...attribution,
    });
  }
  for (const c of netDiff.bumped) {
    const key = `bumped::${c.id}`;
    if (keptKeys.has(key)) continue;
    fresh.push({
      checkId: c.id,
      kind: 'bumped',
      fromImpl: c.fromImpl,
      toImpl: c.toImpl,
      ...attribution,
    });
  }
  for (const c of netDiff.removed) {
    const key = `removed::${c.id}`;
    if (keptKeys.has(key)) continue;
    fresh.push({
      checkId: c.id,
      kind: 'removed',
      fromImpl: c.fromImpl,
      ...attribution,
    });
  }

  const merged = [...kept, ...fresh];
  merged.sort((a, b) => {
    const at = a.mergedAt ?? '';
    const bt = b.mergedAt ?? '';
    if (at !== bt) return at.localeCompare(bt);
    return a.checkId.localeCompare(b.checkId);
  });

  return {
    since: existing.since,
    changes: merged,
  };
}

function buildAttributionContext() {
  const pr = Number(process.env.PR_NUMBER || '0') || 0;
  return {
    pr,
    prUrl: process.env.PR_URL ?? '',
    author: process.env.PR_AUTHOR ?? 'unknown',
    authorUrl: process.env.PR_AUTHOR_URL ?? '',
    mergedAt: process.env.MERGED_AT || new Date().toISOString(),
  };
}

function printPreview(before, after) {
  const beforeText = `${JSON.stringify(before, null, 2)}\n`;
  const afterText = `${JSON.stringify(after, null, 2)}\n`;
  if (beforeText === afterText) {
    console.log('[refresh-draft-diff] (local preview) No changes — draft-changes.json is up to date.');
    return;
  }
  console.log('[refresh-draft-diff] (local preview) draft-changes.json would change:');
  console.log('');
  console.log('--- current ---');
  console.log(beforeText.trim());
  console.log('');
  console.log('+++ would be +++');
  console.log(afterText.trim());
}
