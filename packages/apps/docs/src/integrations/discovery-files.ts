import type { AstroIntegration } from 'astro';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAllScorecards } from '../lib/scorecard-data';

/**
 * Astro integration that emits the five site-level discovery files
 * the a14y scorecard expects:
 *
 * - `llms.txt` — markdown index of every check page, grouped by
 *   scorecard version. Each link is a `.md` URL so the
 *   `llms-txt.md-extensions` check passes too.
 * - `robots.txt` — allow-all rules with a Sitemap pointer.
 * - `sitemap.xml` — standard XML sitemap with `<lastmod>` on every
 *   `<url>`. Hand-rolled rather than via `@astrojs/sitemap` because
 *   that integration's `astro:build:done` hook crashes on the
 *   shape of pages we generate (a known interop issue with the
 *   trailingSlash + content-collection routes combo).
 * - `sitemap.md` — markdown sitemap with section headings and
 *   bullet lists, mirroring the structure of sitemap.xml.
 * - `AGENTS.md` — agent skill file with Installation + Usage +
 *   Configuration sections to satisfy `agents-md.has-min-sections`.
 *
 * All files land at the docs-site root in `dist/`, which GitHub
 * Pages then serves at `https://a14y.dev/<file>` via the CNAME in
 * public/. The a14y site-level loaders discover these at the site
 * root — no subpath fallback needed now that the docs run on their
 * own apex domain.
 */
export function discoveryFilesIntegration(): AstroIntegration {
  return {
    name: 'a14y-discovery-files',
    hooks: {
      'astro:build:done': async ({ dir, pages }) => {
        const distDir = fileURLToPath(dir);
        const origin = 'https://a14y.dev';
        const base = '';
        const sitemapXmlUrl = `${origin}/sitemap.xml`;
        const lastmodIso = new Date().toISOString().slice(0, 10);

        // ---- sitemap.xml ---------------------------------------------
        const xmlEntries: string[] = [];
        for (const p of pages) {
          const clean = p.pathname.replace(/\/$/, '');
          const loc = `${origin}${base}${clean === '' ? '/' : `/${clean}/`}`;
          xmlEntries.push(
            `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmodIso}</lastmod>\n  </url>`,
          );
        }
        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          xmlEntries.join('\n') +
          `\n</urlset>\n`;
        await fs.writeFile(path.join(distDir, 'sitemap.xml'), xml, 'utf8');

        // ---- llms.txt -------------------------------------------------
        const scorecards = listAllScorecards();
        const llmsLines: string[] = [];
        llmsLines.push('# a14y scorecard documentation');
        llmsLines.push('');
        llmsLines.push(
          'Markdown-first documentation for the agent readability scorecard. Every check page below has a `.md` mirror that agents can fetch directly.',
        );
        llmsLines.push('');
        llmsLines.push(`- [Landing](${base}/index.md)`);
        llmsLines.push(`- [Glossary](${base}/glossary.md)`);
        llmsLines.push(`- [Scorecards index](${base}/scorecards.md)`);
        llmsLines.push('');
        for (const card of scorecards) {
          llmsLines.push(`## Scorecard v${card.version}`);
          llmsLines.push('');
          llmsLines.push(`- [Overview](${base}/scorecards/${card.version}.md)`);
          for (const id of Object.keys(card.checks)) {
            llmsLines.push(
              `- [${id}](${base}/scorecards/${card.version}/checks/${id}.md)`,
            );
          }
          llmsLines.push('');
        }
        llmsLines.push('---');
        llmsLines.push(`Full sitemap: [${base}/sitemap.md](${base}/sitemap.md)`);
        await fs.writeFile(path.join(distDir, 'llms.txt'), llmsLines.join('\n'), 'utf8');

        // ---- robots.txt -----------------------------------------------
        // Allow all (including AI bots), point at the sitemap.
        await fs.writeFile(
          path.join(distDir, 'robots.txt'),
          [
            'User-agent: *',
            'Allow: /',
            '',
            `Sitemap: ${sitemapXmlUrl}`,
            '',
          ].join('\n'),
          'utf8',
        );

        // ---- sitemap.md ----------------------------------------------
        // Walk the same Astro page list the markdown-mirrors integration
        // walks, group by top-level path segment after `base`.
        const groups = new Map<string, string[]>();
        const pageList = pages.map((p) => {
          const clean = p.pathname.replace(/\/$/, '');
          return clean === '' ? '/' : `/${clean}/`;
        });
        for (const url of pageList) {
          const segments = url.split('/').filter(Boolean);
          const top = segments[0] ?? 'Landing';
          let bucket = groups.get(top);
          if (!bucket) {
            bucket = [];
            groups.set(top, bucket);
          }
          bucket.push(url);
        }
        const smdLines: string[] = [];
        smdLines.push('# a14y docs sitemap');
        smdLines.push('');
        smdLines.push('Every page on the a14y scorecard documentation site, with `.md` mirror links agents can ingest directly.');
        smdLines.push('');
        for (const [group, urls] of groups) {
          smdLines.push(`## ${humanize(group)}`);
          smdLines.push('');
          for (const u of urls.sort()) {
            const cleanPath = u.replace(/\/$/, '') || '/index';
            const mdHref = `${base}${cleanPath === '/index' ? '/index.md' : `${cleanPath}.md`}`;
            smdLines.push(`- [${u}](${mdHref})`);
          }
          smdLines.push('');
        }
        await fs.writeFile(path.join(distDir, 'sitemap.md'), smdLines.join('\n'), 'utf8');

        // ---- AGENTS.md ------------------------------------------------
        // Hand-authored skill file with the three required heading
        // families (install / usage / config) to satisfy
        // `agents-md.has-min-sections`.
        const agentsMd = [
          '# a14y',
          '',
          'Score how well a documentation site can be consumed by AI agents. Two interchangeable surfaces back the same scorecard engine: a Node CLI and a Chrome extension.',
          '',
          '## Installation',
          '',
          '```sh',
          'npm install -g a14y',
          '```',
          '',
          'Or load the Chrome extension unpacked from the latest release.',
          '',
          '## Usage',
          '',
          '```sh',
          '# Single page',
          'a14y check https://example.com/',
          '',
          '# Whole site',
          'a14y check https://example.com/ --mode site --max-pages 200',
          '',
          '# JSON for scripting',
          'a14y check https://example.com/ --output json | jq .summary',
          '```',
          '',
          'See `a14y check --help` for the full flag list.',
          '',
          '## Configuration',
          '',
          'All knobs are CLI flags or extension options. The most common:',
          '',
          '- `--mode page|site` — single page (default) or full crawl.',
          '- `--scorecard <version>` — pin to a historical scorecard for trend stability.',
          '- `--max-pages <n>` — cap site mode at N pages (default 500).',
          '- `--concurrency <n>` — parallel page fetches (default 8).',
          '- `--page-check-concurrency <n>` — parallel page-check evaluations (default 4).',
          '- `--polite-delay <ms>` — minimum delay between request starts (default 250).',
          '- `--fail-under <score>` — exit non-zero if the score drops below a threshold.',
          '',
          '## Reference',
          '',
          'Full per-check documentation lives at https://a14y.dev/. Source: https://github.com/timothyjordan/a14y.',
          '',
        ].join('\n');
        await fs.writeFile(path.join(distDir, 'AGENTS.md'), agentsMd, 'utf8');
      },
    },
  };
}

function humanize(segment: string): string {
  if (segment === 'Landing') return 'Landing';
  return segment.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
