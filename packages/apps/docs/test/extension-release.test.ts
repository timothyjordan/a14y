import { describe, it, expect, vi } from 'vitest';
import {
  getLatestExtensionRelease,
  formatBytes,
} from '~/lib/extension-release';

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as unknown as Response);
}

describe('getLatestExtensionRelease', () => {
  it('returns the newest extension release, ignoring other tag prefixes', async () => {
    const fixture = [
      // Newer non-extension release should not win.
      {
        tag_name: 'a14y-v0.4.2',
        published_at: '2026-05-01T00:00:00Z',
        draft: false,
        prerelease: false,
        html_url: 'https://github.com/timothyjordan/a14y/releases/tag/a14y-v0.4.2',
        assets: [],
      },
      {
        tag_name: 'extension-v0.5.0',
        published_at: '2026-03-01T00:00:00Z',
        draft: false,
        prerelease: false,
        html_url:
          'https://github.com/timothyjordan/a14y/releases/tag/extension-v0.5.0',
        assets: [
          {
            name: 'a14y-extension-0.5.0.zip',
            size: 200_000,
            browser_download_url:
              'https://github.com/timothyjordan/a14y/releases/download/extension-v0.5.0/a14y-extension-0.5.0.zip',
          },
        ],
      },
      {
        tag_name: 'extension-v0.5.1',
        published_at: '2026-04-01T00:00:00Z',
        draft: false,
        prerelease: false,
        html_url:
          'https://github.com/timothyjordan/a14y/releases/tag/extension-v0.5.1',
        assets: [
          {
            name: 'a14y-extension-0.5.1.zip',
            size: 215_000,
            browser_download_url:
              'https://github.com/timothyjordan/a14y/releases/download/extension-v0.5.1/a14y-extension-0.5.1.zip',
          },
        ],
      },
    ];
    const release = await getLatestExtensionRelease(mockFetch(fixture) as unknown as typeof fetch);
    expect(release).not.toBeNull();
    expect(release!.version).toBe('0.5.1');
    expect(release!.tag).toBe('extension-v0.5.1');
    expect(release!.zipAsset?.url).toContain('a14y-extension-0.5.1.zip');
    expect(release!.zipAsset?.size).toBe(215_000);
  });

  it('returns null when fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const release = await getLatestExtensionRelease(fetchImpl as unknown as typeof fetch);
    expect(release).toBeNull();
  });

  it('returns null on a non-2xx response', async () => {
    const release = await getLatestExtensionRelease(
      mockFetch(null, false, 503) as unknown as typeof fetch,
    );
    expect(release).toBeNull();
  });

  it('returns null when no extension release exists yet', async () => {
    const fixture = [
      {
        tag_name: 'core-v0.3.1',
        published_at: '2026-04-01T00:00:00Z',
        draft: false,
        prerelease: false,
        html_url: 'x',
        assets: [],
      },
    ];
    const release = await getLatestExtensionRelease(mockFetch(fixture) as unknown as typeof fetch);
    expect(release).toBeNull();
  });

  it('skips drafts and prereleases', async () => {
    const fixture = [
      {
        tag_name: 'extension-v0.6.0',
        published_at: '2026-05-01T00:00:00Z',
        draft: true,
        prerelease: false,
        html_url: 'x',
        assets: [],
      },
      {
        tag_name: 'extension-v0.5.9',
        published_at: '2026-04-15T00:00:00Z',
        draft: false,
        prerelease: true,
        html_url: 'x',
        assets: [],
      },
      {
        tag_name: 'extension-v0.5.1',
        published_at: '2026-04-01T00:00:00Z',
        draft: false,
        prerelease: false,
        html_url:
          'https://github.com/timothyjordan/a14y/releases/tag/extension-v0.5.1',
        assets: [
          {
            name: 'a14y-extension-0.5.1.zip',
            size: 1,
            browser_download_url: 'u',
          },
        ],
      },
    ];
    const release = await getLatestExtensionRelease(mockFetch(fixture) as unknown as typeof fetch);
    expect(release!.version).toBe('0.5.1');
  });

  it('returns release metadata even when the .zip asset is missing', async () => {
    // A release exists but its asset upload failed for some reason.
    // Still surface tag/version/htmlUrl so the page can link to the
    // release page; just don't render a download CTA.
    const fixture = [
      {
        tag_name: 'extension-v0.5.0',
        published_at: '2026-03-01T00:00:00Z',
        draft: false,
        prerelease: false,
        html_url:
          'https://github.com/timothyjordan/a14y/releases/tag/extension-v0.5.0',
        assets: [],
      },
    ];
    const release = await getLatestExtensionRelease(mockFetch(fixture) as unknown as typeof fetch);
    expect(release).not.toBeNull();
    expect(release!.zipAsset).toBeNull();
    expect(release!.htmlUrl).toContain('extension-v0.5.0');
  });
});

describe('formatBytes', () => {
  it('formats sub-KB values in bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(900)).toBe('900 B');
  });
  it('rounds KB to whole numbers', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1024 * 200)).toBe('200 KB');
  });
  it('formats MB with two decimals', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');
    expect(formatBytes(1024 * 1024 * 1.234)).toBe('1.23 MB');
  });
});
