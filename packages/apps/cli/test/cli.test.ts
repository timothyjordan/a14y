import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import http from 'node:http';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

const exec = promisify(execFile);
const CLI = path.resolve(__dirname, '../dist/index.js');

let xdgRoot: string;

// Run with a sandboxed XDG_CONFIG_HOME and telemetry disabled by default so
// tests don't write to the developer's real ~/.a14y, don't fire any network
// calls, and don't print the first-run notice (which would leak into the
// stderr we assert on for several tests).
function envForCli(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    XDG_CONFIG_HOME: xdgRoot,
    A14Y_TELEMETRY: '0',
    ...extra,
  };
}

beforeAll(async () => {
  try {
    await import('node:fs').then((fs) => fs.promises.stat(CLI));
  } catch {
    throw new Error(
      `CLI is not built. Run \`npm run build --workspace a14y\` before running tests.`,
    );
  }
  xdgRoot = mkdtempSync(path.join(tmpdir(), 'a14y-cli-test-'));
});

afterAll(() => {
  try {
    rmSync(xdgRoot, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

describe('a14y CLI', () => {
  it('prints --version', async () => {
    const { stdout } = await exec('node', [CLI, '--version'], { env: envForCli() });
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('lists scorecard versions as JSON', async () => {
    const { stdout } = await exec('node', [CLI, 'scorecards', '--output', 'json'], { env: envForCli() });
    const cards = JSON.parse(stdout);
    expect(Array.isArray(cards)).toBe(true);
    expect(cards.length).toBeGreaterThan(0);
    const versions = cards.map((c: { version: string }) => c.version);
    expect(versions).toContain('0.2.0');
    // Each card should pin every check id to a string version.
    for (const card of cards) {
      for (const v of Object.values(card.checks)) {
        expect(typeof v).toBe('string');
      }
    }
  });

  it('top-level --help lists every command and its options', async () => {
    // TJ-185: `a14y --help` must surface the flag lists inline and point
    // users at `a14y help <command>` for the full detail view, so that
    // option discoverability doesn't require reading the source or the
    // README.
    const { stdout } = await exec('node', [CLI, '--help'], { env: envForCli() });
    expect(stdout).toContain('Commands in detail');
    expect(stdout).toContain('check <url>');
    expect(stdout).toContain('--max-pages');
    expect(stdout).toContain('--page-check-concurrency');
    expect(stdout).toContain('scorecards');
    expect(stdout).toContain("a14y help <command>");
    // And the tip about the default-command shortcut introduced in TJ-184.
    expect(stdout).toContain("'check' is the default");
  });

  it('shows help with --mode and --scorecard flags documented', async () => {
    const { stdout } = await exec('node', [CLI, 'check', '--help'], { env: envForCli() });
    expect(stdout).toContain('--mode');
    expect(stdout).toContain('--scorecard');
    expect(stdout).toContain('--max-pages');
    expect(stdout).toContain('--concurrency');
    expect(stdout).toContain('--fail-under');
    // Documents the new agent-prompt output format from TJ-151.
    expect(stdout).toContain('agent-prompt');
    // TJ-411: the share block opt-out flag must be discoverable.
    expect(stdout).toContain('--no-share');
  });

  it('treats a bare URL as `check <url>`', async () => {
    // TJ-184: `a14y example.com` should behave like `a14y check example.com`.
    // Use an invalid --output to force a validation error without a network
    // round-trip; the error text is produced by the `check` handler, so its
    // presence proves argv was rewritten to the check path.
    try {
      await exec('node', [CLI, 'https://example.com', '--output', 'yaml'], { env: envForCli() });
      throw new Error('expected non-zero exit');
    } catch (e) {
      const err = e as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('Invalid --output');
    }
  });

  it('leaves `scorecards` untouched when used as the first positional', async () => {
    // TJ-184: the argv rewrite must not prepend `check` to a known command.
    const { stdout } = await exec('node', [CLI, 'scorecards', '--output', 'json'], { env: envForCli() });
    const cards = JSON.parse(stdout);
    expect(Array.isArray(cards)).toBe(true);
  });

  it('still accepts the explicit `check` form', async () => {
    // TJ-184: guard against accidentally inserting a second `check`.
    try {
      await exec('node', [CLI, 'check', 'https://example.com', '--output', 'yaml'], { env: envForCli() });
      throw new Error('expected non-zero exit');
    } catch (e) {
      const err = e as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('Invalid --output');
    }
  });

  it('accepts --no-telemetry as a global option', async () => {
    // Should run a known command end-to-end without complaint when the flag
    // is set. Pair it with `scorecards` so we don't need network access.
    const { stdout } = await exec(
      'node',
      [CLI, '--no-telemetry', 'scorecards', '--output', 'json'],
      { env: envForCli() },
    );
    expect(JSON.parse(stdout)).toBeInstanceOf(Array);
  });

  it('keeps stdout clean for --output json regardless of telemetry first-run state', async () => {
    // The first-run notice writes to stderr only and only on TTYs. exec()
    // pipes stderr/stdout, so neither stream is a TTY here — but this test
    // also guards the explicit json-format suppression. With telemetry set
    // to enabled (A14Y_TELEMETRY unset, provider noop because no keys are
    // injected), stdout should still parse as valid JSON.
    const env = { ...process.env, XDG_CONFIG_HOME: xdgRoot };
    delete env.A14Y_TELEMETRY;
    const { stdout } = await exec('node', [CLI, 'scorecards', '--output', 'json'], { env });
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  it('printTextReport hints at --mode site for single-page reviews (TJ-428)', async () => {
    // page mode is the CLI default. The text report needs to make clear that
    // only one URL was audited and that --mode site exists for a full crawl,
    // otherwise users may mistake a single-page review for a full audit.
    // Asserting against source matches the TJ-425 pattern below — exercising
    // the live code path requires a network round-trip the suite avoids.
    const src = await import('node:fs').then((fs) =>
      fs.promises.readFile(path.resolve(__dirname, '../src/index.ts'), 'utf-8'),
    );
    expect(src).toMatch(/printTextReport[\s\S]*run\.mode === 'page'[\s\S]*--mode site/);
    expect(src).toMatch(/Single-page review/);
  });

  it('printShareBlock wires buildBadgeUrl into the Share output (TJ-425)', async () => {
    // The actual run path requires a network round-trip, so assert against
    // the source — same shape as the share-popover test in the extension.
    const src = await import('node:fs').then((fs) =>
      fs.promises.readFile(path.resolve(__dirname, '../src/index.ts'), 'utf-8'),
    );
    expect(src).toMatch(/import\s*\{[\s\S]*?buildBadgeUrl[\s\S]*?\}\s*from\s*['"]@a14y\/core['"]/);
    // The Share block ends with an "Embed badge: <url>" line.
    expect(src).toMatch(/printShareBlock[\s\S]*?Embed badge[\s\S]*?buildBadgeUrl\(run\)/);
  });

  it('rejects unknown --output values', async () => {
    // Regression for TJ-151: the validator should know about
    // text/json/agent-prompt and reject anything else with a clear
    // message.
    try {
      await exec('node', [
        CLI,
        'check',
        'https://example.com',
        '--output',
        'yaml',
      ], { env: envForCli() });
      throw new Error('expected non-zero exit');
    } catch (e) {
      const err = e as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('Invalid --output');
      expect(err.stderr).toContain('agent-prompt');
    }
  });
});

describe('a14y skill (TJ-822)', () => {
  // Serve the repo's real SKILL.md from a throwaway local server so the spawned
  // binary exercises the full fetch -> write path without touching the public
  // network. A14Y_SKILL_SOURCE_URL points the CLI at this server.
  let server: http.Server;
  let sourceUrl: string;
  let installRoot: string;

  beforeAll(async () => {
    const skillBody = readFileSync(
      path.resolve(__dirname, '../../../../skills/a14y/SKILL.md'),
      'utf8',
    );
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/markdown' });
      res.end(skillBody);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    sourceUrl = `http://127.0.0.1:${port}/SKILL.md`;
    installRoot = mkdtempSync(path.join(tmpdir(), 'a14y-skill-test-'));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      rmSync(installRoot, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  });

  it('lists skill flags in `a14y skill --help`', async () => {
    const { stdout } = await exec('node', [CLI, 'skill', '--help'], { env: envForCli() });
    expect(stdout).toContain('--target');
    expect(stdout).toContain('--link');
    expect(stdout).toContain('--check');
    expect(stdout).toContain('--force');
  });

  it('the `uninstall` form resolves to the same skill command', async () => {
    const { stdout } = await exec('node', [CLI, 'skill', 'uninstall', '--help'], { env: envForCli() });
    expect(stdout).toContain('--target');
    expect(stdout).toContain('Install, update, or uninstall the a14y agent skill');
  });

  it('lists `skill [install|update|uninstall]` in the top-level help', async () => {
    const { stdout } = await exec('node', [CLI, '--help'], { env: envForCli() });
    expect(stdout).toContain('skill [install|update|uninstall]');
  });

  it('does not rewrite `a14y skill` to `a14y check skill`', async () => {
    // If the default-to-check shim mis-fired, this would invoke `check` and the
    // skill-only `--target` flag would be unknown. Seeing the skill help proves
    // `skill` is in KNOWN_COMMANDS.
    const { stdout } = await exec('node', [CLI, 'skill', '--help'], { env: envForCli() });
    expect(stdout).not.toContain('--max-pages');
    expect(stdout).toContain('--target');
  });

  it('installs to an explicit --target and is idempotent', async () => {
    const env = envForCli({ A14Y_SKILL_SOURCE_URL: sourceUrl });
    const skillFile = path.join(installRoot, 'a14y', 'SKILL.md');

    const first = await exec('node', [CLI, 'skill', 'install', '--target', installRoot, '--output', 'json'], { env });
    expect(JSON.parse(first.stdout).summary.created).toBe(1);
    expect(existsSync(skillFile)).toBe(true);

    const second = await exec('node', [CLI, 'skill', '--target', installRoot, '--output', 'json'], { env });
    expect(JSON.parse(second.stdout).summary.unchanged).toBe(1);

    const check = await exec('node', [CLI, 'skill', '--target', installRoot, '--check'], { env });
    expect(check.stdout).toContain('Up to date');
  });

  it('skill install --project installs into the cwd for collaborators', async () => {
    const env = envForCli({ A14Y_SKILL_SOURCE_URL: sourceUrl });
    const proj = mkdtempSync(path.join(tmpdir(), 'a14y-skill-collab-'));
    try {
      const { stdout } = await exec(
        'node',
        [CLI, 'skill', 'install', '--project', '--yes', '--agent', 'claude', '--output', 'json'],
        { env, cwd: proj },
      );
      const summary = JSON.parse(stdout).summary;
      expect(summary.created).toBeGreaterThanOrEqual(1);
      // Claude's project dir + the shared .agents/skills copy.
      expect(existsSync(path.join(proj, '.claude', 'skills', 'a14y', 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(proj, '.agents', 'skills', 'a14y', 'SKILL.md'))).toBe(true);
    } finally {
      rmSync(proj, { recursive: true, force: true });
    }
  });

  it('round-trips install then uninstall for a project-local agent', async () => {
    const env = envForCli({ A14Y_SKILL_SOURCE_URL: sourceUrl });
    const proj = mkdtempSync(path.join(tmpdir(), 'a14y-skill-proj-'));
    const claudeSkill = path.join(proj, '.claude', 'skills', 'a14y', 'SKILL.md');
    try {
      const installed = await exec(
        'node',
        [CLI, 'skill', 'install', '--agent', 'claude', '--local', '--yes', '--output', 'json'],
        { env, cwd: proj },
      );
      expect(JSON.parse(installed.stdout).summary.created).toBe(1);
      expect(existsSync(claudeSkill)).toBe(true);

      const removed = await exec(
        'node',
        [CLI, 'skill', 'uninstall', '--local', '--yes', '--output', 'json'],
        { env, cwd: proj },
      );
      expect(JSON.parse(removed.stdout).summary.removed).toBeGreaterThanOrEqual(1);
      expect(existsSync(claudeSkill)).toBe(false);
    } finally {
      rmSync(proj, { recursive: true, force: true });
    }
  });
});
