#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cliEntry = resolve(here, '..', '..', 'cli', 'dist', 'index.js');
const fixturePath = resolve(here, '..', 'src', 'data', 'press-cli-output.txt');
const target = process.env.PRESS_CLI_TARGET || 'https://a14y.dev';

const result = spawnSync(
  process.execPath,
  [cliEntry, target, '--no-share', '--no-telemetry'],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
);

if (result.error) {
  console.error('CLI run failed:', result.error.message);
  process.exit(1);
}

// Strip ANSI color codes so the rendered terminal stays themable from CSS.
const ansi = /\x1B\[[0-9;]*[A-Za-z]/g;
const clean = (result.stdout + result.stderr).replace(ansi, '');

writeFileSync(fixturePath, clean, 'utf8');
console.log(`Wrote ${fixturePath} (${clean.length} bytes, target ${target})`);
