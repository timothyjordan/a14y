#!/usr/bin/env node
// Generates all user-facing READMEs from docs/templates/ + docs/fragments/.
// The generated files are deterministic — running the script twice produces
// byte-identical output. Use `--check` in CI to fail if a README is stale.
//
// Directives supported in templates:
//
//   <!-- include: fragments/foo.md -->    literal file include (relative to docs/)
//   <!-- cli-help: check -->              runs `a14y help check`, inlines in a fenced text block
//   <!-- cli-help: scorecards -->         same for scorecards
//   <!-- cli-help: root -->               runs `a14y --help` (top-level)
//   {{name}} / {{bin}} / {{label}}        variable substitution (alias template only)

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const DOCS_DIR = join(REPO_ROOT, 'docs');
const CLI_ENTRY = join(REPO_ROOT, 'packages/apps/cli/dist/index.js');

const BANNER =
  '<!-- THIS FILE IS GENERATED. Edit docs/templates/ or docs/fragments/ and run `npm run docs`. -->\n\n';

const CHECK_MODE = process.argv.includes('--check');

function ensureCliBuilt() {
  if (existsSync(CLI_ENTRY)) return;
  const result = spawnSync('npm', ['--workspace', 'a14y', 'run', 'build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('Failed to build a14y CLI before generating READMEs.');
  }
}

function cliHelp(kind) {
  const args =
    kind === 'root'
      ? ['--help']
      : kind === 'check' || kind === 'scorecards'
        ? ['help', kind]
        : null;
  if (!args) throw new Error(`Unknown cli-help kind: ${kind}`);
  const result = spawnSync('node', [CLI_ENTRY, ...args], {
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  if (result.status !== 0) {
    throw new Error(
      `Failed to capture \`a14y ${args.join(' ')}\`: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trimEnd();
}

function resolveIncludes(body) {
  return body.replace(/<!--\s*include:\s*([^\s]+)\s*-->/g, (_m, p) => {
    const abs = join(DOCS_DIR, p);
    return readFileSync(abs, 'utf8').trimEnd();
  });
}

function resolveCliHelp(body) {
  return body.replace(/<!--\s*cli-help:\s*([a-z]+)\s*-->/g, (_m, kind) => {
    return '```text\n' + cliHelp(kind) + '\n```';
  });
}

function substituteVars(body, vars) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => {
    if (!(k in vars)) throw new Error(`Unknown variable {{${k}}} in template`);
    return vars[k];
  });
}

function render(templatePath, vars = {}) {
  const raw = readFileSync(templatePath, 'utf8');
  let body = resolveIncludes(raw);
  body = resolveCliHelp(body);
  body = substituteVars(body, vars);
  return BANNER + body.trimEnd() + '\n';
}

function writeIfChanged(outPath, content) {
  let previous = '';
  if (existsSync(outPath)) previous = readFileSync(outPath, 'utf8');
  if (previous === content) return { path: outPath, changed: false };
  if (CHECK_MODE) return { path: outPath, changed: true };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content);
  return { path: outPath, changed: true };
}

const TARGETS = [
  {
    template: 'root-README.md',
    out: 'README.md',
  },
  {
    template: 'cli-README.md',
    out: 'packages/apps/cli/README.md',
  },
  {
    template: 'core-README.md',
    out: 'packages/core/README.md',
  },
  {
    template: 'alias-README.md',
    out: 'packages/aliases/agentready/README.md',
    vars: { name: 'agentready', bin: 'agentready', label: 'Legacy alias' },
  },
  {
    template: 'alias-README.md',
    out: 'packages/aliases/agentreadability/README.md',
    vars: { name: 'agentreadability', bin: 'agentreadability', label: 'Full-word alias' },
  },
];

function main() {
  ensureCliBuilt();
  const results = TARGETS.map((t) => {
    const rendered = render(join(DOCS_DIR, 'templates', t.template), t.vars || {});
    return writeIfChanged(join(REPO_ROOT, t.out), rendered);
  });

  if (CHECK_MODE) {
    const stale = results.filter((r) => r.changed);
    if (stale.length) {
      console.error('The following generated READMEs are out of date:');
      for (const s of stale) console.error('  ' + s.path);
      console.error("Run 'npm run docs' and commit the result.");
      process.exit(1);
    }
    console.log('All generated READMEs are up to date.');
  } else {
    for (const r of results) {
      console.log((r.changed ? 'wrote  ' : 'skip   ') + r.path);
    }
  }
}

main();
