import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../src/lib/scan/run-scan';

describe('scan export surface', () => {
  it('still exports normalizeUrl (unchanged contract)', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
    expect(normalizeUrl('not a url')).toBeNull();
  });
  it('exports scanInto', async () => {
    const mod = await import('../src/lib/scan/run-scan');
    expect(typeof (mod as any).scanInto).toBe('function');
  });
});
