#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cliEntry = resolve(here, '..', '..', 'cli', 'dist', 'index.js');
const fixturePath = resolve(here, '..', 'src', 'data', 'press-cli-output.txt');
const target = process.env.PRESS_CLI_TARGET || 'https://a14y.dev';

// FORCE_COLOR makes the CLI emit ANSI even though stdout is not a TTY.
// The fixture stays as the raw terminal output (ANSI codes intact); the
// TerminalWindow component parses those codes into themed <span>s at
// build time, so what ships in HTML matches what a real terminal renders.
const env = { ...process.env, FORCE_COLOR: '1' };

const result = spawnSync(
  process.execPath,
  [cliEntry, target, '--no-share', '--no-telemetry'],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env },
);

if (result.error) {
  console.error('CLI run failed:', result.error.message);
  process.exit(1);
}

writeFileSync(fixturePath, result.stdout + result.stderr, 'utf8');
console.log(`Wrote ${fixturePath} (${result.stdout.length} bytes, target ${target})`);
