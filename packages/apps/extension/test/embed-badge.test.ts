import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const html = readFileSync(path.join(root, 'src/results.html'), 'utf-8');
const ts = readFileSync(path.join(root, 'src/results.ts'), 'utf-8');

describe('embed-badge action in share popover (TJ-424)', () => {
  it('renders an Embed badge anchor inside the share-actions row', () => {
    const actionsRow = html.match(/id="share-actions"[\s\S]*?<\/div>/)?.[0] ?? '';
    const anchor = actionsRow.match(/<a\b[^>]*id="share-embed"[^>]*>/)?.[0] ?? '';
    expect(anchor).not.toBe('');
    expect(anchor).toMatch(/aria-label="Open the embed badge page"/);
    expect(anchor).toMatch(/target="_blank"/);
    expect(anchor).toMatch(/rel="noopener"/);
  });

  it('positions the Embed badge action between Bluesky and Copy', () => {
    const actionsRow = html.match(/id="share-actions"[\s\S]*?<\/div>/)?.[0] ?? '';
    const blueskyIdx = actionsRow.indexOf('id="share-bluesky"');
    const embedIdx = actionsRow.indexOf('id="share-embed"');
    const copyIdx = actionsRow.indexOf('id="share-copy"');
    expect(blueskyIdx).toBeGreaterThan(-1);
    expect(embedIdx).toBeGreaterThan(blueskyIdx);
    expect(copyIdx).toBeGreaterThan(embedIdx);
  });

  it('keeps the existing X, LinkedIn, Bluesky, Copy, Close actions intact', () => {
    const actionsRow = html.match(/id="share-actions"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(actionsRow).toMatch(/id="share-x"/);
    expect(actionsRow).toMatch(/id="share-linkedin"/);
    expect(actionsRow).toMatch(/id="share-bluesky"/);
    expect(actionsRow).toMatch(/id="share-copy"/);
    expect(actionsRow).toMatch(/id="share-close"/);
  });

  it('imports buildBadgeUrl from @a14y/core and sets the href when the popover opens', () => {
    expect(ts).toMatch(/import\s*\{[\s\S]*?buildBadgeUrl[\s\S]*?\}\s*from\s*['"]@a14y\/core['"]/);
    expect(ts).toMatch(/shareEmbedLink\.href\s*=\s*buildBadgeUrl\(run\)/);
  });
});
