import { describe, expect, it } from 'vitest';
import {
  getAllSkills,
  getSkillBody,
  parseFrontmatter,
} from '../src/lib/skills-data';

describe('skills-data', () => {
  describe('parseFrontmatter', () => {
    it('parses required name and description', () => {
      const fm = parseFrontmatter(
        ['---', 'name: my-skill', 'description: Use when X.', '---', 'body'].join('\n'),
        'test.md',
      );
      expect(fm.name).toBe('my-skill');
      expect(fm.description).toBe('Use when X.');
    });

    it('parses optional license, compatibility, allowed-tools', () => {
      const fm = parseFrontmatter(
        [
          '---',
          'name: x',
          'description: Use when.',
          'license: Apache-2.0',
          'compatibility: Requires Node.',
          'allowed-tools: Bash(git:*) Read',
          '---',
        ].join('\n'),
        'test.md',
      );
      expect(fm.license).toBe('Apache-2.0');
      expect(fm.compatibility).toBe('Requires Node.');
      expect(fm.allowedTools).toBe('Bash(git:*) Read');
    });

    it('parses a metadata mapping', () => {
      const fm = parseFrontmatter(
        [
          '---',
          'name: x',
          'description: Use when.',
          'metadata:',
          '  homepage: https://example.com',
          '  source: https://github.com/x/y',
          '---',
        ].join('\n'),
        'test.md',
      );
      expect(fm.metadata).toEqual({
        homepage: 'https://example.com',
        source: 'https://github.com/x/y',
      });
    });

    it('strips quoted values', () => {
      const fm = parseFrontmatter(
        [
          '---',
          'name: x',
          'description: "Use when. Quoted: yes."',
          '---',
        ].join('\n'),
        'test.md',
      );
      expect(fm.description).toBe('Use when. Quoted: yes.');
    });

    it('rejects missing frontmatter', () => {
      expect(() => parseFrontmatter('# Body only', 'test.md')).toThrow(/missing YAML frontmatter/);
    });

    it('rejects missing name', () => {
      expect(() =>
        parseFrontmatter(['---', 'description: x', '---'].join('\n'), 'test.md'),
      ).toThrow(/missing required "name"/);
    });

    it('rejects missing description', () => {
      expect(() =>
        parseFrontmatter(['---', 'name: x', '---'].join('\n'), 'test.md'),
      ).toThrow(/missing required "description"/);
    });

    it('rejects names violating spec', () => {
      const badNames = ['UPPER', '-leading-hyphen', 'trailing-hyphen-', 'double--hyphen'];
      for (const name of badNames) {
        expect(() =>
          parseFrontmatter(
            ['---', `name: ${name}`, 'description: x', '---'].join('\n'),
            'test.md',
          ),
        ).toThrow(/violates agentskills.io spec/);
      }
    });

    it('rejects descriptions over 1024 characters', () => {
      const longDesc = 'a'.repeat(1025);
      expect(() =>
        parseFrontmatter(
          ['---', 'name: x', `description: ${longDesc}`, '---'].join('\n'),
          'test.md',
        ),
      ).toThrow(/spec maximum is 1024/);
    });

    it('ignores unknown top-level keys for forward compat', () => {
      const fm = parseFrontmatter(
        [
          '---',
          'name: x',
          'description: Use when.',
          'future-field: hello',
          '---',
        ].join('\n'),
        'test.md',
      );
      expect(fm.name).toBe('x');
    });
  });

  describe('getAllSkills', () => {
    it('returns the a14y skill from the repo-root skills/ directory', async () => {
      const skills = await getAllSkills();
      const a14y = skills.find((s) => s.name === 'a14y');
      expect(a14y).toBeDefined();
      expect(a14y!.dirName).toBe('a14y');
      expect(a14y!.description.length).toBeGreaterThan(20);
      expect(a14y!.description.length).toBeLessThanOrEqual(1024);
      expect(a14y!.license).toBe('Apache-2.0');
      expect(a14y!.metadata?.homepage).toBe('https://a14y.dev');
    });

    it('sorts entries by directory name', async () => {
      const skills = await getAllSkills();
      const names = skills.map((s) => s.dirName);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });
  });

  describe('getSkillBody', () => {
    it('returns the markdown body without frontmatter', async () => {
      const skills = await getAllSkills();
      const a14y = skills.find((s) => s.name === 'a14y')!;
      const body = await getSkillBody(a14y);
      expect(body).not.toMatch(/^---/);
      expect(body).toMatch(/^# /m);
    });
  });
});
