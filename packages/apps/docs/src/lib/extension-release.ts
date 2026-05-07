// Build-time helper that resolves the latest Chrome-extension release
// from GitHub. The /chrome-extension/ page renders its download CTA
// from this metadata, so docs need to be re-deployed after every
// extension release for the link to update — that's wired up via
// deploy-docs.yml's `workflow_run` trigger on the Release workflow.
//
// We deliberately avoid reading packages/apps/extension/package.json
// directly: between the release-please PR landing and the publish
// workflow finishing, package.json is one version ahead of what's
// actually downloadable, and we'd link to a 404. Querying the
// Releases API as the source of truth means the page only ever
// advertises an asset that genuinely exists.

const REPO = 'timothyjordan/a14y';
const TAG_PREFIX = 'extension-v';

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string | null;
  created_at: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

export interface ExtensionAsset {
  name: string;
  size: number;
  url: string;
}

export interface ExtensionRelease {
  tag: string;
  version: string;
  publishedAt: string;
  htmlUrl: string;
  zipAsset: ExtensionAsset | null;
}

export async function getLatestExtensionRelease(
  fetchImpl: typeof fetch = fetch,
): Promise<ExtensionRelease | null> {
  const url = `https://api.github.com/repos/${REPO}/releases?per_page=30`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  // Unauthenticated requests are limited to 60/hour per IP, which is
  // enough for the per-deploy build but not for a tight CI loop.
  // Actions provides GITHUB_TOKEN for free and lifts the cap to
  // 1000/hour; honor it whenever it's set.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let response: Response;
  try {
    response = await fetchImpl(url, { headers });
  } catch (err) {
    console.warn(
      `[extension-release] fetch failed: ${(err as Error).message}`,
    );
    return null;
  }
  if (!response.ok) {
    console.warn(
      `[extension-release] GitHub responded ${response.status}; rendering fallback`,
    );
    return null;
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    console.warn(
      `[extension-release] invalid JSON: ${(err as Error).message}`,
    );
    return null;
  }
  if (!Array.isArray(data)) return null;

  const releases = (data as GitHubRelease[])
    .filter((r) => typeof r?.tag_name === 'string' && r.tag_name.startsWith(TAG_PREFIX))
    .filter((r) => !r.draft && !r.prerelease)
    .sort((a, b) => timestamp(b) - timestamp(a));

  const latest = releases[0];
  if (!latest) return null;

  const zip = (latest.assets ?? []).find(
    (a) => typeof a?.name === 'string' && a.name.endsWith('.zip'),
  );

  return {
    tag: latest.tag_name,
    version: latest.tag_name.slice(TAG_PREFIX.length),
    publishedAt: latest.published_at ?? latest.created_at ?? '',
    htmlUrl: latest.html_url ?? `https://github.com/${REPO}/releases/tag/${latest.tag_name}`,
    zipAsset: zip
      ? { name: zip.name, size: zip.size, url: zip.browser_download_url }
      : null,
  };
}

function timestamp(release: GitHubRelease): number {
  const t = release.published_at ?? release.created_at ?? '';
  const n = Date.parse(t);
  return Number.isFinite(n) ? n : 0;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
