import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoveryFilesIntegration } from '../src/integrations/discovery-files';

/**
 * Smoke-tests the agent-skills section of the discovery-files
 * integration end-to-end: runs the integration against a temporary
 * publicDir and asserts that the well-known index.json + per-skill
 * SKILL.md mirrors are written with the shapes consumers expect.
 *
 * The Cloudflare Agent Skills Discovery RFC requires the index to
 * carry a `skills` array of entries with a `name`, `description`,
 * and a `url` pointing at the skill content; we assert that shape
 * here so any future regression is caught at unit-test time rather
 * than after deploy.
 */
describe('agent-skills discovery files', () => {
  let tmp: string;
  let publicDir: string;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'a14y-skills-test-'));
    publicDir = path.join(tmp, 'public');
    await fs.mkdir(publicDir, { recursive: true });

    const integration = discoveryFilesIntegration();
    const setupHook = integration.hooks['astro:config:setup']!;
    await (setupHook as (args: unknown) => Promise<void>)({
      config: { publicDir: pathToFileURL(publicDir + '/') },
    });
  });

  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('writes /.well-known/agent-skills/index.json with at least one skill', async () => {
    const indexPath = path.join(publicDir, '.well-known', 'agent-skills', 'index.json');
    const raw = await fs.readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe('1.0');
    expect(Array.isArray(parsed.skills)).toBe(true);
    expect(parsed.skills.length).toBeGreaterThan(0);
    for (const skill of parsed.skills) {
      expect(typeof skill.name).toBe('string');
      expect(typeof skill.description).toBe('string');
      expect(skill.url).toMatch(/^\/\.well-known\/agent-skills\/[^/]+\/SKILL\.md$/);
    }
  });

  it('mirrors each skill at /.well-known/agent-skills/<name>/SKILL.md', async () => {
    const indexRaw = await fs.readFile(
      path.join(publicDir, '.well-known', 'agent-skills', 'index.json'),
      'utf8',
    );
    const { skills } = JSON.parse(indexRaw);
    for (const skill of skills) {
      const mirror = path.join(
        publicDir,
        '.well-known',
        'agent-skills',
        skill.name,
        'SKILL.md',
      );
      const body = await fs.readFile(mirror, 'utf8');
      expect(body.startsWith('---')).toBe(true);
      expect(body).toContain(`name: ${skill.name}`);
    }
  });

  it('includes the a14y skill specifically', async () => {
    const indexRaw = await fs.readFile(
      path.join(publicDir, '.well-known', 'agent-skills', 'index.json'),
      'utf8',
    );
    const { skills } = JSON.parse(indexRaw);
    const a14y = skills.find((s: { name: string }) => s.name === 'a14y');
    expect(a14y).toBeDefined();
    expect(a14y.description).toMatch(/agent readability/i);
    expect(a14y.license).toBe('Apache-2.0');
    expect(a14y.metadata?.homepage).toBe('https://a14y.dev');
  });
});
