import { describe, expect, it } from 'vitest';
import { makeSiteCtx } from './_helpers';
import type { SiteCheckSpec } from '../src/scorecard/types';

import {
  llmsTxtExists,
  llmsTxtContentType,
  llmsTxtNonEmpty,
  llmsTxtMdExtensions,
} from '../src/checks/site/llmsTxt';
import {
  robotsTxtExists,
  robotsTxtAllowsAiBots,
  robotsTxtAllowsLlmsTxt,
} from '../src/checks/site/robotsTxt';
import {
  sitemapXmlExists,
  sitemapXmlValid,
  sitemapXmlHasLastmod,
} from '../src/checks/site/sitemapXml';
import { sitemapMdExists, sitemapMdHasStructure } from '../src/checks/site/sitemapMd';
import { agentsMdExists, agentsMdHasMinSections } from '../src/checks/site/agentsMd';

const BASE = 'https://example.com';

function run(spec: SiteCheckSpec, ctx: ReturnType<typeof makeSiteCtx>) {
  return spec.implementations['1.0.0'].run(ctx);
}

describe('site/llmsTxt', () => {
  const llmsBody =
    '# Docs\n[Intro](https://example.com/intro.md)\n[API](https://example.com/api.mdx)\n';

  it('passes when llms.txt is reachable with text/plain', async () => {
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/llms.txt': {
        body: llmsBody,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      },
    });
    expect((await run(llmsTxtExists, ctx)).status).toBe('pass');
    expect((await run(llmsTxtContentType, ctx)).status).toBe('pass');
    expect((await run(llmsTxtNonEmpty, ctx)).status).toBe('pass');
    expect((await run(llmsTxtMdExtensions, ctx)).status).toBe('pass');
  });

  it('falls back to llms-full.txt when llms.txt is missing', async () => {
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/llms-full.txt': {
        body: llmsBody,
        headers: { 'content-type': 'text/plain' },
      },
    });
    const r = await run(llmsTxtExists, ctx);
    expect(r.status).toBe('pass');
    expect(r.message).toContain('llms-full.txt');
  });

  it('fails when llms.txt is missing entirely', async () => {
    const ctx = makeSiteCtx(BASE, {});
    expect((await run(llmsTxtExists, ctx)).status).toBe('fail');
    // Dependent checks return na rather than dragging the score down twice.
    expect((await run(llmsTxtContentType, ctx)).status).toBe('na');
    expect((await run(llmsTxtNonEmpty, ctx)).status).toBe('na');
    expect((await run(llmsTxtMdExtensions, ctx)).status).toBe('na');
  });

  it('warns when llms.txt is served with the wrong content type', async () => {
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/llms.txt': {
        body: llmsBody,
        headers: { 'content-type': 'application/octet-stream' },
      },
    });
    expect((await run(llmsTxtContentType, ctx)).status).toBe('warn');
  });

  it('fails md-extensions when links point at .html', async () => {
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/llms.txt': {
        body: '[Bad](https://example.com/page.html)\n',
        headers: { 'content-type': 'text/plain' },
      },
    });
    expect((await run(llmsTxtMdExtensions, ctx)).status).toBe('fail');
  });
});

describe('site/robotsTxt', () => {
  it('passes when robots.txt is missing (implicit allow)', async () => {
    const ctx = makeSiteCtx(BASE, {});
    expect((await run(robotsTxtExists, ctx)).status).toBe('fail');
    expect((await run(robotsTxtAllowsAiBots, ctx)).status).toBe('pass');
    expect((await run(robotsTxtAllowsLlmsTxt, ctx)).status).toBe('pass');
  });

  it('fails allows-ai-bots when robots.txt disallows ClaudeBot', async () => {
    const robots = `User-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n`;
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/robots.txt': { body: robots },
    });
    expect((await run(robotsTxtExists, ctx)).status).toBe('pass');
    const r = await run(robotsTxtAllowsAiBots, ctx);
    expect(r.status).toBe('fail');
    expect(r.message).toContain('ClaudeBot');
  });

  it('fails allows-llms-txt when robots.txt disallows /llms.txt', async () => {
    const robots = `User-agent: *\nDisallow: /llms.txt\n`;
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/robots.txt': { body: robots },
    });
    expect((await run(robotsTxtAllowsLlmsTxt, ctx)).status).toBe('fail');
  });
});

describe('site/sitemapXml', () => {
  const urlset = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://example.com/a</loc><lastmod>2026-01-01</lastmod></url>
    <url><loc>https://example.com/b</loc><lastmod>2026-01-02</lastmod></url>
  </urlset>`;

  it('passes for a valid urlset with lastmod', async () => {
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/sitemap.xml': { body: urlset },
    });
    expect((await run(sitemapXmlExists, ctx)).status).toBe('pass');
    expect((await run(sitemapXmlValid, ctx)).status).toBe('pass');
    expect((await run(sitemapXmlHasLastmod, ctx)).status).toBe('pass');
  });

  it('fails when sitemap is missing', async () => {
    const ctx = makeSiteCtx(BASE, {});
    expect((await run(sitemapXmlExists, ctx)).status).toBe('fail');
    expect((await run(sitemapXmlValid, ctx)).status).toBe('na');
  });

  it('fails has-lastmod when entries omit lastmod', async () => {
    const noLastmod = `<?xml version="1.0"?><urlset>
      <url><loc>https://example.com/a</loc></url>
    </urlset>`;
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/sitemap.xml': { body: noLastmod },
    });
    expect((await run(sitemapXmlHasLastmod, ctx)).status).toBe('fail');
  });
});

describe('site/sitemapMd', () => {
  it('passes for a sitemap.md with headings and links', async () => {
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/sitemap.md': {
        body: '# Site\n\n## Docs\n- [intro](/intro.md)\n',
      },
    });
    expect((await run(sitemapMdExists, ctx)).status).toBe('pass');
    expect((await run(sitemapMdHasStructure, ctx)).status).toBe('pass');
  });

  it('fails has-structure when sitemap.md is missing headings', async () => {
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/sitemap.md': { body: 'just text, no markup' },
    });
    expect((await run(sitemapMdHasStructure, ctx)).status).toBe('fail');
  });
});

describe('site/agentsMd', () => {
  const body = `# Project\n## Installation\nrun \`npm install\`\n## Usage\nimport it.\n`;

  it('passes when AGENTS.md exists with install + usage sections', async () => {
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/AGENTS.md': { body },
    });
    expect((await run(agentsMdExists, ctx)).status).toBe('pass');
    expect((await run(agentsMdHasMinSections, ctx)).status).toBe('pass');
  });

  it('falls back to .cursorrules', async () => {
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/.cursorrules': { body },
    });
    expect((await run(agentsMdExists, ctx)).status).toBe('pass');
  });

  it('fails has-min-sections when only one section is present', async () => {
    const oneSection = `# Project\n## Installation\nrun foo\n`;
    const ctx = makeSiteCtx(BASE, {
      'https://example.com/AGENTS.md': { body: oneSection },
    });
    expect((await run(agentsMdHasMinSections, ctx)).status).toBe('fail');
  });
});
