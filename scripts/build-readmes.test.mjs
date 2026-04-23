// Tests for scripts/build-readmes.mjs.
//
// Run with: node --test scripts/build-readmes.test.mjs
//
// These tests mutate fragments temporarily and always restore them — if this
// test is killed mid-run, check `git diff docs/` to recover the fragment.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT = join(__dirname, 'build-readmes.mjs');
const ROOT_README = join(REPO_ROOT, 'README.md');
const USAGE_FRAGMENT = join(REPO_ROOT, 'docs/fragments/_usage.md');

function run(...args) {
  return spawnSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
}

test('generator output is deterministic', () => {
  run();
  const first = readFileSync(ROOT_README, 'utf8');
  run();
  const second = readFileSync(ROOT_README, 'utf8');
  assert.equal(first, second, 'running twice should produce byte-identical output');
});

test('--check exits 0 when up to date', () => {
  run();
  const r = run('--check');
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\n${r.stderr}`);
});

test('--check exits non-zero when a fragment has changed without regeneration', () => {
  run();
  const original = readFileSync(USAGE_FRAGMENT, 'utf8');
  try {
    writeFileSync(USAGE_FRAGMENT, original + '\nSENTINEL MUTATION FOR TEST\n');
    const r = run('--check');
    assert.notEqual(r.status, 0, 'expected non-zero exit when fragments are ahead of generated output');
    assert.match(r.stderr, /out of date/);
  } finally {
    writeFileSync(USAGE_FRAGMENT, original);
    // Regenerate so the working tree doesn't stay stale for subsequent runs.
    run();
  }
});
