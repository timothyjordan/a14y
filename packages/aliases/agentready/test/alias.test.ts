import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const binPath = path.resolve(__dirname, '..', 'bin.js');

describe('agentready alias', () => {
  it('invokes the a14y CLI and prints help', () => {
    const output = execFileSync('node', [binPath, '--help'], {
      encoding: 'utf8',
    });
    expect(output).toContain('a14y');
    expect(output).toContain('check');
  });

  it('reports a semver version', () => {
    const output = execFileSync('node', [binPath, '--version'], {
      encoding: 'utf8',
    }).trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
