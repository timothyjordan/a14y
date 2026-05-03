import { describe, expect, it } from 'vitest';
import {
  renderPageMarkdown,
  extractMetadataFromHtml,
} from '../src/lib/html-to-markdown';

const SAMPLE_PAGE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Sample · a14y</title>
    <meta name="description" content="Sample page for the converter test." />
  </head>
  <body>
    <header class="site-header"><nav><a href="/">a14y</a></nav></header>
    <main class="container">
      <section class="hero">
        <div class="hero-text">
          <div class="eyebrow"><span>v0.2.0 · 38 versioned checks</span></div>
          <h1 id="hero-heading">Agent readability for the web</h1>
          <p class="lead">A short lead paragraph.</p>
          <div class="cta-stack">
            <button type="button" class="copy-btn">Copy</button>
          </div>
        </div>
        <aside class="agent-panel">
          <pre class="agent-output"><span class="ag-prompt">%</span> a14y
<span class="ag-pass">✓</span> Score: 100/100</pre>
        </aside>
      </section>
      <section class="section">
        <h2>Three pillars</h2>
        <div class="pillars">
          <a class="pillar-card" href="/spec/">
            <span class="pillar-label">Pillar 01</span>
            <span class="pillar-title">The spec</span>
            <span class="pillar-desc">Three layers of agent readability.</span>
            <span class="pillar-link">Read the spec</span>
          </a>
          <a class="pillar-card" href="/scorecards/0.2.0/">
            <span class="pillar-label">Pillar 02</span>
            <span class="pillar-title">The scorecard</span>
            <span class="pillar-desc">v0.2.0 pins 38 checks.</span>
            <span class="pillar-link">Browse v0.2.0</span>
          </a>
        </div>
      </section>
      <section id="tools" class="section">
        <h2>Run the scorecard</h2>
        <div class="tools">
          <article class="tool-card">
            <div class="tool-head">
              <span class="tool-badge"><svg><circle cx="12" cy="12" r="9"/></svg></span>
              <h3>CLI</h3>
            </div>
            <p class="tool-desc">Audit any page.</p>
            <pre class="tool-cmd"><code class="language-shell"><span class="prompt">%</span> npm install -g a14y
<span class="prompt">%</span> a14y your-site.com</code></pre>
            <div class="tool-actions">
              <a href="https://npmjs.com/package/a14y">Install from npm</a>
            </div>
          </article>
        </div>
      </section>
    </main>
    <footer class="site-footer">© 2026</footer>
  </body>
</html>
`;

describe('renderPageMarkdown', () => {
  const out = renderPageMarkdown(SAMPLE_PAGE);

  it('emits clean markdown with no inline HTML noise', () => {
    expect(out).not.toMatch(/<span/);
    expect(out).not.toMatch(/<div/);
    expect(out).not.toMatch(/<svg/);
    expect(out).not.toMatch(/class=/);
  });

  it('drops chrome (header, footer, nav, eyebrow, copy buttons)', () => {
    expect(out).not.toMatch(/v0\.2\.0 · 38 versioned checks/);
    expect(out).not.toMatch(/^Copy$/m);
    expect(out).not.toContain('© 2026');
  });

  it('promotes pillar cards to ### headings with description and link', () => {
    expect(out).toMatch(/### The spec/);
    expect(out).toMatch(/Three layers of agent readability\./);
    expect(out).toMatch(/\[Read the spec\]\(\/spec\/\)/);
    expect(out).toMatch(/### The scorecard/);
    expect(out).toMatch(/\[Browse v0\.2\.0\]\(\/scorecards\/0\.2\.0\/\)/);
  });

  it('renders the agent-output pre as a fenced code block of plain text', () => {
    expect(out).toMatch(/```\n% a14y\n.* Score: 100\/100\n```/s);
  });

  it('renders the tool-card cli snippet as a fenced shell block, preserving newlines', () => {
    expect(out).toMatch(/```shell\n% npm install -g a14y\n% a14y your-site\.com\n```/);
  });

  it('keeps the canonical hero h1', () => {
    expect(out).toMatch(/^# Agent readability for the web/m);
  });
});

describe('extractMetadataFromHtml', () => {
  it('reads title and description from the head', () => {
    const meta = extractMetadataFromHtml(SAMPLE_PAGE);
    expect(meta.title).toBe('Sample · a14y');
    expect(meta.description).toBe('Sample page for the converter test.');
  });

  it('returns empty strings when tags are missing', () => {
    const meta = extractMetadataFromHtml('<html><body></body></html>');
    expect(meta).toEqual({ title: '', description: '' });
  });
});
