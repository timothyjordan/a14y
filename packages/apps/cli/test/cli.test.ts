import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
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
