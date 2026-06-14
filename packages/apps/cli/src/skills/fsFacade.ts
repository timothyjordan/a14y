import { promises as fs } from 'node:fs';

/**
 * Tiny filesystem seam so the orchestrator can run against an in-memory fake in
 * unit tests. `readFile`/`lstat` return null on ENOENT instead of throwing so
 * the caller treats "absent" as a value, not an exception.
 */
export interface FsFacade {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
  lstat(path: string): Promise<{ isSymbolicLink: boolean } | null>;
  /** True when `path` exists and is a directory (used for agent auto-detect). */
  dirExists(path: string): Promise<boolean>;
}

function isEnoent(e: unknown): boolean {
  return (e as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

export const nodeFs: FsFacade = {
  async readFile(p) {
    try {
      return await fs.readFile(p, 'utf8');
    } catch (e) {
      if (isEnoent(e)) return null;
      throw e;
    }
  },
  async writeFile(p, content) {
    await fs.writeFile(p, content, 'utf8');
  },
  async mkdirp(p) {
    await fs.mkdir(p, { recursive: true });
  },
  async lstat(p) {
    try {
      const s = await fs.lstat(p);
      return { isSymbolicLink: s.isSymbolicLink() };
    } catch (e) {
      if (isEnoent(e)) return null;
      throw e;
    }
  },
  async dirExists(p) {
    try {
      const s = await fs.stat(p);
      return s.isDirectory();
    } catch {
      return false;
    }
  },
};
