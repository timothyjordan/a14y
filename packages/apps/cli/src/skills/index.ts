import os from 'node:os';
import path from 'node:path';
import {
  AGENT_REGISTRY,
  agentByName,
  DEFAULT_AGENT,
  sharedSkillsDir,
  type AgentEntry,
  type PathCtx,
} from './registry';
import { skillFile, SkillsConfigError, type Scope, type SkillTarget } from './paths';
import {
  agentTargets,
  buildTargets,
  detectAgentMatches,
  explicitTarget,
  scanInstalled,
  type InstallMethod,
  type RemovalTarget,
} from './detect';
import { fetchSkill, skillSourceUrl, SkillFetchError } from './fetch';
import { nodeFs, type FsFacade } from './fsFacade';
import { parseSkillVersion } from './frontmatter';
import { planFile, planLink, type SkillAction, type TargetPlan } from './plan';
import {
  promptChooseAgents,
  promptLocation,
  promptSelectTargets,
  type AgentChoice,
  type PromptChooseAgents,
  type PromptLocation,
  type PromptSelect,
  type SelectChoice,
} from './prompt';

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;
type TrackFn = (event: string, props?: Record<string, unknown>) => void;

export type SkillActionVerb = 'install' | 'update' | 'uninstall';

export interface RunSkillsOptions {
  /** `install` (default), `update` (= install), or `uninstall`. */
  action?: string;
  local?: boolean;
  project?: boolean;
  global?: boolean;
  target?: string;
  agent?: string[];
  /** Symlink install mode: one shared copy + symlinks from each agent. */
  link?: boolean;
  /** Copy install mode: a SKILL.md in each agent's own dir (default). */
  copy?: boolean;
  check?: boolean;
  dryRun?: boolean;
  force?: boolean;
  /** Skip the interactive checklist and act on all detected agents. */
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
  promptChooseAgents?: PromptChooseAgents;
  promptLocation?: PromptLocation;
}

type Outcome =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'skipped'
  | 'error'
  | 'removed'
  | 'would-create'
  | 'would-update'
  | 'would-skip'
  | 'would-remove';

interface PlanEntry {
  target: SkillTarget;
  plan: TargetPlan;
}

interface TargetResult {
  agents: string[];
  label: string;
  path: string;
  action: SkillAction | 'remove';
  outcome: Outcome;
  oldVersion: string | null;
  newVersion: string | null;
  isSymlink: boolean;
  reason?: string;
}

interface Ctx {
  opts: RunSkillsOptions;
  deps: RunSkillsDeps;
  fs: FsFacade;
  track: TrackFn;
  ctx: PathCtx;
  home: string;
  output: 'text' | 'json';
  dryRun: boolean;
  force: boolean;
  isTTY: boolean;
  scope: Scope;
}

/**
 * Install, update, or uninstall the a14y agent skill across the user's coding
 * agents. Auto-detects configured agents, shows a checklist, and only writes
 * what changed (idempotent — a prior install, however it was made, reads as up
 * to date). Returns the process exit code.
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
  const pathCtx: PathCtx = { home, cwd, env };

  const action = (opts.action ?? 'install') as SkillActionVerb;
  if (action !== 'install' && action !== 'update' && action !== 'uninstall') {
    deps.stderr(`Unknown skill action "${opts.action}". Usage: a14y skill [install|update|uninstall]`);
    return 2;
  }

  const wantsLocal = Boolean(opts.local || opts.project);
  if (wantsLocal && opts.global) {
    deps.stderr('Pass only one of --global or --local.');
    return 2;
  }
  const scope: Scope = wantsLocal ? 'local' : 'global';

  const c: Ctx = {
    opts,
    deps,
    fs,
    track,
    ctx: pathCtx,
    home,
    output: opts.output ?? 'text',
    dryRun: Boolean(opts.check || opts.dryRun),
    force: Boolean(opts.force),
    isTTY: deps.isTTY ?? Boolean(process.stdout.isTTY),
    scope,
  };

  if (action === 'uninstall') return runUninstall(c);
  if (opts.project) return runProjectInstall(c, action);
  return runInstall(c, action);
}

async function runInstall(c: Ctx, action: 'install' | 'update'): Promise<number> {
  const { opts, deps, fs, track } = c;

  if (opts.link && opts.copy) {
    deps.stderr('Pass only one of --link or --copy.');
    return 2;
  }

  const scopeFlag: Scope | null = opts.local || opts.project ? 'local' : opts.global ? 'global' : null;
  const methodFlag: InstallMethod | null = opts.link ? 'link' : opts.copy ? 'copy' : null;
  const interactiveBase = c.isTTY && !opts.yes && !c.dryRun;

  // 1. Choose harnesses (agents). In interactive detect mode this is the
  // Impeccable-style "detected only / customize" + full picker.
  let agents: AgentEntry[];
  let mode: 'detect' | 'agent' | 'target';
  let usedDefaultAgent = false;
  let explicit: SkillTarget | null = null;
  try {
    if (opts.target) {
      explicit = explicitTarget(opts.target, c.ctx);
      mode = 'target';
      agents = [];
    } else if ((opts.agent ?? []).length > 0) {
      agentTargets(opts.agent!, 'global', c.ctx, 'copy'); // validate names
      agents = opts.agent!.map((n) => agentByName(n)!);
      mode = 'agent';
    } else {
      mode = 'detect';
      const matches = await detectAgentMatches(c.ctx, fs);
      if (interactiveBase) {
        if (matches.length > 0) {
          deps.stdout('Detected harnesses:');
          for (const m of matches) deps.stdout(`  ${m.agent.label}  ${tildify(m.dir, c.home)}`);
        } else {
          deps.stdout('No configured harnesses detected.');
        }
        deps.stdout(''); // blank line before the picker prompt
        const detectedNames = matches.map((m) => m.agent.name);
        const choices: AgentChoice[] = AGENT_REGISTRY.map((a) => ({
          name: a.name,
          title: `${a.label} (${a.localDir})`,
          selected:
            detectedNames.includes(a.name) ||
            (matches.length === 0 && a.name === DEFAULT_AGENT),
        }));
        const chosen = await (deps.promptChooseAgents ?? promptChooseAgents)(
          { names: detectedNames, labels: matches.map((m) => m.agent.label) },
          choices,
        );
        if (chosen === null) {
          deps.stdout('Cancelled — nothing was changed.');
          return 0;
        }
        if (chosen.length === 0) {
          deps.stdout('No harnesses selected — nothing to do.');
          return 0;
        }
        agents = chosen.map((n) => agentByName(n)!).filter(Boolean);
      } else if (matches.length > 0) {
        agents = matches.map((m) => m.agent);
      } else {
        agents = [agentByName(DEFAULT_AGENT)!];
        usedDefaultAgent = true;
      }
    }
  } catch (e) {
    return failConfig(c, e);
  }

  // 2. Choose where: a shared global location (symlinked) or this project.
  // Flags win; otherwise prompt interactively; otherwise default global copy.
  let scope: Scope;
  let method: InstallMethod;
  if (explicit) {
    scope = scopeFlag ?? 'global';
    method = 'copy';
  } else if (scopeFlag || methodFlag) {
    scope = scopeFlag ?? 'global';
    method = methodFlag ?? 'copy';
  } else if (interactiveBase && mode !== 'target') {
    const loc = await (deps.promptLocation ?? promptLocation)();
    if (loc === null) {
      deps.stdout('Cancelled — nothing was changed.');
      return 0;
    }
    [scope, method] = loc === 'global-shared' ? (['global', 'link'] as const) : (['global', 'copy'] as const);
  } else {
    scope = 'global';
    method = 'copy';
  }
  c.scope = scope; // report() reads this

  // 3. Build concrete targets.
  let targets: SkillTarget[];
  try {
    targets = explicit ? [explicit] : buildTargets(agents, scope, c.ctx, method);
  } catch (e) {
    return failConfig(c, e);
  }

  track('cli_command_invoked', {
    command: 'skill',
    action,
    scope,
    mode,
    method,
    dry_run: c.dryRun,
    force: c.force,
    target_count: targets.length,
    output_format: c.output,
    run_id: deps.runId,
  });

  const code = await installTargets(c, { targets, action, method, usedDefaultAgent });

  // Point users at the project install once a normal (global) install lands.
  if (code === 0 && !c.dryRun && c.output === 'text' && mode !== 'target') {
    deps.stdout('');
    deps.stdout('Tip: to install for a specific project so collaborators share the skill, run');
    deps.stdout('  a14y skill install --project');
    deps.stdout('from inside that project’s directory.');
  }
  return code;
}

/**
 * Guided install into the current project so collaborators share the skill.
 * Asks what to write (per-agent dirs and/or a shared `.agents/skills`) and, for
 * per-agent, which agents (Claude, Codex, Copilot, Cursor checked by default).
 */
async function runProjectInstall(c: Ctx, action: 'install' | 'update'): Promise<number> {
  const { opts, deps, track } = c;
  c.scope = 'local';
  const interactive = c.isTTY && !opts.yes && !c.dryRun;
  const select = deps.promptSelect ?? promptSelectTargets;
  const DEFAULT_PROJECT_AGENTS = ['claude', 'codex', 'copilot', 'cursor'];

  if (c.output === 'text') {
    deps.stdout('Installing the a14y skill into this project so collaborators share it.');
    deps.stdout(`Project directory: ${c.ctx.cwd}`);
    deps.stdout('To install into a different project, exit and re-run from inside it.');
    deps.stdout('');
  }

  // What to write: per-agent dirs and/or the shared .agents/skills dir.
  let what: string[];
  if (interactive) {
    const chosen = await select('Install in this project as:', [
      {
        value: 'per-agent',
        title: 'Per-agent directories (.claude/skills, .cursor/skills, …)',
        hint: '',
        selected: true,
      },
      { value: 'agents', title: 'Shared .agents/skills (one copy)', hint: '', selected: true },
    ]);
    if (chosen === null) {
      deps.stdout('Cancelled — nothing was changed.');
      return 0;
    }
    what = chosen;
  } else {
    what = ['per-agent', 'agents'];
  }
  if (what.length === 0) {
    deps.stdout('Nothing selected — nothing to do.');
    return 0;
  }

  // Which agents (only when writing per-agent dirs).
  let agents: AgentEntry[] = [];
  if (what.includes('per-agent')) {
    if ((opts.agent ?? []).length > 0) {
      try {
        agentTargets(opts.agent!, 'local', c.ctx, 'copy'); // validate names
      } catch (e) {
        return failConfig(c, e);
      }
      agents = opts.agent!.map((n) => agentByName(n)!);
    } else if (interactive) {
      const choices: SelectChoice[] = AGENT_REGISTRY.map((a) => ({
        value: a.name,
        title: `${a.label} (${a.localDir})`,
        hint: '',
        selected: DEFAULT_PROJECT_AGENTS.includes(a.name),
      }));
      const chosen = await select('Which agents?', choices);
      if (chosen === null) {
        deps.stdout('Cancelled — nothing was changed.');
        return 0;
      }
      agents = chosen.map((n) => agentByName(n)!).filter(Boolean);
    } else {
      agents = DEFAULT_PROJECT_AGENTS.map((n) => agentByName(n)!);
    }
  }

  // Build targets: per-agent copies + an optional shared .agents/skills copy.
  let targets: SkillTarget[] = [];
  try {
    if (agents.length > 0) targets.push(...buildTargets(agents, 'local', c.ctx, 'copy'));
  } catch (e) {
    return failConfig(c, e);
  }
  if (what.includes('agents')) {
    targets.push({
      kind: 'copy',
      agents: ['shared'],
      label: 'Shared (.agents/skills)',
      managedPath: skillFile(sharedSkillsDir(c.ctx, 'local')),
    });
  }
  targets = dedupeByPath(targets);
  if (targets.length === 0) {
    deps.stdout('Nothing selected — nothing to do.');
    return 0;
  }

  track('cli_command_invoked', {
    command: 'skill',
    action,
    scope: 'local',
    mode: 'project',
    method: 'copy',
    dry_run: c.dryRun,
    force: c.force,
    target_count: targets.length,
    output_format: c.output,
    run_id: deps.runId,
  });

  return installTargets(c, { targets, action, method: 'copy', usedDefaultAgent: false });
}

/** Merge copy targets that resolve to the same file (e.g. a `.agents/skills`
 *  agent and the explicit shared copy). */
function dedupeByPath(targets: SkillTarget[]): SkillTarget[] {
  const byPath = new Map<string, SkillTarget>();
  for (const t of targets) {
    const hit = byPath.get(t.managedPath);
    if (hit) {
      hit.agents = [...new Set([...hit.agents, ...t.agents])];
      if (!hit.label.includes(t.label)) hit.label = `${hit.label} + ${t.label}`;
    } else {
      byPath.set(t.managedPath, { ...t });
    }
  }
  return [...byPath.values()];
}

/** Shared fetch -> plan -> (dry-run report | apply) -> report tail. */
async function installTargets(
  c: Ctx,
  opts: {
    targets: SkillTarget[];
    action: 'install' | 'update';
    method: InstallMethod;
    usedDefaultAgent: boolean;
  },
): Promise<number> {
  const { deps, track } = c;
  const { targets, action, method, usedDefaultAgent } = opts;

  let fetched: string;
  try {
    fetched = await fetchSkill({ fetchImpl: deps.fetchImpl });
  } catch (e) {
    deps.stderr((e as Error).message);
    track('cli_error', {
      command: 'skill',
      phase: 'fetch',
      error_class: e instanceof SkillFetchError ? 'SkillFetchError' : (e as Error).name,
      run_id: deps.runId,
    });
    return 1;
  }
  const newVersion = parseSkillVersion(fetched);

  const entries: PlanEntry[] = [];
  for (const target of targets) {
    entries.push({ target, plan: await planOne(c, target, fetched, newVersion) });
  }

  if (c.dryRun) {
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
    report(c, { source: skillSourceUrl(), newVersion, results, usedDefaultAgent });
    return entries.some((e) => e.plan.action !== 'unchanged') ? 1 : 0;
  }

  // Canonical first so symlinks have something to point at.
  const ordered = [...entries].sort((a, b) =>
    a.target.kind === 'canonical' ? -1 : b.target.kind === 'canonical' ? 1 : 0,
  );
  const results: TargetResult[] = [];
  for (const e of ordered) {
    const a = e.plan.action;
    if (a === 'unchanged') {
      results.push(toResult(e, 'unchanged'));
      continue;
    }
    if (a === 'conflict') {
      results.push(toResult(e, 'skipped', e.plan.conflictReason));
      continue;
    }
    try {
      await applyTarget(c, e.target, fetched);
      results.push(toResult(e, a === 'create' ? 'created' : 'updated'));
    } catch (err) {
      results.push(toResult(e, 'error', (err as Error).message));
    }
  }

  const counts = tally(results);
  track('cli_skill_applied', {
    action,
    method,
    created: counts.created,
    updated: counts.updated,
    unchanged: counts.unchanged,
    skipped: counts.skipped,
    errors: counts.error,
    new_version: newVersion,
    run_id: deps.runId,
  });
  report(c, { source: skillSourceUrl(), newVersion, results, usedDefaultAgent });

  return counts.error > 0 || entries.some((e) => e.plan.action === 'conflict') ? 1 : 0;
}

async function planOne(
  c: Ctx,
  target: SkillTarget,
  fetched: string,
  newVersion: string | null,
): Promise<TargetPlan> {
  if (target.kind === 'link') {
    const st = await c.fs.lstat(target.managedPath);
    const existing = !st
      ? { kind: 'absent' as const }
      : st.isSymbolicLink
        ? { kind: 'symlink' as const, linkTarget: await c.fs.readlink(target.managedPath) }
        : { kind: 'other' as const };
    return planLink({ target, fetchedVersion: newVersion, existing, force: c.force });
  }
  // copy / canonical: a real file.
  const skillDirPath = path.dirname(target.managedPath); // <skillsDir>/a14y
  const [fileStat, dirStat, current] = await Promise.all([
    c.fs.lstat(target.managedPath),
    c.fs.lstat(skillDirPath),
    c.fs.readFile(target.managedPath),
  ]);
  const isSymlink = Boolean(fileStat?.isSymbolicLink || dirStat?.isSymbolicLink);
  return planFile({ target, fetched, current, isSymlink, force: c.force });
}

async function applyTarget(c: Ctx, target: SkillTarget, fetched: string): Promise<void> {
  if (target.kind === 'link') {
    await c.fs.mkdirp(path.dirname(target.managedPath)); // the agent's skills dir
    await c.fs.rm(target.managedPath); // clear any wrong link / placeholder (no-op if absent)
    await c.fs.symlink(target.linkTo!, target.managedPath);
    return;
  }
  await c.fs.mkdirp(path.dirname(target.managedPath));
  await c.fs.writeFile(target.managedPath, fetched);
}

async function runUninstall(c: Ctx): Promise<number> {
  const { deps, fs, track } = c;
  let found: RemovalTarget[];
  try {
    found = await scanInstalled(c.ctx, c.scope, fs);
  } catch (e) {
    return failConfig(c, e);
  }

  track('cli_command_invoked', {
    command: 'skill',
    action: 'uninstall',
    scope: c.scope,
    found: found.length,
    dry_run: c.dryRun,
    output_format: c.output,
    run_id: deps.runId,
  });

  if (found.length === 0) {
    if (c.output === 'json') {
      deps.stdout(JSON.stringify({ scope: c.scope, removed: [], summary: { removed: 0 } }, null, 2));
    } else {
      deps.stdout(`a14y skill is not installed under the ${c.scope} scope. Nothing to remove.`);
    }
    return 0;
  }

  // Selection.
  let selected: Set<string>;
  const interactive = c.isTTY && !c.opts.yes && !c.dryRun;
  if (c.dryRun) {
    selected = new Set();
  } else if (interactive) {
    const choices: SelectChoice[] = found.map((f) => ({
      value: f.path,
      title: `${f.label}  ${tildify(f.path, c.home)}`,
      hint: f.kind === 'link' ? 'symlink' : f.version ? `installed ${f.version}` : 'installed',
      selected: true,
    }));
    const chosen = await (deps.promptSelect ?? promptSelectTargets)(
      'Remove the a14y skill from:',
      choices,
    );
    if (chosen === null) {
      deps.stdout('Cancelled — nothing was removed.');
      return 0;
    }
    selected = new Set(chosen);
  } else {
    selected = new Set(found.map((f) => f.path));
  }

  const results: TargetResult[] = [];
  for (const f of found) {
    const base: TargetResult = {
      agents: f.agents,
      label: f.label,
      path: f.path,
      action: 'remove',
      outcome: 'removed',
      oldVersion: f.version,
      newVersion: null,
      isSymlink: f.kind === 'link',
    };
    if (c.dryRun) {
      results.push({ ...base, outcome: 'would-remove' });
      continue;
    }
    if (!selected.has(f.path)) {
      results.push({ ...base, outcome: 'skipped', reason: 'deselected' });
      continue;
    }
    try {
      await fs.rm(f.path);
      results.push(base);
    } catch (err) {
      results.push({ ...base, outcome: 'error', reason: (err as Error).message });
    }
  }

  const counts = tally(results);
  track('cli_skill_removed', {
    removed: counts.removed,
    skipped: counts.skipped,
    errors: counts.error,
    run_id: deps.runId,
  });
  report(c, { source: null, newVersion: null, results, usedDefaultAgent: false });
  if (c.dryRun) return found.length > 0 ? 1 : 0;
  return counts.error > 0 ? 1 : 0;
}

function failConfig(c: Ctx, e: unknown): number {
  if (e instanceof SkillsConfigError) {
    c.deps.stderr(e.message);
    c.track('cli_error', {
      command: 'skill',
      phase: 'normalize',
      error_class: 'SkillsConfigError',
      run_id: c.deps.runId,
    });
    return 2;
  }
  throw e;
}

function toResult(e: PlanEntry, outcome: Outcome, reason?: string): TargetResult {
  return {
    agents: e.target.agents,
    label: e.target.label,
    path: e.target.managedPath,
    action: e.plan.action,
    outcome,
    oldVersion: e.plan.oldVersion,
    newVersion: e.plan.newVersion,
    isSymlink: e.plan.isSymlink,
    reason,
  };
}

function tally(results: TargetResult[]) {
  const counts = { created: 0, updated: 0, unchanged: 0, skipped: 0, error: 0, removed: 0 };
  for (const r of results) {
    if (r.outcome === 'created' || r.outcome === 'would-create') counts.created++;
    else if (r.outcome === 'updated' || r.outcome === 'would-update') counts.updated++;
    else if (r.outcome === 'unchanged') counts.unchanged++;
    else if (r.outcome === 'skipped' || r.outcome === 'would-skip') counts.skipped++;
    else if (r.outcome === 'removed' || r.outcome === 'would-remove') counts.removed++;
    else if (r.outcome === 'error') counts.error++;
  }
  return counts;
}

function tildify(p: string, home: string): string {
  if (home && (p === home || p.startsWith(home + path.sep))) return '~' + p.slice(home.length);
  return p;
}

interface ReportArgs {
  source: string | null;
  newVersion: string | null;
  results: TargetResult[];
  usedDefaultAgent: boolean;
}

function report(c: Ctx, args: ReportArgs): void {
  const { deps, output } = c;
  if (output === 'json') {
    deps.stdout(
      JSON.stringify(
        {
          source: args.source ?? undefined,
          scope: c.scope,
          dryRun: c.dryRun,
          version: args.newVersion ?? undefined,
          targets: args.results.map((r) => ({
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
          summary: tally(args.results),
        },
        null,
        2,
      ),
    );
    return;
  }

  const verb = args.results.some((r) => r.action === 'remove') ? 'uninstall' : 'install';
  const header =
    verb === 'uninstall'
      ? `a14y skill ${c.dryRun ? 'check' : 'uninstall'}`
      : `a14y skill ${c.dryRun ? 'check' : 'install'} — source ${args.source}`;
  deps.stdout(header);
  if (args.usedDefaultAgent) {
    deps.stdout(
      'No configured agent detected; defaulting to Claude Code. Use --agent or --target to choose another.',
    );
  }
  for (const r of args.results) {
    deps.stdout('  ' + formatLine(r, c.home));
  }
  const t = tally(args.results);
  const summary = [
    t.created ? `${t.created} ${c.dryRun ? 'to create' : 'created'}` : null,
    t.updated ? `${t.updated} ${c.dryRun ? 'to update' : 'updated'}` : null,
    t.removed ? `${t.removed} ${c.dryRun ? 'to remove' : 'removed'}` : null,
    t.unchanged ? `${t.unchanged} up to date` : null,
    t.skipped ? `${t.skipped} skipped` : null,
    t.error ? `${t.error} failed` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const drift = t.created > 0 || t.updated > 0 || t.removed > 0 || t.skipped > 0;
  if (c.dryRun) {
    deps.stdout(drift ? `Would change: ${summary}` : `Up to date — ${summary || 'nothing to do'}`);
    if (drift) deps.stdout(`Run \`a14y skill ${verb}\` without --check to apply.`);
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
    removed: 'Removed  ',
    'would-create': 'Install  ',
    'would-update': 'Update   ',
    'would-skip': 'Skip     ',
    'would-remove': 'Remove   ',
  };
  const ver =
    r.outcome === 'updated' || r.outcome === 'would-update'
      ? `(${r.oldVersion ?? '?'} -> ${r.newVersion ?? '?'})`
      : r.newVersion
        ? `(${r.newVersion})`
        : r.oldVersion
          ? `(${r.oldVersion})`
          : '';
  const link = r.isSymlink ? ' [symlink]' : '';
  const tail = r.reason ? `  — ${r.reason}` : '';
  return `${labels[r.outcome]}  ${r.label}  ${tildify(r.path, home)}${link} ${ver}${tail}`.replace(
    /\s+$/,
    '',
  );
}
