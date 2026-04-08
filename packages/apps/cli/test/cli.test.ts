import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { describe, expect, it, beforeAll } from 'vitest';

const exec = promisify(execFile);
const CLI = path.resolve(__dirname, '../dist/index.js');

beforeAll(async () => {
  // Ensure dist/index.js exists. The CLI test is meaningful only after the
  // workspace has been built; in CI this happens via `npm run build` before
  // tests, locally it happens through the same script.
  try {
    await import('node:fs').then((fs) => fs.promises.stat(CLI));
  } catch {
    throw new Error(
      `CLI is not built. Run \`npm run build --workspace agentready\` before running tests.`,
    );
  }
});

describe('agentready CLI', () => {
  it('prints --version', async () => {
    const { stdout } = await exec('node', [CLI, '--version']);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('lists scorecard versions as JSON', async () => {
    const { stdout } = await exec('node', [CLI, 'scorecards', '--output', 'json']);
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

  it('shows help with --mode and --scorecard flags documented', async () => {
    const { stdout } = await exec('node', [CLI, 'check', '--help']);
    expect(stdout).toContain('--mode');
    expect(stdout).toContain('--scorecard');
    expect(stdout).toContain('--max-pages');
    expect(stdout).toContain('--concurrency');
    expect(stdout).toContain('--fail-under');
    // Documents the new agent-prompt output format from TJ-151.
    expect(stdout).toContain('agent-prompt');
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
      ]);
      throw new Error('expected non-zero exit');
    } catch (e) {
      const err = e as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('Invalid --output');
      expect(err.stderr).toContain('agent-prompt');
    }
  });
});
