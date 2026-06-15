// Network edge for the installer: download the SKILL.md body from GitHub `main`.
// Dependency-injected `fetchImpl` + an AbortController timeout, mirroring
// `normalizeUrl.ts`, so the orchestrator can be unit-tested without real I/O.

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export const DEFAULT_SKILL_SOURCE_URL =
  'https://raw.githubusercontent.com/timothyjordan/a14y/main/skills/a14y/SKILL.md';

/**
 * Source URL, overridable with `A14Y_SKILL_SOURCE_URL`. The override makes the
 * binary integration-testable (point it at a local server) and lets advanced
 * users install from a fork or branch.
 */
export function skillSourceUrl(): string {
  const override = process.env.A14Y_SKILL_SOURCE_URL;
  return override && override.trim() ? override.trim() : DEFAULT_SKILL_SOURCE_URL;
}

export class SkillFetchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SkillFetchError';
  }
}

export interface FetchSkillOptions {
  fetchImpl?: FetchImpl;
  /** Override the source URL (defaults to {@link skillSourceUrl}). */
  url?: string;
  /** Request timeout. Default 10s. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Download the raw SKILL.md body. Throws {@link SkillFetchError} on a non-2xx
 * response (including 404), a network/DNS failure, a timeout, or an empty body.
 */
export async function fetchSkill(opts: FetchSkillOptions = {}): Promise<string> {
  const url = opts.url ?? skillSourceUrl();
  const fetchImpl: FetchImpl | undefined =
    opts.fetchImpl ?? (globalThis as { fetch?: FetchImpl }).fetch;
  if (!fetchImpl) {
    throw new SkillFetchError(
      'No fetch implementation available. Run on Node 18+ or pass `fetchImpl`.',
    );
  }
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetchImpl(url, { redirect: 'follow', signal: ac.signal });
  } catch (e) {
    throw new SkillFetchError(
      `Could not reach ${url} to download the a14y skill. Check your network connection.`,
      e,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    throw new SkillFetchError(
      `Could not download the a14y skill (HTTP ${resp.status} from ${url}).`,
    );
  }

  const body = await resp.text();
  if (!body.trim()) {
    throw new SkillFetchError(`The skill downloaded from ${url} was empty.`);
  }
  return body;
}
