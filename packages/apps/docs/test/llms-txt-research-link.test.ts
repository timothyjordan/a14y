import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * TJ-1344. `/research/llms-txt-linking/` is the measured evidence for
 * the `llms-txt.*` checks, and none of those pages linked to it.
 *
 * The finding is a caveat, not a promotion: publishing llms.txt cuts an
 * agent's tokens, but no in-page signal got the agent to read it. These
 * tests hold the pages to stating that honestly, and hold the cited
 * numbers to the study they came from.
 */

const CHECKS_DIR = path.resolve(__dirname, '../src/content/checks');
const CHECK_IDS = [
  'llms-txt.exists',
  'llms-txt.non-empty',
  'llms-txt.content-type',
  'llms-txt.md-extensions',
];

const read = (id: string) => readFileSync(path.join(CHECKS_DIR, `${id}.md`), 'utf-8');
const study = readFileSync(
  path.resolve(__dirname, '../src/pages/research/llms-txt-linking.astro'),
  'utf-8',
);

describe('llms-txt.* check pages link the linking study (TJ-1344)', () => {
  it.each(CHECK_IDS)('%s links the study', (id) => {
    expect(read(id)).toContain('/research/llms-txt-linking/');
  });

  it.each(CHECK_IDS)('%s carries the link under its own section, not buried mid-prose', (id) => {
    expect(read(id)).toMatch(/^## What we measured$/m);
  });

  it.each(CHECK_IDS)('%s states the caveat, not just the upside', (id) => {
    const body = read(id);
    // The load-bearing half of the finding. A page that only quoted the
    // 33% would be using the study as marketing for its own check,
    // which is the opposite of what it found.
    expect(body).toContain('0 times out of 5');
    expect(body).toMatch(/prompt/i);
  });

  it.each(CHECK_IDS)('%s keeps the study out of the external references list', (id) => {
    // `references` is the external-spec list (llmstxt.org, MDN). The
    // caveat needs surrounding context that a bare link title cannot
    // carry, so it lives in the prose instead.
    const frontmatter = read(id).split('---')[1] ?? '';
    expect(frontmatter).not.toContain('llms-txt-linking');
  });
});

describe('the cited numbers match the study (TJ-1344)', () => {
  // Numbers restated in prose drift. These pin the check pages to the
  // study page they came from, so a re-run that changes the benchmark
  // fails here instead of leaving four pages quietly contradicting it.
  const CITED = ['177,735', '266,591'];

  it.each(CITED)('%s appears in the study', (n) => {
    expect(study).toContain(n);
  });

  it('the quoted 33% is what those two numbers actually give', () => {
    const [after, before] = CITED.map((n) => Number(n.replace(/,/g, '')));
    const pct = Math.round(((before! - after!) / before!) * 100);
    expect(pct).toBe(33);
    for (const id of CHECK_IDS) {
      expect(read(id)).toContain('33% fewer tokens');
    }
  });

  it.each(CHECK_IDS)('%s cites both sides of the comparison, not a bare percentage', (id) => {
    const body = read(id);
    for (const n of CITED) expect(body).toContain(n);
  });
});

describe('content-type does not overclaim (TJ-1344)', () => {
  it('says the benchmark held the content type constant', () => {
    // The study never varied the content type, so this check page must
    // not imply the 33% says anything about serving text/plain.
    const body = read('llms-txt.content-type');
    expect(body).toContain('text/plain');
    expect(body).toMatch(/never varied it|does not measure/);
  });

  it('the study really did hold it constant', () => {
    // Guard on the premise: if a future re-run adds a content-type arm,
    // this fails and the disclaimer above needs revisiting.
    expect(study).not.toMatch(/content-type arm|application\/octet-stream/i);
  });
});
