// Tests for scripts/inject-telemetry-config.mjs.
//
// Run with: node --test scripts/inject-telemetry-config.test.mjs
//
// Each test writes a temp .env.local at the repo root and removes the
// generated extension config before running, then asserts on the contents
// of the generated file. The cleanup hook restores both to their pre-test
// state so we don't leak fixtures into the working tree.

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT = join(__dirname, 'inject-telemetry-config.mjs');
const ENV_LOCAL = join(REPO_ROOT, '.env.local');
const GENERATED_DIR = join(REPO_ROOT, 'packages/apps/extension/src/generated');
const GENERATED_FILE = join(GENERATED_DIR, 'telemetry-config.ts');

let savedEnvLocal = null;
let savedGenerated = null;

before(() => {
  if (existsSync(ENV_LOCAL)) savedEnvLocal = readFileSync(ENV_LOCAL, 'utf8');
  if (existsSync(GENERATED_FILE))
    savedGenerated = readFileSync(GENERATED_FILE, 'utf8');
});

after(() => {
  if (savedEnvLocal !== null) writeFileSync(ENV_LOCAL, savedEnvLocal);
  else if (existsSync(ENV_LOCAL)) rmSync(ENV_LOCAL);
  if (savedGenerated !== null) {
    mkdirSync(GENERATED_DIR, { recursive: true });
    writeFileSync(GENERATED_FILE, savedGenerated);
  } else if (existsSync(GENERATED_FILE)) {
    rmSync(GENERATED_FILE);
  }
});

function run(env = {}) {
  // Strip the GA4 vars from the inherited env unless the test sets them
  // explicitly, so a developer's shell can't poison the precedence cases.
  const baseEnv = { ...process.env };
  delete baseEnv.GA4_MEASUREMENT_ID;
  delete baseEnv.GA4_MP_API_SECRET;
  return spawnSync('node', [SCRIPT, 'extension'], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    env: { ...baseEnv, ...env },
  });
}

function clean() {
  if (existsSync(ENV_LOCAL)) rmSync(ENV_LOCAL);
  if (existsSync(GENERATED_FILE)) rmSync(GENERATED_FILE);
}

function readGenerated() {
  return readFileSync(GENERATED_FILE, 'utf8');
}

test('reads values from .env.local when no env vars are set', () => {
  clean();
  writeFileSync(
    ENV_LOCAL,
    'GA4_MEASUREMENT_ID=G-FROMFILE\nGA4_MP_API_SECRET=secret-from-file\n',
  );
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  const out = readGenerated();
  assert.match(out, /GA4_MEASUREMENT_ID[^=]*= "G-FROMFILE"/);
  assert.match(out, /GA4_MP_API_SECRET[^=]*= "secret-from-file"/);
});

test('process.env wins over .env.local', () => {
  clean();
  writeFileSync(
    ENV_LOCAL,
    'GA4_MEASUREMENT_ID=G-FROMFILE\nGA4_MP_API_SECRET=secret-from-file\n',
  );
  const r = run({
    GA4_MEASUREMENT_ID: 'G-FROMSHELL',
    GA4_MP_API_SECRET: 'shell-secret',
  });
  assert.equal(r.status, 0, r.stderr);
  const out = readGenerated();
  assert.match(out, /GA4_MEASUREMENT_ID[^=]*= "G-FROMSHELL"/);
  assert.match(out, /GA4_MP_API_SECRET[^=]*= "shell-secret"/);
});

test('emits nulls when neither .env.local nor env vars are present', () => {
  clean();
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  const out = readGenerated();
  assert.match(out, /GA4_MEASUREMENT_ID[^=]*= null/);
  assert.match(out, /GA4_MP_API_SECRET[^=]*= null/);
});

test('skips comments, blank lines, and strips surrounding quotes', () => {
  clean();
  writeFileSync(
    ENV_LOCAL,
    [
      '# top-level comment',
      '',
      'GA4_MEASUREMENT_ID="G-QUOTED"',
      "GA4_MP_API_SECRET='quoted-secret'",
      '# trailing comment',
      '',
    ].join('\n'),
  );
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  const out = readGenerated();
  assert.match(out, /GA4_MEASUREMENT_ID[^=]*= "G-QUOTED"/);
  assert.match(out, /GA4_MP_API_SECRET[^=]*= "quoted-secret"/);
});

test('ignores malformed lines without crashing', () => {
  clean();
  writeFileSync(
    ENV_LOCAL,
    [
      'this line has no equals sign',
      '=missing-key',
      'GA4_MEASUREMENT_ID=G-OK',
    ].join('\n'),
  );
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  const out = readGenerated();
  assert.match(out, /GA4_MEASUREMENT_ID[^=]*= "G-OK"/);
});
