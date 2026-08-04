/**
 * TJ-1428: the scorecard check-detail pages ranked #1-2 in Google for exact
 * dotted check-id queries (e.g. `"markdown.canonical-header" scorecard check`)
 * but earned 0 clicks, because the <title> led with the prose check name and
 * omitted the id and the words "check" / "scorecard" that searchers type.
 *
 * The title must now lead with the dotted check id (`${id}`), carry the a14y
 * brand and the words "check" and "scorecard", and the prose title must move
 * into the meta description so the SERP snippet still explains the check.
 *
 * These read the page source (the repo's convention for page-title tests, see
 * homepage-hero.test.ts): the title is composed from route params, so the
 * template is the contract.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const page = readFileSync(
  path.resolve(__dirname, '../src/pages/scorecards/[version]/checks/[id].astro'),
  'utf-8',
);

/** The single `title={...}` prop passed to <BaseLayout>. */
function baseLayoutTitle(src: string): string {
  const match = /<BaseLayout[\s\S]*?\btitle=\{`([^`]*)`\}/.exec(src);
  if (!match) throw new Error('Could not find the BaseLayout title template');
  return match[1]!;
}

function baseLayoutDescription(src: string): string {
  const match = /<BaseLayout[\s\S]*?\bdescription=\{`([^`]*)`\}/.exec(src);
  if (!match) throw new Error('Could not find the BaseLayout description template');
  return match[1]!;
}

describe('check-detail page <title> (TJ-1428)', () => {
  const title = baseLayoutTitle(page);

  it('leads with the dotted check id so it matches exact-id searches', () => {
    // `${id}` must be the very first thing in the title, before any literal.
    expect(title.startsWith('${id}')).toBe(true);
  });

  it('carries the a14y brand and the words "check" and "scorecard"', () => {
    // The three top zero-CTR queries were "<id> scorecard check", "<id> check",
    // and "<id> check scorecard": the title must contain all of these words.
    expect(title).toContain('a14y');
    expect(title).toMatch(/\bcheck\b/);
    expect(title).toMatch(/\bscorecard\b/);
  });

  it('still pins the scorecard version', () => {
    expect(title).toContain('${resolvedVersion}');
  });

  it('no longer leads with the prose check name', () => {
    expect(title.startsWith('${entry.data.title}')).toBe(false);
  });
});

describe('check-detail page meta description (TJ-1428)', () => {
  const description = baseLayoutDescription(page);

  it('folds the prose check title into the snippet', () => {
    expect(description).toContain('${entry.data.title}');
  });

  it('still carries the "why" rationale', () => {
    expect(description).toContain('${entry.data.why}');
  });
});
