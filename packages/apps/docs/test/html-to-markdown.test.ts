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
          <div class="eyebrow"><span>Open spec, open tools, public leaderboard. Lighthouse for AI agents.</span></div>
          <h1 id="hero-heading">Agent readability for the web</h1>
          <p class="lead">A short lead paragraph.</p>
          <div class="cta-stack">
            <button type="button" class="copy-btn">Copy</button>
          </div>
        </div>
        <aside class="hero-badge">
          <a class="a14y-badge" href="https://a14y.dev" style="display:block">
            <div>A14Y · V0.2.0 · MAY 11, 2026</div>
            <div>SCORE 92/100</div>
          </a>
          <a class="hero-badge-link" href="/badge/">Embed your own →</a>
        </aside>
      </section>
      <section class="section">
        <h2 id="steps-heading">Three steps to an agent-readable site</h2>
        <ol class="steps">
          <li class="step-card">
            <span class="step-num">01</span>
            <h3>Run the scorecard</h3>
            <p>From the <a href="#tools">CLI</a>, the <a href="/chrome-extension/">Chrome extension</a>, or by handing the job to a coding agent.</p>
          </li>
          <li class="step-card">
            <span class="step-num">02</span>
            <h3>Fix what failed</h3>
            <p>Each failing check links to its fix.</p>
          </li>
        </ol>
        <p class="steps-skill-callout">Or skip the loop — <a href="#automate">install the skill</a>.</p>
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
    expect(out).not.toMatch(/Open spec, open tools, public leaderboard/);
    expect(out).not.toMatch(/^Copy$/m);
    expect(out).not.toContain('© 2026');
  });

  it('reduces the hero badge to a single embed link, dropping inline-styled chrome', () => {
    expect(out).toMatch(/\[Embed your own →\]\(\/badge\/\)/);
    expect(out).not.toMatch(/A14Y · V0\.2\.0/);
    expect(out).not.toMatch(/SCORE 92\/100/);
  });

  it('promotes step cards to ### headings with numbered titles', () => {
    expect(out).toMatch(/### 01 — Run the scorecard/);
    expect(out).toMatch(/\[CLI\]\(#tools\)/);
    expect(out).toMatch(/\[Chrome extension\]\(\/chrome-extension\/\)/);
    expect(out).toMatch(/### 02 — Fix what failed/);
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
