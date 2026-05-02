import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contentTypeFor, resolveFile } from '../scripts/preview.mjs';

describe('preview.mjs contentTypeFor', () => {
  it('emits text/markdown; charset=utf-8 for .md', () => {
    expect(contentTypeFor('/dist/index.md')).toBe(
      'text/markdown; charset=utf-8',
    );
  });

  it('emits text/html; charset=utf-8 for .html', () => {
    expect(contentTypeFor('/dist/index.html')).toBe(
      'text/html; charset=utf-8',
    );
  });

  it('emits charset for css and js', () => {
    expect(contentTypeFor('/dist/style.css')).toBe('text/css; charset=utf-8');
    expect(contentTypeFor('/dist/app.js')).toBe(
      'application/javascript; charset=utf-8',
    );
  });

  it('falls back to application/octet-stream for unknown extensions', () => {
    expect(contentTypeFor('/dist/data.bin')).toBe('application/octet-stream');
  });

  it('lowercases the extension', () => {
    expect(contentTypeFor('/dist/INDEX.MD')).toBe(
      'text/markdown; charset=utf-8',
    );
  });
});

describe('preview.mjs resolveFile', () => {
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'a14y-preview-'));
    await fs.writeFile(path.join(root, 'index.html'), '<root/>');
    await fs.writeFile(path.join(root, 'index.md'), '# md');
    await fs.mkdir(path.join(root, 'spec'), { recursive: true });
    await fs.writeFile(path.join(root, 'spec', 'index.html'), '<spec/>');
    await fs.writeFile(path.join(root, 'spec.md'), '# spec md');
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('serves /index.md as the literal file', async () => {
    expect(await resolveFile(root, '/index.md')).toBe(
      path.join(root, 'index.md'),
    );
  });

  it('serves /spec.md as the literal file (mirror at root)', async () => {
    expect(await resolveFile(root, '/spec.md')).toBe(
      path.join(root, 'spec.md'),
    );
  });

  it('serves /spec/ as spec/index.html (Astro trailing-slash convention)', async () => {
    expect(await resolveFile(root, '/spec/')).toBe(
      path.join(root, 'spec', 'index.html'),
    );
  });

  it('serves / as index.html', async () => {
    expect(await resolveFile(root, '/')).toBe(path.join(root, 'index.html'));
  });

  it('returns null for paths that try to escape dist', async () => {
    expect(await resolveFile(root, '/../etc/passwd')).toBeNull();
  });

  it('returns null for paths that have no matching file', async () => {
    expect(await resolveFile(root, '/missing.md')).toBeNull();
  });

  it('strips query strings before resolution', async () => {
    expect(await resolveFile(root, '/index.md?foo=bar')).toBe(
      path.join(root, 'index.md'),
    );
  });
});
