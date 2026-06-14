import { describe, expect, it, vi } from 'vitest';
import { fetchSkill, SkillFetchError } from '../src/skills/fetch';

function connError(): Error {
  const err = new TypeError('fetch failed');
  (err as { cause?: unknown }).cause = new Error('ENOTFOUND');
  return err;
}

describe('fetchSkill', () => {
  it('returns the body on a 200', async () => {
    const fetchImpl = vi.fn(async () => new Response('---\nname: a14y\n---\nbody', { status: 200 }));
    const body = await fetchSkill({ fetchImpl, url: 'http://x/SKILL.md' });
    expect(body).toContain('name: a14y');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://x/SKILL.md');
  });

  it('throws SkillFetchError mentioning the status on a 404', async () => {
    const fetchImpl = vi.fn(async () => new Response('not found', { status: 404 }));
    await expect(fetchSkill({ fetchImpl, url: 'http://x/SKILL.md' })).rejects.toMatchObject({
      name: 'SkillFetchError',
      message: expect.stringContaining('404'),
    });
  });

  it('wraps a network error and preserves the cause', async () => {
    const cause = connError();
    const fetchImpl = vi.fn(async () => {
      throw cause;
    });
    try {
      await fetchSkill({ fetchImpl, url: 'http://x/SKILL.md' });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SkillFetchError);
      expect((e as SkillFetchError).cause).toBe(cause);
      expect((e as Error).message).toContain('Check your network');
    }
  });

  it('rejects an empty body', async () => {
    const fetchImpl = vi.fn(async () => new Response('   ', { status: 200 }));
    await expect(fetchSkill({ fetchImpl, url: 'http://x/SKILL.md' })).rejects.toBeInstanceOf(
      SkillFetchError,
    );
  });
});
