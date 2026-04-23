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
import chalk from 'chalk';
import ora, { type Ora } from 'ora';

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
  .description('Agent readability scorer for documentation sites')
  .version('0.2.0');

program
  .command('check <url>')
  .description('Audit a URL or whole site against the agent readability scorecard')
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
  .action(async (url: string, options) => {
    if (options.mode !== 'page' && options.mode !== 'site') {
      console.error(chalk.red(`Invalid --mode "${options.mode}", expected "page" or "site"`));
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
      process.exit(2);
    }

    const useSpinner = options.output === 'text' && !options.verbose && process.stderr.isTTY;
    const spinner: Ora | null = useSpinner ? ora({ text: `Auditing ${url}…`, stream: process.stderr }).start() : null;

    const onProgress = (event: ProgressEvent) => {
      if (spinner) {
        if (event.type === 'page-discovered') spinner.text = `Visited ${event.visited}: ${event.url}`;
        else if (event.type === 'site-check-done') spinner.text = `Site check: ${event.result.id}`;
        else if (event.type === 'finished') spinner.text = `Done — score ${event.summary.score}`;
      } else if (options.verbose) {
        process.stderr.write(chalk.gray(`[${event.type}] ${describeEvent(event)}\n`));
      }
    };

    let result: SiteRun;
    try {
      result = await validate({
        url,
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
      process.exit(1);
    }

    if (spinner) spinner.succeed(`Score: ${result.summary.score}/100`);

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

    if (typeof options.failUnder === 'number' && result.summary.score < options.failUnder) {
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

program.parseAsync().catch((e) => {
  console.error(chalk.red('Fatal:'), (e as Error).message);
  process.exit(1);
});

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
    case 'finished':
      return `score ${event.summary.score}`;
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
