#!/usr/bin/env node

import { Command } from 'commander';
import {
  LATEST_SCORECARD,
  listScorecards,
  runToAgentPrompt,
  validate,
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
  .version('0.4.2') // x-release-please-version
  .option('--no-telemetry', 'disable anonymous usage telemetry for this run');

program
  .command('check <url>')
  .description('Audit a URL or whole site against the a14y scorecard')
  .option('-m, --mode <mode>', 'page or site', 'page')
  .option('-s, --scorecard <version>', 'scorecard version to evaluate against', LATEST_SCORECARD)
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

    const runtime = command.parent?.runtime as Awaited<ReturnType<typeof initCliTelemetry>>['runtime'] | undefined;
    if (runtime) await maybeShowFirstRunNotice(runtime, options.output);

    track('cli_command_invoked', {
      command: 'check',
      mode: options.mode,
      scorecard_version: options.scorecard,
      output_format: options.output,
      verbose: options.verbose === true,
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

    let result: SiteRun;
    const runStart = Date.now();
    try {
      result = await validate({
        url: resolvedUrl,
        mode: options.mode,
        scorecardVersion: options.scorecard,
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
      });
      process.exit(1);
    }

    if (spinner) spinner.succeed(`Score: ${result.summary.score}/100`);

    const thresholdBreached =
      typeof options.failUnder === 'number' && result.summary.score < options.failUnder;
    track('cli_run_completed', {
      mode: options.mode,
      scorecard_version: result.scorecardVersion,
      score_bucket: bucketScore(result.summary.score),
      page_count_bucket: bucketPageCount(result.pages.length),
      duration_ms_bucket: bucketDurationMs(Date.now() - runStart),
      failed_bucket: bucketIssueCount(result.summary.failed),
      warned_bucket: bucketIssueCount(result.summary.warned),
      errored_bucket: bucketIssueCount(result.summary.errored),
      threshold_breached: thresholdBreached,
    });

    if (options.output === 'json') {
      // JSON output goes to stdout so it can be piped into jq.
      console.log(JSON.stringify(result, null, 2));
    } else if (options.output === 'agent-prompt') {
      // Markdown fix-prompt for a coding agent. De-duplicates failures
      // by check id and links each entry to its docs detail page.
      console.log(runToAgentPrompt(result));
    } else {
      printTextReport(result);
    }

    if (thresholdBreached) {
      console.error(
        chalk.red(`\nScore ${result.summary.score} is below threshold ${options.failUnder}`),
      );
      process.exit(1);
    }
  });

program
  .command('scorecards')
  .description('List every shipped scorecard version and the checks each one pins')
  .option('-o, --output <format>', 'text or json', 'text')
  .action((options) => {
    track('cli_command_invoked', {
      command: 'scorecards',
      output_format: options.output,
    });
    const cards = listScorecards();
    if (options.output === 'json') {
      console.log(JSON.stringify(cards, null, 2));
      return;
    }
    for (const card of cards) {
      const isLatest = card.version === LATEST_SCORECARD;
      console.log(
        chalk.bold(`v${card.version}`) +
          (isLatest ? chalk.gray(' (latest)') : '') +
          chalk.gray(` released ${card.releasedAt}`),
      );
      console.log('  ' + card.description);
      console.log(`  ${Object.keys(card.checks).length} checks pinned`);
      console.log('');
    }
  });

program.addHelpText(
  'after',
  `
Commands in detail:
  check <url>                   Audit a URL or a whole site
    -m, --mode page|site          default: page
    -s, --scorecard <version>     scorecard version
    --max-pages <n>               default: 500
    --concurrency <n>             default: 8
    --page-check-concurrency <n>  default: 4
    --polite-delay <ms>           default: 250
    -o, --output <format>         text | json | agent-prompt
    --fail-under <score>          exit 1 if final score < threshold
    -v, --verbose                 stream progress events to stderr

  scorecards                    List shipped scorecard versions
    -o, --output <format>         text | json

Run 'a14y help <command>' (or 'a14y <command> --help') for full details.
Tip: 'check' is the default — 'a14y <url>' works the same as 'a14y check <url>'.
`,
);

// Default to the `check` subcommand when the first positional is neither a
// known command nor a flag. `a14y example.com` should behave the same as
// `a14y check example.com`.
const KNOWN_COMMANDS = new Set(['check', 'scorecards', 'help']);
const argv = process.argv.slice();
const firstPositional = argv.findIndex((a, i) => i >= 2 && !a.startsWith('-'));
if (firstPositional !== -1 && !KNOWN_COMMANDS.has(argv[firstPositional])) {
  argv.splice(firstPositional, 0, 'check');
}

async function main(): Promise<void> {
  const flagDisabled = argv.includes('--no-telemetry');
  const { runtime } = await initCliTelemetry({ flagDisabled });
  // Stash on the program so subcommand actions can read it for the first-run
  // notice without a module-level singleton.
  (program as unknown as { runtime: typeof runtime }).runtime = runtime;

  try {
    await program.parseAsync(argv);
  } catch (e) {
    track('cli_error', {
      command: 'unknown',
      phase: 'output',
      error_class: errorClassName(e),
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

function printTextReport(run: SiteRun): void {
  console.log('');
  console.log(chalk.bold(`Agent Readability Score: ${run.summary.score}/100`));
  console.log(
    chalk.gray(
      `  scorecard ${run.scorecardVersion} (released ${run.scorecardReleasedAt}) — mode ${run.mode}`,
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
