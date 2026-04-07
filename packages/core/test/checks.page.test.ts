import { describe, expect, it } from 'vitest';
import { makePageCtx } from './_helpers';
import type { PageCheckSpec } from '../src/scorecard/types';

import {
  httpStatus200,
  httpRedirectChain,
  httpContentTypeHtml,
  httpNoNoindexNoai,
} from '../src/checks/page/http';
import {
  htmlCanonicalLink,
  htmlMetaDescription,
  htmlOgTitle,
  htmlOgDescription,
  htmlLangAttribute,
} from '../src/checks/page/meta';
import {
  htmlJsonLd,
  htmlJsonLdDateModified,
  htmlJsonLdBreadcrumb,
} from '../src/checks/page/jsonLd';
import {
  htmlHeadings,
  htmlTextRatio,
  htmlGlossaryLink,
} from '../src/checks/page/structure';
import {
  markdownMirrorSuffix,
  markdownAlternateLink,
  markdownFrontmatter,
  markdownCanonicalHeader,
  markdownContentNegotiation,
  markdownSitemapSection,
} from '../src/checks/page/markdown';
import { codeLanguageTags } from '../src/checks/page/code';
import { apiSchemaLink } from '../src/checks/page/api';
import { discoveryIndexed, DISCOVERY_INDEXED_KEY } from '../src/checks/page/discovery';

const BASE = 'https://example.com';

function run(spec: PageCheckSpec, ctx: ReturnType<typeof makePageCtx>) {
  return spec.implementations['1.0.0'].run(ctx);
}

const RICH_HTML = `<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://example.com/page">
    <link rel="alternate" type="text/markdown" href="/page.md">
    <meta name="description" content="A reasonably long description that is well over the fifty character minimum.">
    <meta property="og:title" content="Page Title">
    <meta property="og:description" content="OG description content here.">
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "dateModified": "2026-04-01",
        "@graph": [
          { "@type": "BreadcrumbList", "itemListElement": [] }
        ]
      }
    </script>
  </head>
  <body>
    <h1>Heading One</h1>
    <h2>Heading Two</h2>
    <h3>Heading Three</h3>
    <p>${'Lorem ipsum '.repeat(20)}</p>
    <p>See the <a href="/glossary">Glossary</a>.</p>
    <pre><code class="language-ts">const x = 1;</code></pre>
  </body>
</html>`;

describe('page/http', () => {
  it('passes for a clean 200 with text/html and no x-robots blocks', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/page', RICH_HTML);
    expect((await run(httpStatus200, ctx)).status).toBe('pass');
    expect((await run(httpRedirectChain, ctx)).status).toBe('pass');
    expect((await run(httpContentTypeHtml, ctx)).status).toBe('pass');
    expect((await run(httpNoNoindexNoai, ctx)).status).toBe('pass');
  });

  it('fails redirect-chain when there are 2+ hops', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/page', RICH_HTML);
    ctx.page.redirectChain = ['a', 'b'];
    expect((await run(httpRedirectChain, ctx)).status).toBe('fail');
  });

  it('fails no-noindex-noai when x-robots-tag includes noai', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/page', RICH_HTML, {
      'x-robots-tag': 'noindex, noai',
    });
    expect((await run(httpNoNoindexNoai, ctx)).status).toBe('fail');
  });
});

describe('page/meta', () => {
  it('passes all meta checks for a fully-tagged page', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/page', RICH_HTML);
    expect((await run(htmlCanonicalLink, ctx)).status).toBe('pass');
    expect((await run(htmlMetaDescription, ctx)).status).toBe('pass');
    expect((await run(htmlOgTitle, ctx)).status).toBe('pass');
    expect((await run(htmlOgDescription, ctx)).status).toBe('pass');
    expect((await run(htmlLangAttribute, ctx)).status).toBe('pass');
  });

  it('fails meta-description when shorter than 50 chars', async () => {
    const html = `<html lang="en"><head><meta name="description" content="too short"></head></html>`;
    const ctx = makePageCtx(BASE, 'https://example.com/p', html);
    expect((await run(htmlMetaDescription, ctx)).status).toBe('fail');
  });

  it('fails canonical when missing', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/p', '<html lang="en"></html>');
    expect((await run(htmlCanonicalLink, ctx)).status).toBe('fail');
  });
});

describe('page/jsonLd', () => {
  it('passes all three jsonLd checks for a rich page', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/page', RICH_HTML);
    expect((await run(htmlJsonLd, ctx)).status).toBe('pass');
    expect((await run(htmlJsonLdDateModified, ctx)).status).toBe('pass');
    expect((await run(htmlJsonLdBreadcrumb, ctx)).status).toBe('pass');
  });

  it('returns na for jsonLd descendants when no JSON-LD blocks exist', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/p', '<html lang="en"></html>');
    expect((await run(htmlJsonLd, ctx)).status).toBe('fail');
    expect((await run(htmlJsonLdDateModified, ctx)).status).toBe('na');
    expect((await run(htmlJsonLdBreadcrumb, ctx)).status).toBe('na');
  });
});

describe('page/structure', () => {
  it('passes structural checks for a content-rich page', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/page', RICH_HTML);
    expect((await run(htmlHeadings, ctx)).status).toBe('pass');
    expect((await run(htmlTextRatio, ctx)).status).toBe('pass');
    expect((await run(htmlGlossaryLink, ctx)).status).toBe('pass');
  });

  it('fails headings when fewer than 3 are present', async () => {
    const html = `<html lang="en"><body><h1>only one</h1></body></html>`;
    const ctx = makePageCtx(BASE, 'https://example.com/p', html);
    expect((await run(htmlHeadings, ctx)).status).toBe('fail');
  });
});

describe('page/markdown', () => {
  const mdBody =
    '---\ntitle: Page\ndescription: A page\ndoc_version: 1.0\nlast_updated: 2026-04-01\n---\n\n# Page\n\n## Sitemap\n\n[Index](/sitemap.md)\n';

  it('passes mirror-related checks when /page.md exists with the right headers and body', async () => {
    const ctx = makePageCtx(
      BASE,
      'https://example.com/page',
      RICH_HTML,
      {},
      {
        'https://example.com/page.md': {
          body: mdBody,
          headers: {
            'content-type': 'text/markdown; charset=utf-8',
            link: '<https://example.com/page>; rel="canonical"',
          },
        },
      },
    );
    expect((await run(markdownMirrorSuffix, ctx)).status).toBe('pass');
    expect((await run(markdownAlternateLink, ctx)).status).toBe('pass');
    expect((await run(markdownFrontmatter, ctx)).status).toBe('pass');
    expect((await run(markdownCanonicalHeader, ctx)).status).toBe('pass');
    expect((await run(markdownSitemapSection, ctx)).status).toBe('pass');
  });

  it('passes content negotiation when server honours Accept: text/markdown', async () => {
    const ctx = makePageCtx(
      BASE,
      'https://example.com/page',
      RICH_HTML,
      {},
      {
        'https://example.com/page': {
          body: mdBody,
          headers: { 'content-type': 'text/markdown' },
        },
      },
    );
    expect((await run(markdownContentNegotiation, ctx)).status).toBe('pass');
  });

  it('returns na for mirror-dependent checks when no mirror exists', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/page', RICH_HTML);
    expect((await run(markdownMirrorSuffix, ctx)).status).toBe('fail');
    expect((await run(markdownFrontmatter, ctx)).status).toBe('na');
    expect((await run(markdownCanonicalHeader, ctx)).status).toBe('na');
    expect((await run(markdownSitemapSection, ctx)).status).toBe('na');
  });

  it('fails frontmatter when fields are incomplete', async () => {
    const incomplete = '---\ntitle: Page\n---\n\n# Page';
    const ctx = makePageCtx(
      BASE,
      'https://example.com/page',
      RICH_HTML,
      {},
      {
        'https://example.com/page.md': { body: incomplete },
      },
    );
    expect((await run(markdownFrontmatter, ctx)).status).toBe('fail');
  });
});

describe('page/code', () => {
  it('passes when every code block has a language class', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/page', RICH_HTML);
    expect((await run(codeLanguageTags, ctx)).status).toBe('pass');
  });

  it('returns na when there are no code blocks', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/p', '<html lang="en"></html>');
    expect((await run(codeLanguageTags, ctx)).status).toBe('na');
  });

  it('fails when at least one code block lacks a language class', async () => {
    const html = `<pre><code class="language-ts">a</code></pre><pre><code>b</code></pre>`;
    const ctx = makePageCtx(BASE, 'https://example.com/p', html);
    expect((await run(codeLanguageTags, ctx)).status).toBe('fail');
  });
});

describe('page/api', () => {
  it('returns na on a non-API page', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/blog/post', RICH_HTML);
    expect((await run(apiSchemaLink, ctx)).status).toBe('na');
  });

  it('passes on an API page that links to openapi.json', async () => {
    const html = `<html><body><a href="/api/openapi.json">schema</a></body></html>`;
    const ctx = makePageCtx(BASE, 'https://example.com/api/users', html);
    expect((await run(apiSchemaLink, ctx)).status).toBe('pass');
  });

  it('fails on an API page with no schema link', async () => {
    const html = `<html><body><p>No schemas here.</p></body></html>`;
    const ctx = makePageCtx(BASE, 'https://example.com/api/users', html);
    expect((await run(apiSchemaLink, ctx)).status).toBe('fail');
  });
});

describe('page/discovery', () => {
  it('returns na in single-page mode (no shared index set)', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/page', RICH_HTML);
    expect((await run(discoveryIndexed, ctx)).status).toBe('na');
  });

  it('passes when the URL is in the runner-provided index set', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/page', RICH_HTML);
    ctx.shared.set(DISCOVERY_INDEXED_KEY, new Set(['https://example.com/page']));
    expect((await run(discoveryIndexed, ctx)).status).toBe('pass');
  });

  it('fails when the URL is missing from the index set', async () => {
    const ctx = makePageCtx(BASE, 'https://example.com/orphan', RICH_HTML);
    ctx.shared.set(DISCOVERY_INDEXED_KEY, new Set(['https://example.com/page']));
    expect((await run(discoveryIndexed, ctx)).status).toBe('fail');
  });
});
