import type { AstroIntegration } from 'astro';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAllScorecards } from '../lib/scorecard-data';

/**
 * Astro integration that emits the five site-level discovery files
 * the a14y scorecard expects:
 *
 *   - llms.txt       (markdown index of every check page)
 *   - robots.txt     (allow-all + Sitemap pointer)
 *   - sitemap.xml    (XML sitemap with <lastmod>)
 *   - sitemap.md     (markdown sitemap with section headings)
 *   - AGENTS.md      (agent skill file with install/usage/config)
 *
 * These are written into `public/` at `astro:config:setup`, BEFORE the
 * dev server starts or the build kicks off, so they exist as static
 * assets in both modes. (Astro 4 does not reliably serve endpoint
 * files like `pages/foo.txt.ts` from the dev server when
 * `output: 'static'` and `trailingSlash: 'always'` are combined, so
 * pure-endpoint approaches drop these in dev.)
 *
 * The five generated files are gitignored to keep them out of source
 * control: they are derived from the scorecard registry every time.
 */
export function discoveryFilesIntegration(): AstroIntegration {
  return {
    name: 'a14y-discovery-files',
    hooks: {
      'astro:config:setup': async ({ config }) => {
        const publicDir = fileURLToPath(config.publicDir);
        const origin = 'https://a14y.dev';
        const sitemapXmlUrl = `${origin}/sitemap.xml`;
        const lastmodIso = new Date().toISOString().slice(0, 10);
        const scorecards = listAllScorecards();

        const staticPaths = [
          '/',
          '/spec/',
          '/glossary/',
          '/privacy/',
          '/scorecards/',
        ];

        const allPaths = [...staticPaths];
        for (const card of scorecards) {
          allPaths.push(`/scorecards/${card.version}/`);
          for (const id of Object.keys(card.checks)) {
            allPaths.push(`/scorecards/${card.version}/checks/${id}/`);
          }
        }

        const xmlEntries = allPaths.map(
          (p) =>
            `  <url>\n    <loc>${escapeXml(`${origin}${p}`)}</loc>\n    <lastmod>${lastmodIso}</lastmod>\n  </url>`,
        );
        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          xmlEntries.join('\n') +
          `\n</urlset>\n`;
        await fs.writeFile(path.join(publicDir, 'sitemap.xml'), xml, 'utf8');

        const llmsLines: string[] = [];
        llmsLines.push('# a14y scorecard documentation');
        llmsLines.push('');
        llmsLines.push(
          'Markdown-first documentation for the agent readability scorecard. Every check page below has a `.md` mirror that agents can fetch directly.',
        );
        llmsLines.push('');
        llmsLines.push(`- [Landing](/index.md)`);
        llmsLines.push(`- [Glossary](/glossary.md)`);
        llmsLines.push(`- [Scorecards index](/scorecards.md)`);
        llmsLines.push('');
        for (const card of scorecards) {
          llmsLines.push(`## Scorecard v${card.version}`);
          llmsLines.push('');
          llmsLines.push(`- [Overview](/scorecards/${card.version}.md)`);
          for (const id of Object.keys(card.checks)) {
            llmsLines.push(`- [${id}](/scorecards/${card.version}/checks/${id}.md)`);
          }
          llmsLines.push('');
        }
        llmsLines.push('---');
        llmsLines.push(`Full sitemap: [/sitemap.md](/sitemap.md)`);
        await fs.writeFile(path.join(publicDir, 'llms.txt'), llmsLines.join('\n'), 'utf8');

        await fs.writeFile(
          path.join(publicDir, 'robots.txt'),
          [
            'User-agent: *',
            'Allow: /',
            '',
            `Sitemap: ${sitemapXmlUrl}`,
            '',
          ].join('\n'),
          'utf8',
        );

        const groups = new Map<string, string[]>();
        for (const url of allPaths) {
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
        smdLines.push(
          'Every page on the a14y scorecard documentation site, with `.md` mirror links agents can ingest directly.',
        );
        smdLines.push('');
        for (const [group, urls] of groups) {
          smdLines.push(`## ${humanize(group)}`);
          smdLines.push('');
          for (const u of urls.sort()) {
            const cleanPath = u.replace(/\/$/, '') || '/index';
            const mdHref = cleanPath === '/index' ? '/index.md' : `${cleanPath}.md`;
            smdLines.push(`- [${u}](${mdHref})`);
          }
          smdLines.push('');
        }
        await fs.writeFile(path.join(publicDir, 'sitemap.md'), smdLines.join('\n'), 'utf8');

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
          '- `--mode page|site`: single page (default) or full crawl.',
          '- `--scorecard <version>`: pin to a historical scorecard for trend stability.',
          '- `--max-pages <n>`: cap site mode at N pages (default 500).',
          '- `--concurrency <n>`: parallel page fetches (default 8).',
          '- `--page-check-concurrency <n>`: parallel page-check evaluations (default 4).',
          '- `--polite-delay <ms>`: minimum delay between request starts (default 250).',
          '- `--fail-under <score>`: exit non-zero if the score drops below a threshold.',
          '',
          '## Reference',
          '',
          'Full per-check documentation lives at https://a14y.dev/. Source: https://github.com/timothyjordan/a14y.',
          '',
        ].join('\n');
        await fs.writeFile(path.join(publicDir, 'AGENTS.md'), agentsMd, 'utf8');
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
