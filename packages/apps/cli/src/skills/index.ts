import os from 'node:os';
import path from 'node:path';
import { agentByName, DEFAULT_AGENT, type PathCtx } from './registry';
import { SkillsConfigError, type Scope, type SkillTarget } from './paths';
import { agentTargets, buildTargets, detectAgents, explicitTarget } from './detect';
import { fetchSkill, skillSourceUrl, SkillFetchError } from './fetch';
import { nodeFs, type FsFacade } from './fsFacade';
import { parseSkillVersion } from './frontmatter';
import { planTarget, type SkillAction, type TargetPlan } from './plan';
import { promptSelectTargets, type PromptSelect, type SelectChoice } from './prompt';

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
  /** Skip the interactive checklist and install to all detected agents. */
  yes?: boolean;
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
  env?: Record<string, string | undefined>;
  track?: TrackFn;
  isTTY?: boolean;
  promptSelect?: PromptSelect;
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

interface PlanEntry {
  target: SkillTarget;
  plan: TargetPlan;
}

interface TargetResult {
  agents: string[];
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
 * Install or update the a14y agent skill across the user's coding agents.
 * Auto-detects which agents are configured, shows a checklist, and only writes
 * what changed (idempotent — re-running, or running after a `npx skills add`
 * install, is a no-op when the on-disk skill already matches).
 */
export async function runSkillsCommand(
  opts: RunSkillsOptions,
  deps: RunSkillsDeps,
): Promise<number> {
  const fs = deps.fs ?? nodeFs;
  const track: TrackFn = deps.track ?? (() => {});
  const home = deps.homeDir ?? os.homedir();
  const cwd = deps.cwd ?? process.cwd();
  const env = deps.env ?? process.env;
  const ctx: PathCtx = { home, cwd, env };
  const output = opts.output ?? 'text';
  const dryRun = Boolean(opts.check || opts.dryRun);
  const force = Boolean(opts.force);
  const isTTY = deps.isTTY ?? Boolean(process.stdout.isTTY);
  const promptSelect = deps.promptSelect ?? promptSelectTargets;

  if (opts.action && opts.action !== 'update') {
    deps.stderr(`Unknown skills action "${opts.action}". Usage: a14y skills [update]`);
    return 2;
  }

  const wantsLocal = Boolean(opts.local || opts.project);
  if (wantsLocal && opts.global) {
    deps.stderr('Pass only one of --global or --local.');
    return 2;
  }
  const scope: Scope = wantsLocal ? 'local' : 'global';

  // Resolve targets: explicit dir, explicit agents, or auto-detection.
  let targets: SkillTarget[];
  let mode: 'detect' | 'agent' | 'target';
  let usedDefaultAgent = false;
  try {
    if (opts.target) {
      targets = [explicitTarget(opts.target, ctx)];
      mode = 'target';
    } else if ((opts.agent ?? []).length > 0) {
      targets = agentTargets(opts.agent!, scope, ctx);
      mode = 'agent';
    } else {
      const detected = await detectAgents(ctx, fs);
      if (detected.length > 0) {
        targets = buildTargets(detected, scope, ctx);
      } else {
        targets = buildTargets([agentByName(DEFAULT_AGENT)!], scope, ctx);
        usedDefaultAgent = true;
      }
      mode = 'detect';
    }
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

  const source = skillSourceUrl();
  track('cli_command_invoked', {
    command: 'skills',
    scope,
    mode,
    dry_run: dryRun,
    force,
    target_count: targets.length,
    output_format: output,
    run_id: deps.runId,
  });

  // Download the skill.
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

  // Plan each target (read current content + symlink status to detect drift).
  const entries: PlanEntry[] = [];
  for (const target of targets) {
    const skillDir = path.dirname(target.filePath);
    const [fileStat, dirStat, current] = await Promise.all([
      fs.lstat(target.filePath),
      fs.lstat(skillDir),
      fs.readFile(target.filePath),
    ]);
    const isSymlink = Boolean(fileStat?.isSymbolicLink || dirStat?.isSymbolicLink);
    entries.push({ target, plan: planTarget({ target, fetched, current, isSymlink, force }) });
  }

  // Dry run: report statuses, write nothing.
  if (dryRun) {
    const results = entries.map((e) =>
      toResult(
        e,
        e.plan.action === 'create'
          ? 'would-create'
          : e.plan.action === 'update'
            ? 'would-update'
            : e.plan.action === 'conflict'
              ? 'would-skip'
              : 'unchanged',
        e.plan.action === 'conflict' ? e.plan.conflictReason : undefined,
      ),
    );
    report({ deps, output, source, scope, dryRun, newVersion, results, usedDefaultAgent, home });
    return entries.some((e) => e.plan.action !== 'unchanged') ? 1 : 0;
  }

  // Decide which targets to write. In detected mode on a TTY we show a
  // checklist; otherwise (explicit --agent/--target, --yes, or non-TTY) we
  // auto-select everything that needs a create/update.
  const actionable = entries.filter((e) => e.plan.action !== 'unchanged');
  const interactive = mode === 'detect' && isTTY && !opts.yes && actionable.length > 0;
  let selected: Set<string>;
  if (interactive) {
    const choices: SelectChoice[] = entries.map((e) => {
      const s = statusOf(e.plan);
      return {
        value: e.target.filePath,
        title: `${e.target.label}  ${tildify(e.target.filePath, home)}`,
        hint: s.text,
        selected: s.preChecked,
      };
    });
    const chosen = await promptSelect('Install or update the a14y skill for:', choices);
    if (chosen === null) {
      deps.stdout('Cancelled — nothing was changed.');
      return 0;
    }
    selected = new Set(chosen);
  } else {
    selected = new Set(
      entries.filter((e) => statusOf(e.plan).preChecked).map((e) => e.target.filePath),
    );
  }

  // Apply.
  const results: TargetResult[] = [];
  for (const e of entries) {
    const a = e.plan.action;
    if (a === 'unchanged') {
      results.push(toResult(e, 'unchanged'));
      continue;
    }
    if (!selected.has(e.target.filePath)) {
      results.push(toResult(e, 'skipped', a === 'conflict' ? e.plan.conflictReason : 'deselected'));
      continue;
    }
    if (a === 'conflict') {
      results.push(toResult(e, 'skipped', e.plan.conflictReason));
      continue;
    }
    try {
      await fs.mkdirp(path.dirname(e.target.filePath));
      await fs.writeFile(e.target.filePath, fetched);
      results.push(toResult(e, a === 'create' ? 'created' : 'updated'));
    } catch (err) {
      results.push(toResult(e, 'error', (err as Error).message));
    }
  }

  const counts = tally(results);
  track('cli_skills_applied', {
    created: counts.created,
    updated: counts.updated,
    unchanged: counts.unchanged,
    skipped: counts.skipped,
    errors: counts.error,
    new_version: newVersion,
    run_id: deps.runId,
  });
  report({ deps, output, source, scope, dryRun, newVersion, results, usedDefaultAgent, home });

  // Non-interactive conflicts are unresolved problems the user should notice;
  // an interactively-deselected conflict is the user's own choice.
  const hadAutoConflict = !interactive && entries.some((e) => e.plan.action === 'conflict');
  return counts.error > 0 || hadAutoConflict ? 1 : 0;
}

function statusOf(p: TargetPlan): { text: string; preChecked: boolean } {
  switch (p.action) {
    case 'create':
      return { text: 'not installed', preChecked: true };
    case 'update':
      return {
        text:
          p.oldVersion && p.newVersion
            ? `outdated ${p.oldVersion} -> ${p.newVersion}`
            : 'installed, will update',
        preChecked: true,
      };
    case 'unchanged':
      return { text: 'up to date', preChecked: false };
    case 'conflict':
      return { text: p.conflictReason ?? 'conflict', preChecked: false };
  }
}

function toResult(e: PlanEntry, outcome: Outcome, reason?: string): TargetResult {
  return {
    agents: e.target.agents,
    label: e.target.label,
    path: e.target.filePath,
    action: e.plan.action,
    outcome,
    oldVersion: e.plan.oldVersion,
    newVersion: e.plan.newVersion,
    isSymlink: e.plan.isSymlink,
    reason,
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

function tildify(p: string, home: string): string {
  if (home && (p === home || p.startsWith(home + path.sep))) return '~' + p.slice(home.length);
  return p;
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
  home: string;
}

function report(args: ReportArgs): void {
  const { deps, output, results } = args;
  if (output === 'json') {
    deps.stdout(
      JSON.stringify(
        {
          source: args.source,
          scope: args.scope,
          dryRun: args.dryRun,
          version: args.newVersion,
          targets: results.map((r) => ({
            agents: r.agents,
            label: r.label,
            path: r.path,
            action: r.action,
            outcome: r.outcome,
            oldVersion: r.oldVersion,
            newVersion: r.newVersion,
            isSymlink: r.isSymlink,
            ...(r.reason ? { reason: r.reason } : {}),
          })),
          summary: tally(results),
        },
        null,
        2,
      ),
    );
    return;
  }

  deps.stdout(`a14y skill ${args.dryRun ? 'check' : 'install'} — source ${args.source}`);
  if (args.usedDefaultAgent) {
    deps.stdout(
      'No configured agent detected; defaulting to Claude Code. Use --agent or --target to choose another.',
    );
  }
  for (const r of results) {
    deps.stdout('  ' + formatLine(r, args.home));
  }
  const c = tally(results);
  const summary = [
    c.created ? `${c.created} ${args.dryRun ? 'to create' : 'created'}` : null,
    c.updated ? `${c.updated} ${args.dryRun ? 'to update' : 'updated'}` : null,
    c.unchanged ? `${c.unchanged} up to date` : null,
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

function formatLine(r: TargetResult, home: string): string {
  const labels: Record<Outcome, string> = {
    created: 'Installed',
    updated: 'Updated  ',
    unchanged: 'Up to date',
    skipped: 'Skipped  ',
    error: 'Failed   ',
    'would-create': 'Install  ',
    'would-update': 'Update   ',
    'would-skip': 'Skip     ',
  };
  const ver =
    r.outcome === 'updated' || r.outcome === 'would-update'
      ? `(${r.oldVersion ?? '?'} -> ${r.newVersion ?? '?'})`
      : r.newVersion
        ? `(${r.newVersion})`
        : '';
  const tail = r.reason ? `  — ${r.reason}` : '';
  return `${labels[r.outcome]}  ${r.label}  ${tildify(r.path, home)} ${ver}${tail}`.replace(
    /\s+$/,
    '',
  );
}
