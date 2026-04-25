type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export interface NormalizeOptions {
  /** Override the underlying fetch. Defaults to `globalThis.fetch`. */
  fetchImpl?: FetchImpl;
  /** Probe timeout per scheme attempt. Default 10s. */
  timeoutMs?: number;
}

export interface NormalizeResult {
  /** Final URL string with explicit http(s) scheme. */
  url: string;
  /** True when a scheme had to be added (caller may want to echo a notice). */
  rewrote: boolean;
}

export class UnreachableUrlError extends Error {
  constructor(public readonly input: string) {
    super(
      `Could not reach ${input} over https or http. Check the hostname and your network.`,
    );
    this.name = 'UnreachableUrlError';
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Resolve a user-supplied URL to one with an explicit http(s) scheme.
 *
 * Behaviour:
 *  1. If the input already parses as an http(s) URL, return it unchanged.
 *  2. Otherwise probe `https://<input>`. Any HTTP response (incl. 4xx/5xx)
 *     counts as "reachable" — only connection errors fall through.
 *  3. If https fails, probe `http://<input>`.
 *  4. If both fail, throw `UnreachableUrlError`.
 */
export async function normalizeUrl(
  input: string,
  opts: NormalizeOptions = {},
): Promise<NormalizeResult> {
  const trimmed = input.trim();
  const direct = parseHttpUrl(trimmed);
  if (direct) {
    return { url: direct.toString(), rewrote: false };
  }

  const fetchImpl: FetchImpl | undefined =
    opts.fetchImpl ?? (globalThis as { fetch?: FetchImpl }).fetch;
  if (!fetchImpl) {
    throw new Error(
      'No fetch implementation available for URL normalization. Run on Node 18+ or pass `fetchImpl`.',
    );
  }
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (const scheme of ['https', 'http'] as const) {
    const candidate = parseHttpUrl(`${scheme}://${trimmed}`);
    if (!candidate) {
      // The input is malformed even with a prefix — no point trying harder.
      throw new UnreachableUrlError(input);
    }
    if (await probe(candidate.toString(), fetchImpl, timeoutMs)) {
      return { url: candidate.toString(), rewrote: true };
    }
  }

  throw new UnreachableUrlError(input);
}

function parseHttpUrl(input: string): URL | null {
  try {
    const u = new URL(input);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u;
    return null;
  } catch {
    return null;
  }
}

async function probe(
  url: string,
  fetchImpl: FetchImpl,
  timeoutMs: number,
): Promise<boolean> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: ac.signal,
    });
    // Any HTTP status — even 4xx/5xx — proves the host is reachable. Some
    // servers reject HEAD; if we got a Response back at all, reachability
    // is confirmed.
    void resp;
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
