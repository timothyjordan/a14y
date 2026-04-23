import type { CheckSpec, PageCheckSpec, SiteCheckSpec } from './types';

/**
 * Master registry of every check that has ever existed in any scorecard,
 * keyed by stable check id. Each entry holds all known implementation
 * versions of that check.
 *
 * To add a new check: create the file in `checks/site/` or `checks/page/`,
 * import its `CheckSpec` here, and add an entry to `CHECK_REGISTRY`. The
 * stable id used here MUST match what the scorecard manifests reference.
 *
 * To update a check: add a new entry to its `implementations` map (e.g.
 * '1.1.0') in the check's own file. The old implementation stays in place
 * forever so frozen scorecards remain reproducible.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _registry: Record<string, CheckSpec<any>> = {};

export function registerCheck(spec: SiteCheckSpec | PageCheckSpec): void {
  if (_registry[spec.id] && _registry[spec.id] !== spec) {
    throw new Error(`Duplicate check registration for id "${spec.id}"`);
  }
  // Variance: a SiteCheckSpec/PageCheckSpec is stored under a loose type so
  // the resolver in scorecard/index.ts can iterate uniformly. The runner
  // narrows by `scope` before invoking `run`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _registry[spec.id] = spec as CheckSpec<any>;
}

export function getCheck(id: string): CheckSpec | undefined {
  return _registry[id];
}

export function listCheckIds(): string[] {
  return Object.keys(_registry);
}

/** For tests only. */
export function _resetRegistry(): void {
  for (const k of Object.keys(_registry)) delete _registry[k];
}
