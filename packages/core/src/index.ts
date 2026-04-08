// Public API for @agentready/core. Both the CLI and the Chrome extension
// import everything they need from here.

export {
  validate,
  type RunOptions,
  type RunMode,
  type ProgressEvent,
  type SiteRun,
  type PageReport,
} from './runner/runSite';

export { runPage, type RunPageOptions, type PageRunResult } from './runner/runPage';

export {
  getScorecard,
  listScorecards,
  LATEST_SCORECARD,
  SCORECARDS,
} from './scorecard';
export { buildCheckDocsUrl, DOCS_BASE_URL } from './scorecard/docsUrl';
export type {
  ScorecardManifest,
  ResolvedScorecard,
  ResolvedCheck,
  CheckSpec,
  CheckImpl,
  CheckContext,
  SiteCheckContext,
  PageCheckContext,
  CheckOutcome,
  CheckStatus,
  CheckScope,
} from './scorecard/types';

export { createHttpClient, type CreateHttpClientOptions } from './fetch/httpClient';
export type {
  FetchedPage,
  HttpClient,
  HttpFetchOptions,
  HttpResponse,
} from './fetch/types';

export {
  crawlSite,
  crawlSiteToArray,
  type DiscoveredPage,
  type DiscoverySource,
  type CrawlOptions,
  type CrawlProgressEvent,
} from './crawler';

export { summarize, type CheckResult, type ScoreSummary } from './score/compute';

export { runToAgentPrompt, type AgentPromptOptions } from './report/agentPrompt';

export { DISCOVERY_INDEXED_KEY } from './checks/page/discovery';
