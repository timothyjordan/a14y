#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const core_1 = require("@agentready/core");
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
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
    .action(async (url, options) => {
    try {
        console.log(chalk_1.default.blue(`Analyzing ${url}...`));
        const result = await (0, core_1.validate)(url, {
            depth: options.depth
        });
        if (options.output === 'json') {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.log(chalk_1.default.bold('\nResults:'));
            console.log(`Agentic Score: ${result.score}/100`);
            console.log('\nChecks:');
            result.checks.forEach(check => {
                const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
                console.log(`${icon} ${check.name}: ${check.message}`);
            });
        }
        if (options.failUnder && result.score < options.failUnder) {
            console.error(chalk_1.default.red('\nScore ' + result.score + ' is under threshold ' + options.failUnder));
            process.exit(1);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('Error validating URL:'), error.message);
        process.exit(1);
    }
});
program.parse();
