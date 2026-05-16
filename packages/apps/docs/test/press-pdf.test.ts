import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const pdfPath = path.resolve(
  __dirname,
  '../public/press/a14y-competitive-overview-v2026-05.pdf',
);

describe('competitive-overview PDF (TJ-472)', () => {
  it('exists on disk', () => {
    expect(() => statSync(pdfPath)).not.toThrow();
  });

  it('is a valid PDF (magic bytes %PDF-)', () => {
    const head = readFileSync(pdfPath).subarray(0, 5).toString('latin1');
    expect(head).toBe('%PDF-');
  });

  it('is exactly 2 pages', () => {
    const text = readFileSync(pdfPath).toString('latin1');
    const pageMatches = text.match(/\/Type\s*\/Page(?!s)/g) ?? [];
    expect(pageMatches).toHaveLength(2);
  });

  it('is between 30 KB and 500 KB (regression check on size)', () => {
    const size = statSync(pdfPath).size;
    expect(size).toBeGreaterThan(30_000);
    expect(size).toBeLessThan(500_000);
  });
});
