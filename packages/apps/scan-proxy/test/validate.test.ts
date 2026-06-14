import { describe, it, expect } from 'vitest';
import { validateTargetUrl } from '../src/validate';

describe('validateTargetUrl', () => {
  it('accepts a normal https url', () => {
    const r = validateTargetUrl('https://example.com/robots.txt');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.href).toBe('https://example.com/robots.txt');
  });

  it('accepts http on the default port', () => {
    expect(validateTargetUrl('http://example.com/').ok).toBe(true);
  });

  it('rejects a missing url', () => {
    expect(validateTargetUrl(null).ok).toBe(false);
    expect(validateTargetUrl('').ok).toBe(false);
  });

  it('rejects an unparseable url', () => {
    expect(validateTargetUrl('not a url').ok).toBe(false);
  });

  it('rejects non-http(s) protocols', () => {
    for (const u of ['ftp://example.com/', 'file:///etc/passwd', 'gopher://x/']) {
      expect(validateTargetUrl(u).ok).toBe(false);
    }
  });

  it('rejects non-default ports (port-scan guard)', () => {
    expect(validateTargetUrl('http://example.com:8080/').ok).toBe(false);
    expect(validateTargetUrl('https://example.com:22/').ok).toBe(false);
    // explicit default ports are fine
    expect(validateTargetUrl('http://example.com:80/').ok).toBe(true);
    expect(validateTargetUrl('https://example.com:443/').ok).toBe(true);
  });

  it('rejects localhost and loopback (SSRF guard)', () => {
    for (const u of [
      'http://localhost/',
      'http://127.0.0.1/',
      'http://127.5.5.5/',
      'http://[::1]/',
      'http://0.0.0.0/',
    ]) {
      expect(validateTargetUrl(u).ok).toBe(false);
    }
  });

  it('rejects private and link-local ranges (SSRF guard)', () => {
    for (const u of [
      'http://10.0.0.1/',
      'http://192.168.1.1/',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
      'http://169.254.169.254/', // cloud metadata
      'http://[fc00::1]/',
      'http://[fe80::1]/',
    ]) {
      expect(validateTargetUrl(u).ok).toBe(false);
    }
  });

  it('allows public 172 addresses outside the private block', () => {
    expect(validateTargetUrl('http://172.32.0.1/').ok).toBe(true);
  });

  it('rejects internal-only hostnames', () => {
    for (const u of [
      'http://printer.local/',
      'http://metadata.google.internal/',
      'http://service.internal/',
    ]) {
      expect(validateTargetUrl(u).ok).toBe(false);
    }
  });
});
