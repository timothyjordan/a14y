// Per-feature enable layer for the a14y-internal benchmark study
// (TJ-647 / TJ-650). NOT a14y-the-project source — this file is added
// to the LOCAL working tree of a14y2 for the duration of the
// per-feature ablation study. It is NOT to be committed, branched, or
// PR'd upstream. When the study is done, either revert the working
// tree or, if the mechanism turns out to be reusable, open a separate
// authorized upstream PR (a different decision).
//
// What this does: decomposes the existing `A14Y_BASELINE=1` boolean
// into per-feature toggles driven by `A14Y_FEATURES=<comma-list>`. The
// per-feature ablation study (https://linear.app/timothyjordan/issue/TJ-647)
// uses this to build many variants of the docs site with individual
// agent-readability features turned on or off, then benchmarks each
// to quantify the feature's contribution to agent navigation efficiency.
//
// Precedence (highest to lowest):
//   A14Y_BASELINE=1            → empty set (all features off; baseline)
//   A14Y_FEATURES=<csv>        → exactly those features on
//   neither set                → all features on (production behavior)

export const FEATURE_NAMES = [
  'llms-txt',
  'robots-txt',
  'sitemap-xml',
  'sitemap-md',
  'agents-md',
  'agent-skills',
  'md-mirrors',
  'canonical-link',
  'meta-description',
  'og-tags',
  'json-ld',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

const ALL_FEATURES: ReadonlySet<FeatureName> = new Set(FEATURE_NAMES);

function computeEnabledFeatures(): Set<FeatureName> {
  if (process.env.A14Y_BASELINE === '1') return new Set();
  const csv = process.env.A14Y_FEATURES;
  if (csv && csv.trim().length > 0) {
    const wanted = csv.split(',').map((s) => s.trim()).filter(Boolean);
    const valid = new Set<FeatureName>();
    for (const name of wanted) {
      if (ALL_FEATURES.has(name as FeatureName)) {
        valid.add(name as FeatureName);
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[features] Unknown A14Y_FEATURES entry "${name}" ignored. Known: ${FEATURE_NAMES.join(', ')}`,
        );
      }
    }
    return valid;
  }
  return new Set(FEATURE_NAMES);
}

export const enabledFeatures: Set<FeatureName> = computeEnabledFeatures();

export function isFeatureEnabled(name: FeatureName): boolean {
  return enabledFeatures.has(name);
}

/** True when ANY discovery-file feature is on (drives whether the
 *  discoveryFilesIntegration is wired up at all). */
export function anyDiscoveryFeatureEnabled(): boolean {
  return (
    isFeatureEnabled('llms-txt') ||
    isFeatureEnabled('robots-txt') ||
    isFeatureEnabled('sitemap-xml') ||
    isFeatureEnabled('sitemap-md') ||
    isFeatureEnabled('agents-md') ||
    isFeatureEnabled('agent-skills')
  );
}

/** Variant slug used for the absolute-URL host suffix and as the
 *  default outDir name. Set explicitly via A14Y_VARIANT_SLUG; otherwise
 *  defaults to `baseline` (all off), `all` (all on), or a generic
 *  `variant-<count>` for mixed states. */
export const variantSlug: string =
  process.env.A14Y_VARIANT_SLUG ??
  (enabledFeatures.size === 0
    ? 'baseline'
    : enabledFeatures.size === FEATURE_NAMES.length
      ? 'all'
      : `variant-${enabledFeatures.size}`);
