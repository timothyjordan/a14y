#!/usr/bin/env node

import { Command } from 'commander';
import { validate } from '@agentready/core';
import chalk from 'chalk';
import ora from 'ora';

const program = new Command();

program
  .name('agentready')
  .description('Agentic Docs Validator CLI')
  .version('0.1.0');

program
  .command('check <url>')
  .description('Validate a documentation site for AI readiness')
  .option('-d, --depth <number>', 'Crawl depth', parseInt)
  .option('-o, --output <format>', 'Output format (json, text, table)', 'text')
  .option('--fail-under <score>', 'Exit with code 1 if score is below threshold', parseInt)
  .option('-v, --verbose', 'Show detailed progress logs')
  .action(async (url, options) => {
    try {
      const spinner = options.verbose || options.output === 'json' ? null : ora(`Analyzing ${url}...`).start();
      
      if (options.verbose && options.output !== 'json') {
          console.log(chalk.blue(`Analyzing ${url}...`));
      }

      const result = await validate(url, {
        depth: options.depth,
        onProgress: (msg) => {
            if (spinner) {
                spinner.text = msg;
            } else if (options.verbose && options.output !== 'json') {
                console.log(chalk.gray(`[Progress] ${msg}`));
            }
        }
      });

      if (spinner) spinner.succeed('Analysis complete');

      if (options.output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.bold('\nResults:'));
        console.log(`Agentic Score: ${result.score}/100`);
        
        console.log('\nChecks:');
        result.checks.forEach(check => {
          const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
          console.log(`${icon} ${check.name}: ${check.message}`);
        });
      }

      if (options.failUnder && result.score < options.failUnder) {
          console.error(chalk.red('\nScore ' + result.score + ' is under threshold ' + options.failUnder));
          process.exit(1);
      }

    } catch (error: any) {
      console.error(chalk.red('Error validating URL:'), error.message);
      process.exit(1);
    }
  });

program.parse();
