import type { FetchedPage, HttpClient } from '../fetch/types';
import type {
  PageCheckContext,
  ResolvedCheck,
  ResolvedScorecard,
} from '../scorecard/types';
import type { CheckResult } from '../score/compute';

export interface RunPageOptions {
  scorecard: ResolvedScorecard;
  http: HttpClient;
  baseUrl: string;
  /** Shared map. Page contexts within a single run share one map so the
   * page-level checks see whatever the site checks and crawler put there
   * (e.g. the discovery.indexed URL set). */
  shared: Map<string, unknown>;
  page: FetchedPage;
}

export interface PageRunResult {
  url: string;
  finalUrl: string;
  status: number;
  checks: CheckResult[];
}

/**
 * Execute every page-level check from the resolved scorecard against a
 * single fetched page. Checks run in parallel because each one is a pure
 * function of the page + shared map; their only side effects are reads.
 */
export async function runPage(opts: RunPageOptions): Promise<PageRunResult> {
  const ctx: PageCheckContext = {
    scope: 'page',
    baseUrl: opts.baseUrl,
    http: opts.http,
    shared: opts.shared,
    url: opts.page.url,
    page: opts.page,
  };

  const checkPromises = opts.scorecard.pageChecks.map((c) => runOne(c, ctx));
  const checks = await Promise.all(checkPromises);

  return {
    url: opts.page.originalUrl,
    finalUrl: opts.page.url,
    status: opts.page.status,
    checks,
  };
}

async function runOne(check: ResolvedCheck, ctx: PageCheckContext): Promise<CheckResult> {
  try {
    const outcome = await check.run(ctx);
    return {
      id: check.id,
      name: check.name,
      group: check.group,
      scope: 'page',
      implementationVersion: check.implementationVersion,
      status: outcome.status,
      message: outcome.message,
      details: outcome.details,
    };
  } catch (e) {
    return {
      id: check.id,
      name: check.name,
      group: check.group,
      scope: 'page',
      implementationVersion: check.implementationVersion,
      status: 'error',
      message: (e as Error).message,
    };
  }
}
