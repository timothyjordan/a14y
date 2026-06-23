#!/usr/bin/env node

import { Command } from 'commander';
import {
  DRAFT_SCORECARD_VERSION,
  LATEST_SCORECARD,
  buildBadgeUrl,
  formatShareSummary,
  isDraftScorecardVersion,
  listScorecards,
  resolveScorecardSelector,
  runToAgentPrompt,
  validateMulti,
  type CheckResult,
  type ProgressEvent,
  type SiteRun,
} from '@a14y/core';
import {
  bucketScore,
  bucketPageCount,
  bucketIssueCount,
  bucketDurationMs,
  errorClassName,
} from '@a14y/telemetry';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { normalizeUrl, UnreachableUrlError } from './normalizeUrl';
import {
  initCliTelemetry,
  maybeShowFirstRunNotice,
  flushAndShutdown,
  track,
} from './telemetry';
import { emitScorecardChecks } from './scorecardEvents';
import { runSkillsCommand } from './skills';
import { runInstallCommand } from './install';

const STATUS_ICON: Record<CheckResult['status'], string> = {
  pass: chalk.green('✓'),
  fail: chalk.red('✗'),
  warn: chalk.yellow('!'),
  error: chalk.red('E'),
  na: chalk.gray('-'),
};

const program = new Command();

program
  .name('a14y')
  .description('Agent readability scorer — audits any website against the versioned a14y scorecard')
  .version('0.4.36') // x-release-please-version
  .option('--no-telemetry', 'disable anonymous usage telemetry for this run');

program
  .command('check <url>')
  .description('Audit a URL or whole site against the a14y scorecard')
  .option('-m, --mode <mode>', 'page or site', 'page')
  .option(
    '-s, --scorecard <version>',
    `scorecard version to evaluate against, or "draft" for the in-progress scorecard. Repeat the flag to score the same scan against multiple scorecards in one invocation. Defaults to "${LATEST_SCORECARD}".`,
    (value: string, prev: string[] | undefined) => [...(prev ?? []), value],
  )
  .option('--max-pages <n>', 'maximum pages to crawl in site mode', (v) => parseInt(v, 10), 500)
  .option('--concurrency <n>', 'parallel fetches during crawling', (v) => parseInt(v, 10), 8)
  .option(
    '--page-check-concurrency <n>',
    'parallel page-check evaluations (lower bounds peak memory on huge sites)',
    (v) => parseInt(v, 10),
    4,
  )
  .option('--polite-delay <ms>', 'minimum delay between request starts', (v) => parseInt(v, 10), 250)
  .option('-o, --output <format>', 'text, json, or agent-prompt', 'text')
  .option('--fail-under <score>', 'exit 1 if the final score is below this threshold', (v) => parseInt(v, 10))
  .option('--no-share', 'omit the shareable score block from text output')
  .option('-v, --verbose', 'stream progress events to stderr')
  .action(async (url: string, options, command) => {
    if (options.mode !== 'page' && options.mode !== 'site') {
      console.error(chalk.red(`Invalid --mode "${options.mode}", expected "page" or "site"`));
      track('cli_error', { command: 'check', phase: 'normalize', error_class: 'InvalidArg' });
      process.exit(2);
    }
    if (
      options.output !== 'text' &&
      options.output !== 'json' &&
      options.output !== 'agent-prompt'
    ) {
      console.error(
        chalk.red(
          `Invalid --output "${options.output}", expected "text", "json", or "agent-prompt"`,
        ),
      );
      track('cli_error', { command: 'check', phase: 'normalize', error_class: 'InvalidArg' });
      process.exit(2);
    }

    const cliInit = command.parent?.cliInit as Awaited<ReturnType<typeof initCliTelemetry>> | undefined;
    if (cliInit) await maybeShowFirstRunNotice(cliInit.runtime, options.output);
    const runId = cliInit?.runId;

    // Resolve every --scorecard selector up front so telemetry, the
    // validate*() call, and warnings all see the same concrete versions.
    // Empty array (no --scorecard flag at all) defaults to the latest
    // shipped scorecard — same behavior as before --scorecard became
    // repeatable.
    const rawSelectors: string[] = options.scorecard ?? [LATEST_SCORECARD];
    const scorecardVersions = Array.from(
      new Set(rawSelectors.map((s) => resolveScorecardSelector(s))),
    );
    const isMulti = scorecardVersions.length > 1;
    if (isMulti && options.output === 'agent-prompt') {
      console.error(
        chalk.red(
          '--output agent-prompt is single-scorecard only. Pick one scorecard or use --output json.',
        ),
      );
      track('cli_error', { command: 'check', phase: 'normalize', error_class: 'InvalidArg' });
      process.exit(2);
    }
    for (const v of scorecardVersions) {
      if (isDraftScorecardVersion(v)) {
        console.error(
          chalk.yellow(
            `! Using draft scorecard ${v} — checks are subject to change before release.`,
          ),
        );
      }
    }

    track('cli_command_invoked', {
      command: 'check',
      mode: options.mode,
      // Keep the single-scorecard telemetry shape stable; the new
      // `scorecard_versions` field captures the full list when --scorecard
      // is repeated. Consumers that grouped by `scorecard_version` keep
      // working for single-scorecard runs.
      scorecard_version: scorecardVersions[0],
      scorecard_versions: scorecardVersions,
      output_format: options.output,
      verbose: options.verbose === true,
      run_id: runId,
    });

    let resolvedUrl: string;
    try {
      const normalized = await normalizeUrl(url);
      resolvedUrl = normalized.url;
      if (normalized.rewrote) {
        console.error(chalk.gray(`→ Resolved to ${resolvedUrl}`));
      }
    } catch (e) {
      if (e instanceof UnreachableUrlError) {
        console.error(chalk.red('Error:'), e.message);
      } else {
        console.error(chalk.red('Error:'), (e as Error).message);
      }
      track('cli_error', {
        command: 'check',
        phase: 'normalize',
        error_class: errorClassName(e),
        run_id: runId,
      });
      process.exit(1);
    }

    const useSpinner = options.output === 'text' && !options.verbose && process.stderr.isTTY;
    const spinner: Ora | null = useSpinner ? ora({ text: `Auditing ${resolvedUrl}…`, stream: process.stderr }).start() : null;

    const onProgress = (event: ProgressEvent) => {
      if (spinner) {
        if (event.type === 'page-discovered') spinner.text = `Visited ${event.visited}: ${event.url}`;
        else if (event.type === 'site-check-done') spinner.text = `Site check: ${event.result.id}`;
        else if (event.type === 'finished') spinner.text = `Done — score ${event.summary.score}`;
        else if (event.type === 'seed-progress') {
          const text = describeSeedProgress(event.event);
          if (text) spinner.text = text;
        }
      } else if (options.verbose) {
        process.stderr.write(chalk.gray(`[${event.type}] ${describeEvent(event)}\n`));
      }
    };

    let results: SiteRun[];
    const runStart = Date.now();
    try {
      results = await validateMulti({
        url: resolvedUrl,
        mode: options.mode,
        scorecardVersions,
        maxPages: options.maxPages,
        concurrency: options.concurrency,
        pageCheckConcurrency: options.pageCheckConcurrency,
        politeDelayMs: options.politeDelay,
        onProgress,
      });
    } catch (e) {
      if (spinner) spinner.fail((e as Error).message);
      else console.error(chalk.red('Error:'), (e as Error).message);
      track('cli_error', {
        command: 'check',
        phase: 'validate',
        error_class: errorClassName(e),
        run_id: runId,
      });
      process.exit(1);
    }

    // `--fail-under` and the spinner "Score: …" line always refer to the
    // first --scorecard listed on the command line so the meaning is
    // predictable: the user controls which scorecard is the "primary"
    // by where they put it. In the single-scorecard case this is
    // identical to the historical behavior.
    const primary = results[0];
    if (spinner) spinner.succeed(`Score: ${primary.summary.score}/100`);

    const thresholdBreached =
      typeof options.failUnder === 'number' && primary.summary.score < options.failUnder;
    track('cli_run_completed', {
      mode: options.mode,
      scorecard_version: primary.scorecardVersion,
      scorecard_versions: results.map((r) => r.scorecardVersion),
      score_bucket: bucketScore(primary.summary.score),
      page_count_bucket: bucketPageCount(primary.pages.length),
      duration_ms_bucket: bucketDurationMs(Date.now() - runStart),
      failed_bucket: bucketIssueCount(primary.summary.failed),
      warned_bucket: bucketIssueCount(primary.summary.warned),
      errored_bucket: bucketIssueCount(primary.summary.errored),
      threshold_breached: thresholdBreached,
      run_id: runId,
    });

    if (runId) {
      for (const run of results) emitScorecardChecks({ run, runId, surface: 'cli' });
    }

    if (options.output === 'json') {
      // JSON output goes to stdout so it can be piped into jq.
      // Single-scorecard JSON keeps the historical shape (one SiteRun
      // object); multi-scorecard JSON is the SiteRun[] array so consumers
      // can iterate over per-scorecard summaries.
      console.log(JSON.stringify(isMulti ? results : primary, null, 2));
    } else if (options.output === 'agent-prompt') {
      // Markdown fix-prompt for a coding agent. De-duplicates failures
      // by check id and links each entry to its docs detail page.
      // Multi-scorecard is rejected up front, so `primary` is the only
      // run we ever reach this branch with.
      console.log(runToAgentPrompt(primary));
    } else if (isMulti) {
      printMultiScorecardReport(results);
    } else {
      printTextReport(primary);
      if (options.share !== false) printShareBlock(primary);
    }

    if (thresholdBreached) {
      console.error(
        chalk.red(`\nScore ${primary.summary.score} is below threshold ${options.failUnder}`),
      );
      process.exit(1);
    }
  });

program
  .command('scorecards')
  .description('List every shipped scorecard version and the checks each one pins')
  .option('-o, --output <format>', 'text or json', 'text')
  .action((options) => {
    const cliInit = (program as unknown as { cliInit?: Awaited<ReturnType<typeof initCliTelemetry>> }).cliInit;
    track('cli_command_invoked', {
      command: 'scorecards',
      output_format: options.output,
      run_id: cliInit?.runId,
    });
    const cards = listScorecards();
    if (options.output === 'json') {
      console.log(JSON.stringify(cards, null, 2));
      return;
    }
    for (const card of cards) {
      const isLatest = card.version === LATEST_SCORECARD;
      const isDraft = isDraftScorecardVersion(card.version);
      const tag = isDraft
        ? chalk.yellow(' (draft)')
        : isLatest
          ? chalk.gray(' (latest)')
          : '';
      const releasedLine = isDraft
        ? chalk.gray(' unreleased')
        : chalk.gray(` released ${card.releasedAt}`);
      console.log(chalk.bold(`v${card.version}`) + tag + releasedLine);
      console.log('  ' + card.description);
      console.log(`  ${Object.keys(card.checks).length} checks pinned`);
      if (card.scoringMethodology) {
        console.log(`  scoring: ${card.scoringMethodology}`);
      }
      console.log('');
    }
  });

program
  .command('skill')
  .argument('[action]', 'install (default), update, or uninstall')
  .description('Install, update, or uninstall the a14y agent skill for your coding agents (idempotent)')
  .option('--global', 'act on your home directory (default)')
  .option('--local', 'act on the current project instead of the home directory')
  .option('--project', 'guided install into the current project so collaborators share the skill')
  .option('--link', 'symlink mode: one shared copy in .agents/skills, linked from each agent')
  .option('--copy', 'copy mode: a SKILL.md in each agent\'s own skills dir (default)')
  .option('--target <dir>', 'write the skill to <dir>/a14y/SKILL.md, bypassing agent auto-detection')
  .option(
    '--agent <name>',
    'restrict to a specific agent (repeatable)',
    (value: string, prev: string[]) => [...prev, value],
    [],
  )
  .option('--check', 'report what would change without writing (exits 1 on drift)')
  .option('--dry-run', 'alias for --check')
  .option('--force', 'overwrite a user-modified target or write through a symlink')
  .option('-y, --yes', 'skip the interactive checklist and act on all detected agents')
  .option('-o, --output <format>', 'text or json', 'text')
  .action(async (action: string | undefined, options, command) => {
    if (options.output !== 'text' && options.output !== 'json') {
      console.error(chalk.red(`Invalid --output "${options.output}", expected "text" or "json"`));
      track('cli_error', { command: 'skill', phase: 'normalize', error_class: 'InvalidArg' });
      process.exit(2);
    }
    const cliInit = command.parent?.cliInit as Awaited<ReturnType<typeof initCliTelemetry>> | undefined;
    const exitCode = await runSkillsCommand(
      { ...options, action },
      {
        runId: cliInit?.runId,
        stdout: (line) => console.log(line),
        stderr: (line) => console.error(chalk.red(line)),
        track,
      },
    );
    if (exitCode !== 0) process.exit(exitCode);
  });

program
  .command('install')
  .description('Install a14y globally (npm i -g a14y), then install the agent skill')
  .option('--global', 'install the skill into your home directory (default)')
  .option('--local', 'install the skill into the current project instead')
  .option('--project', 'guided skill install into the current project (for collaborators)')
  .option('--link', 'symlink mode: one shared copy in .agents/skills, linked from each agent')
  .option('--copy', 'copy mode: a SKILL.md in each agent\'s own skills dir (default)')
  .option('--target <dir>', 'write the skill to <dir>/a14y/SKILL.md, bypassing agent auto-detection')
  .option(
    '--agent <name>',
    'restrict to a specific agent (repeatable)',
    (value: string, prev: string[]) => [...prev, value],
    [],
  )
  .option('--check', 'preview without writing (skips the global install too)')
  .option('--dry-run', 'alias for --check')
  .option('--force', 'overwrite a user-modified target or write through a symlink')
  .option('-y, --yes', 'skip the interactive checklist and act on all detected agents')
  .option('-o, --output <format>', 'text or json', 'text')
  .action(async (options, command) => {
    if (options.output !== 'text' && options.output !== 'json') {
      console.error(chalk.red(`Invalid --output "${options.output}", expected "text" or "json"`));
      track('cli_error', { command: 'install', phase: 'normalize', error_class: 'InvalidArg' });
      process.exit(2);
    }
    const cliInit = command.parent?.cliInit as Awaited<ReturnType<typeof initCliTelemetry>> | undefined;
    const exitCode = await runInstallCommand(
      { ...options },
      {
        runId: cliInit?.runId,
        stdout: (line) => console.log(line),
        stderr: (line) => console.error(chalk.red(line)),
        track,
      },
    );
    if (exitCode !== 0) process.exit(exitCode);
  });

program.addHelpText(
  'after',
  `
Commands in detail:
  check <url>                   Audit a URL or a whole site
    -m, --mode page|site          default: page
    -s, --scorecard <version>     scorecard version, or "draft" for the in-progress one.
                                  Repeat to score the same scan against multiple scorecards
                                  in one invocation, e.g. -s 0.2.0 -s draft
    --max-pages <n>               default: 500
    --concurrency <n>             default: 8
    --page-check-concurrency <n>  default: 4
    --polite-delay <ms>           default: 250
    -o, --output <format>         text | json | agent-prompt
                                  (multi-scorecard runs require text or json)
    --fail-under <score>          exit 1 if first scorecard's final score < threshold
    --no-share                    omit the shareable score block (single scorecard only)
    -v, --verbose                 stream progress events to stderr

  scorecards                    List shipped scorecard versions
    -o, --output <format>         text | json

  install                       Install a14y globally, then install the agent skill
    (accepts the same flags as 'skill' below — e.g. --project, --link, -y)

  skill [install|update|uninstall]  Manage the a14y agent skill (idempotent; default: install)
    --global                      act on the home dir (default)
    --local                       act on the current project instead
    --project                     guided project install (for collaborators)
    --link                        symlink mode: shared copy in .agents/skills
    --copy                        copy mode: a SKILL.md per agent (default)
    --target <dir>                write to <dir>/a14y/SKILL.md, skip auto-detect
    --agent <name>                restrict to one agent (repeatable)
    --check, --dry-run            report drift without writing (exit 1 on drift)
    --force                       overwrite a user-modified target or symlink
    -y, --yes                     act on all detected agents (no checklist)
    -o, --output <format>         text | json

Run 'a14y help <command>' (or 'a14y <command> --help') for full details.
Tip: 'check' is the default — 'a14y <url>' works the same as 'a14y check <url>'.
`,
);

// Default to the `check` subcommand when the first positional is neither a
// known command nor a flag. `a14y example.com` should behave the same as
// `a14y check example.com`.
const KNOWN_COMMANDS = new Set(['check', 'scorecards', 'skill', 'install', 'help']);
const argv = process.argv.slice();
const firstPositional = argv.findIndex((a, i) => i >= 2 && !a.startsWith('-'));
if (firstPositional !== -1 && !KNOWN_COMMANDS.has(argv[firstPositional])) {
  argv.splice(firstPositional, 0, 'check');
}

async function main(): Promise<void> {
  const flagDisabled = argv.includes('--no-telemetry');
  const cliInit = await initCliTelemetry({ flagDisabled });
  // Stash on the program so subcommand actions can read the runtime + run_id
  // without a module-level singleton.
  (program as unknown as { cliInit: typeof cliInit }).cliInit = cliInit;

  try {
    await program.parseAsync(argv);
  } catch (e) {
    track('cli_error', {
      command: 'unknown',
      phase: 'output',
      error_class: errorClassName(e),
      run_id: cliInit.runId,
    });
    console.error(chalk.red('Fatal:'), (e as Error).message);
    await flushAndShutdown();
    process.exit(1);
  }

  await flushAndShutdown();
}

void main();

function describeEvent(event: ProgressEvent): string {
  switch (event.type) {
    case 'started':
      return `${event.mode} ${event.url} (scorecard ${event.scorecardVersion})`;
    case 'site-check-done':
      return `${event.result.id} → ${event.result.status}`;
    case 'page-discovered':
      return `${event.url} (#${event.visited})`;
    case 'page-done':
      return `${event.url} (${event.passed}/${event.total} passed)`;
    case 'seed-progress': {
      const e = event.event;
      if (e.kind === 'child') {
        return `${e.resource} child ${e.visited}/${e.total}`;
      }
      if (e.kind === 'done') {
        return `${e.resource} ${e.found ? 'found' : 'missing'}`;
      }
      return `${e.resource} loading`;
    }
    case 'finished':
      return `score ${event.summary.score}`;
  }
}

// `Extract` distributes over the `ProgressEvent` union and pulls the
// `seed-progress` variant's payload type. The previous inline
// conditional `ProgressEvent extends ... ? ... : never` did *not*
// distribute (distribution requires a generic type parameter, and
// `ProgressEvent` is a concrete type), which collapsed the result to
// `never` and made every property access on `event` an error.
type SeedProgressPayload = Extract<ProgressEvent, { type: 'seed-progress' }>['event'];

function describeSeedProgress(event: SeedProgressPayload): string | null {
  // Map the structured event to a single-line spinner string. `done` is a
  // no-op so the next event (page-discovered, child progress on the next
  // resource, or site-check-done) takes over without a flicker.
  if (event.kind === 'start') {
    return `Loading ${labelForResource(event.resource)}…`;
  }
  if (event.kind === 'child') {
    return `Loading ${labelForResource(event.resource)} (${event.visited}/${event.total})…`;
  }
  return null;
}

function labelForResource(resource: 'llms-txt' | 'sitemap-xml' | 'sitemap-md'): string {
  switch (resource) {
    case 'llms-txt':
      return 'llms.txt';
    case 'sitemap-xml':
      return 'sitemap.xml';
    case 'sitemap-md':
      return 'sitemap.md';
  }
}

function printMultiScorecardReport(runs: SiteRun[]): void {
  // Multi-scorecard text mode is for at-a-glance comparison. Print one
  // summary row per scorecard, then the full detail block for the first
  // listed scorecard (the "primary"). Anyone who needs per-scorecard
  // detail can re-run with a single --scorecard or pipe --output json.
  console.log('');
  console.log(chalk.bold('Multi-scorecard run'));
  for (const r of runs) {
    console.log(
      `  ${scoreColor(r.summary.score)}  v${r.scorecardVersion}  ${chalk.gray(
        `(${r.scoringMethodology})`,
      )}  ${chalk.gray(
        `${r.summary.passed}/${r.summary.applicable} pass · ${r.summary.failed} fail · ${r.summary.warned} warn`,
      )}`,
    );
  }
  console.log('');
  console.log(
    chalk.gray(
      `Detail view below uses v${runs[0].scorecardVersion}. For per-scorecard detail, ` +
        `re-run with a single --scorecard or use --output json.`,
    ),
  );
  printTextReport(runs[0]);
  // Skip the share block — it's tied to one scorecard and would be
  // ambiguous in multi-mode. Single-scorecard runs still print it.
}

function printTextReport(run: SiteRun): void {
  console.log('');
  console.log(chalk.bold(`Agent Readability Score: ${run.summary.score}/100`));
  console.log(
    chalk.gray(
      `  scorecard ${run.scorecardVersion} (released ${run.scorecardReleasedAt}) — mode ${run.mode} — scoring ${run.scoringMethodology}`,
    ),
  );
  console.log(
    chalk.gray(
      `  ${run.summary.passed} pass · ${run.summary.failed} fail · ${run.summary.warned} warn · ${run.summary.errored} error · ${run.summary.na} n/a (out of ${run.summary.total})`,
    ),
  );

  console.log('\n' + chalk.bold('Site checks'));
  printGroupedChecks(run.siteChecks);

  if (run.pages.length === 1) {
    console.log('\n' + chalk.bold(`Page checks — ${run.pages[0].finalUrl}`));
    printGroupedChecks(run.pages[0].checks);
  } else {
    console.log('\n' + chalk.bold(`Pages (${run.pages.length})`));
    for (const p of run.pages) {
      console.log(
        `  ${scoreColor(p.summary.score)}  ${p.finalUrl}  ${chalk.gray(
          `${p.summary.passed}/${p.summary.applicable}`,
        )}`,
      );
    }
  }

  // TJ-428: page mode is the default and only audits the URL provided.
  // Site-scope checks (llms.txt, sitemap, AGENTS.md) still run, but per-page
  // checks aren't evaluated against the rest of the origin. Surface that
  // explicitly so users don't mistake a single-page review for a full audit.
  // Yellow `!` matches the draft-scorecard warning style so the call-out
  // reads as "heads up" rather than another gray detail line.
  if (run.mode === 'page') {
    console.log('');
    console.log(`${chalk.yellow('!')} Single-page review: only ${run.pages[0].finalUrl} was audited.`);
    console.log('  For a full-site audit (crawls every reachable page) run:');
    console.log('  ' + chalk.cyan(`a14y ${run.url} --mode site`));
  }
}

function printShareBlock(run: SiteRun): void {
  // The post is wrapped in a pair of dashed rules. The label "Copy and paste
  // this post " is folded into the start rule so the box reads as a single
  // visual envelope; the end rule is plain dashes of equal length. Rule
  // lines are dim gray; the post body keeps the default terminal color so it
  // stands out as the copyable content.
  const ruleWidth = 72;
  const startLabel = 'Copy and paste this post ';
  const startRule = startLabel + '-'.repeat(Math.max(ruleWidth - startLabel.length, 0));
  const endRule = '-'.repeat(ruleWidth);

  console.log('');
  console.log(chalk.bold('Share your score'));
  console.log(chalk.gray(startRule));
  for (const line of formatShareSummary(run, { surface: 'cli' }).split('\n')) {
    console.log(line);
  }
  console.log(chalk.gray(endRule));
  console.log('');
  console.log(chalk.gray('Embed badge: ' + buildBadgeUrl(run)));
  console.log('');
}

function printGroupedChecks(checks: CheckResult[]): void {
  const groups = new Map<string, CheckResult[]>();
  for (const c of checks) {
    const g = c.group ?? 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }
  for (const [group, items] of groups) {
    console.log('  ' + chalk.dim(group));
    for (const c of items) {
      const line = `    ${STATUS_ICON[c.status]} ${c.id}${c.message ? chalk.gray(` — ${c.message}`) : ''}`;
      console.log(line);
    }
  }
}

function scoreColor(score: number): string {
  if (score >= 90) return chalk.green(`${score}`.padStart(3));
  if (score >= 70) return chalk.yellow(`${score}`.padStart(3));
  return chalk.red(`${score}`.padStart(3));
}
