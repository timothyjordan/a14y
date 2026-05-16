#!/usr/bin/env node
// Removes the agent-readability artifacts that the
// `discovery-files` integration writes into `public/` during a
// regular build (llms.txt, AGENTS.md, robots.txt, sitemap.md,
// sitemap.xml, .well-known/). The baseline build (`A14Y_BASELINE=1`)
// disables that integration, but if a regular build ran first, the
// files persist in public/ and Astro would copy them into
// dist-baseline/. This script wipes them so the baseline build is a
// true control fixture — no agent-only files in its output.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '..', 'public');

const files = ['llms.txt', 'AGENTS.md', 'robots.txt', 'sitemap.md', 'sitemap.xml'];
const dirs = ['.well-known'];

await Promise.all(
  files.map((f) =>
    fs.rm(path.join(publicDir, f), { force: true }).catch(() => {}),
  ),
);
await Promise.all(
  dirs.map((d) =>
    fs.rm(path.join(publicDir, d), { recursive: true, force: true }).catch(() => {}),
  ),
);
console.log('[clean-baseline-public] removed agent-readability artifacts from public/');
