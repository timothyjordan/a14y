#!/usr/bin/env node
// Local preview server for the built docs site.
//
// Why not `astro preview`? Astro's static preview server hardcodes
// its plugin list and ignores user Vite plugins, so we can't inject
// a middleware that adds `charset=utf-8` to `.md` responses. The
// default `Content-Type: text/markdown` (no charset) makes browsers
// fall back to Latin-1 and renders UTF-8 glyphs (✓, ✗, ✔) as
// mojibake (`âœ"`, etc.). This server emits the right charset for
// every text type while replicating Astro's trailing-slash and
// `404.html` behavior.
//
// Production (GitHub Pages) already serves
// `text/markdown; charset=utf-8`, so this is local-dev only.

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
);
const PORT = Number(process.env.PORT ?? 4321);

const TYPES = new Map(
  Object.entries({
    '.html': 'text/html; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }),
);

export function contentTypeFor(filePath) {
  return TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const resolved = path.resolve(root, '.' + decoded);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

async function tryFile(p) {
  try {
    const s = await fs.stat(p);
    return s.isFile() ? p : null;
  } catch {
    return null;
  }
}

export async function resolveFile(root, urlPath) {
  const cleaned = (urlPath || '/').split(/[?#]/)[0];
  const target = safeJoin(root, cleaned);
  if (!target) return null;
  const direct = await tryFile(target);
  if (direct) return direct;
  if (cleaned.endsWith('/')) {
    const idx = await tryFile(path.join(target, 'index.html'));
    if (idx) return idx;
  }
  const withHtml = await tryFile(target + '.html');
  if (withHtml) return withHtml;
  const dirIdx = await tryFile(path.join(target, 'index.html'));
  if (dirIdx) return dirIdx;
  return null;
}

async function send404(res, root) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const errPage = await tryFile(path.join(root, '404.html'));
  if (errPage) {
    res.end(await fs.readFile(errPage));
  } else {
    res.end('<h1>404 Not Found</h1>');
  }
}

function createPreviewServer(root) {
  return http.createServer(async (req, res) => {
    try {
      const file = await resolveFile(root, req.url ?? '/');
      if (!file) {
        await send404(res, root);
        return;
      }
      res.setHeader('Content-Type', contentTypeFor(file));
      res.setHeader('Cache-Control', 'no-cache');
      res.end(await fs.readFile(file));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(`500 ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

export { createPreviewServer };

// Entry point when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await fs.access(ROOT);
  } catch {
    console.error(
      `[preview] dist directory not found at ${ROOT}. Run \`npm run build --workspace=@a14y/docs\` first.`,
    );
    process.exit(1);
  }
  createPreviewServer(ROOT).listen(PORT, () => {
    console.log(`a14y docs preview ready at http://localhost:${PORT}/`);
  });
}
