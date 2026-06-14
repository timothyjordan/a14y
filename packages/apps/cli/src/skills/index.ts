import os from 'node:os';
import path from 'node:path';
import {
  AGENT_REGISTRY,
  DEFAULT_AGENT,
  INSTALLABLE_AGENTS,
  type AgentEntry,
} from './registry';
import {
  resolveTargets,
  SkillsConfigError,
  type Scope,
  type SkillTarget,
} from './paths';
import { fetchSkill, skillSourceUrl, SkillFetchError } from './fetch';
import { nodeFs, type FsFacade } from './fsFacade';
import { parseSkillVersion } from './frontmatter';
import { planTarget, type SkillAction, type TargetPlan } from './plan';

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;
type TrackFn = (event: string, props?: Record<string, unknown>) => void;

export interface RunSkillsOptions {
  /** Optional `[action]` positional; only `update` (or empty) is accepted. */
  action?: string;
  local?: boolean;
  project?: boolean;
  global?: boolean;
  target?: string;
  agent?: string[];
  check?: boolean;
  dryRun?: boolean;
  force?: boolean;
  output?: 'text' | 'json';
}

export interface RunSkillsDeps {
  runId?: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  // I/O seams — all default to the real implementations so tests inject fakes.
  fetchImpl?: FetchImpl;
  fs?: FsFacade;
  homeDir?: string;
  cwd?: string;
  track?: TrackFn;
}

type Outcome =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'skipped'
  | 'error'
  | 'would-create'
  | 'would-update'
  | 'would-skip';

interface TargetResult {
  agent: string;
  label: string;
  path: string;
  action: SkillAction;
  outcome: Outcome;
  oldVersion: string | null;
  newVersion: string | null;
  isSymlink: boolean;
  reason?: string;
}

/**
 * Install or update the a14y agent skill. Idempotent: re-running is a no-op when
 * nothing changed. Returns the process exit code (0 success; 1 on fetch/write
 * failure, a skipped conflict, or `--check` drift; 2 on bad arguments).
 */
export async function runSkillsCommand(
  opts: RunSkillsOptions,
  deps: RunSkillsDeps,
): Promise<number> {
  const fs = deps.fs ?? nodeFs;
  const track: TrackFn = deps.track ?? (() => {});
  const homeDir = deps.homeDir ?? os.homedir();
  const cwd = deps.cwd ?? process.cwd();
  const output = opts.output ?? 'text';
  const dryRun = Boolean(opts.check || opts.dryRun);
  const force = Boolean(opts.force);

  if (opts.action && opts.action !== 'update') {
    deps.stderr(`Unknown skills action "${opts.action}". Usage: a14y skills [update]`);
    return 2;
  }

  const wantsLocal = Boolean(opts.local || opts.project);
  const wantsGlobal = Boolean(opts.global);
  if (wantsLocal && wantsGlobal) {
    deps.stderr('Pass only one of --global or --local.');
    return 2;
  }
  const scope: Scope = wantsLocal ? 'local' : 'global';

  // Resolve which agents to install for.
  const explicitTarget = opts.target;
  let agents: AgentEntry[] = [];
  let usedDefaultAgent = false;
  if (!explicitTarget) {
    const requested = opts.agent ?? [];
    if (requested.length > 0) {
      const byName = new Map(AGENT_REGISTRY.map((a) => [a.name, a]));
      for (const name of requested) {
        const entry = byName.get(name);
        if (!entry) {
          deps.stderr(
            `Unknown agent "${name}". Known agents: ${AGENT_REGISTRY.map((a) => a.name).join(', ')}.`,
          );
          return 2;
        }
        if (!entry.installable) {
          deps.stderr(
            `Agent "${entry.label}" uses a different skill format (${entry.skillsDir}); ` +
              `SKILL.md can't be installed there by copying. Use \`npx skills add timothyjordan/a14y\` for that agent.`,
          );
          return 2;
        }
        if (!agents.includes(entry)) agents.push(entry);
      }
    } else {
      // Auto-detect: install for every installable agent already configured
      // under the chosen scope; fall back to Claude Code in a fresh project.
      const base = scope === 'global' ? homeDir : cwd;
      for (const a of INSTALLABLE_AGENTS) {
        if (await fs.dirExists(path.join(base, a.rootDir))) agents.push(a);
      }
      if (agents.length === 0) {
        const fallback = INSTALLABLE_AGENTS.find((a) => a.name === DEFAULT_AGENT);
        if (fallback) agents.push(fallback);
        usedDefaultAgent = true;
      }
    }
  }

  track('cli_command_invoked', {
    command: 'skills',
    scope,
    dry_run: dryRun,
    force,
    agent_count: explicitTarget ? 1 : agents.length,
    target_override: Boolean(explicitTarget),
    output_format: output,
    run_id: deps.runId,
  });

  // Resolve concrete file paths.
  let targets: SkillTarget[];
  try {
    targets = resolveTargets({ scope, homeDir, cwd, agents, explicitTarget });
  } catch (e) {
    if (e instanceof SkillsConfigError) {
      deps.stderr(e.message);
      track('cli_error', {
        command: 'skills',
        phase: 'normalize',
        error_class: 'SkillsConfigError',
        run_id: deps.runId,
      });
      return 2;
    }
    throw e;
  }

  // Download the skill.
  const source = skillSourceUrl();
  let fetched: string;
  try {
    fetched = await fetchSkill({ fetchImpl: deps.fetchImpl });
  } catch (e) {
    deps.stderr((e as Error).message);
    track('cli_error', {
      command: 'skills',
      phase: 'fetch',
      error_class: e instanceof SkillFetchError ? 'SkillFetchError' : (e as Error).name,
      run_id: deps.runId,
    });
    return 1;
  }
  const newVersion = parseSkillVersion(fetched);

  // Plan each target (read current content + symlink status).
  const plans: TargetPlan[] = [];
  for (const target of targets) {
    const skillDir = path.dirname(target.filePath);
    const [fileStat, dirStat, current] = await Promise.all([
      fs.lstat(target.filePath),
      fs.lstat(skillDir),
      fs.readFile(target.filePath),
    ]);
    const isSymlink = Boolean(fileStat?.isSymbolicLink || dirStat?.isSymbolicLink);
    plans.push(planTarget({ target, fetched, current, isSymlink, force }));
  }

  // Dry run: report, write nothing.
  if (dryRun) {
    const results: TargetResult[] = plans.map((p) => ({
      ...toBaseResult(p),
      outcome:
        p.action === 'create'
          ? 'would-create'
          : p.action === 'update'
            ? 'would-update'
            : p.action === 'conflict'
              ? 'would-skip'
              : 'unchanged',
    }));
    const drift = plans.some((p) => p.action !== 'unchanged');
    report({ deps, output, source, scope, dryRun, newVersion, results, usedDefaultAgent });
    return drift ? 1 : 0;
  }

  // Apply.
  const results: TargetResult[] = [];
  for (const p of plans) {
    const base = toBaseResult(p);
    if (p.action === 'unchanged') {
      results.push({ ...base, outcome: 'unchanged' });
      continue;
    }
    if (p.action === 'conflict') {
      results.push({ ...base, outcome: 'skipped', reason: p.conflictReason });
      continue;
    }
    try {
      await fs.mkdirp(path.dirname(p.target.filePath));
      await fs.writeFile(p.target.filePath, fetched);
      results.push({ ...base, outcome: p.action === 'create' ? 'created' : 'updated' });
    } catch (e) {
      results.push({ ...base, outcome: 'error', reason: (e as Error).message });
    }
  }

  const counts = tally(results);
  track('cli_skills_applied', {
    created: counts.created,
    updated: counts.updated,
    unchanged: counts.unchanged,
    conflicts: counts.skipped,
    errors: counts.error,
    old_version: results.find((r) => r.outcome === 'updated')?.oldVersion ?? null,
    new_version: newVersion,
    run_id: deps.runId,
  });

  report({ deps, output, source, scope, dryRun, newVersion, results, usedDefaultAgent });
  return counts.error > 0 || counts.skipped > 0 ? 1 : 0;
}

function toBaseResult(p: TargetPlan): Omit<TargetResult, 'outcome'> {
  return {
    agent: p.target.agent,
    label: p.target.label,
    path: p.target.filePath,
    action: p.action,
    oldVersion: p.oldVersion,
    newVersion: p.newVersion,
    isSymlink: p.isSymlink,
    reason: p.conflictReason,
  };
}

function tally(results: TargetResult[]) {
  const counts = { created: 0, updated: 0, unchanged: 0, skipped: 0, error: 0 };
  for (const r of results) {
    if (r.outcome === 'created' || r.outcome === 'would-create') counts.created++;
    else if (r.outcome === 'updated' || r.outcome === 'would-update') counts.updated++;
    else if (r.outcome === 'unchanged') counts.unchanged++;
    else if (r.outcome === 'skipped' || r.outcome === 'would-skip') counts.skipped++;
    else if (r.outcome === 'error') counts.error++;
  }
  return counts;
}

interface ReportArgs {
  deps: RunSkillsDeps;
  output: 'text' | 'json';
  source: string;
  scope: Scope;
  dryRun: boolean;
  newVersion: string | null;
  results: TargetResult[];
  usedDefaultAgent: boolean;
}

function report(args: ReportArgs): void {
  const { deps, output, results } = args;
  if (output === 'json') {
    const counts = tally(results);
    deps.stdout(
      JSON.stringify(
        {
          source: args.source,
          scope: args.scope,
          dryRun: args.dryRun,
          version: args.newVersion,
          targets: results.map((r) => ({
            agent: r.agent,
            label: r.label,
            path: r.path,
            action: r.action,
            outcome: r.outcome,
            oldVersion: r.oldVersion,
            newVersion: r.newVersion,
            isSymlink: r.isSymlink,
            ...(r.reason ? { reason: r.reason } : {}),
          })),
          summary: counts,
        },
        null,
        2,
      ),
    );
    return;
  }

  // Text output.
  deps.stdout(`a14y skill ${args.dryRun ? 'check' : 'install'} — source ${args.source}`);
  if (args.usedDefaultAgent) {
    deps.stdout(
      'No agent directory detected; defaulting to Claude Code (.claude/skills). ' +
        'Use --agent or --target to choose another.',
    );
  }
  for (const r of results) {
    deps.stdout('  ' + formatLine(r));
  }
  const c = tally(results);
  const summary = [
    c.created ? `${c.created} ${args.dryRun ? 'to create' : 'created'}` : null,
    c.updated ? `${c.updated} ${args.dryRun ? 'to update' : 'updated'}` : null,
    c.unchanged ? `${c.unchanged} unchanged` : null,
    c.skipped ? `${c.skipped} skipped` : null,
    c.error ? `${c.error} failed` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const drift = c.created > 0 || c.updated > 0 || c.skipped > 0;
  if (args.dryRun) {
    deps.stdout(drift ? `Would change: ${summary}` : `Up to date — ${summary || 'nothing to do'}`);
    if (drift) deps.stdout('Run `a14y skills` without --check to apply.');
  } else {
    deps.stdout(`Done — ${summary || 'nothing to do'}`);
  }
}

function formatLine(r: TargetResult): string {
  const ver =
    r.outcome === 'updated' || r.outcome === 'would-update'
      ? `(${r.oldVersion ?? '?'} → ${r.newVersion ?? '?'})`
      : r.newVersion
        ? `(${r.newVersion})`
        : '';
  const label: Record<Outcome, string> = {
    created: 'Created  ',
    updated: 'Updated  ',
    unchanged: 'Unchanged',
    skipped: 'Skipped  ',
    error: 'Failed   ',
    'would-create': 'Create   ',
    'would-update': 'Update   ',
    'would-skip': 'Skip     ',
  };
  const tail = r.reason ? `  — ${r.reason}` : '';
  return `${label[r.outcome]} ${r.path} ${ver}${tail}`.replace(/\s+$/, '');
}
