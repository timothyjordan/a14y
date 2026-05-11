/**
 * HTML-to-markdown rendering for design-heavy a14y pages.
 *
 * Authored as JSX (e.g. `index.astro`, `spec.astro`), these pages
 * carry too much bespoke markup — pillar cards, tool cards,
 * spec-layer cards, the agent-prompt CLI demo — to express cleanly
 * as markdown source. Instead, the markdown-mirrors integration
 * reads the HTML Astro just wrote to `dist/<page>/index.html` and
 * runs it through the converter below, producing pure markdown for
 * the `.md` mirror with no inline `<span>` / `<div>` /
 * `<pre>`-with-class noise.
 */
import TurndownService from 'turndown';

export interface HtmlToMarkdownOptions {
  /**
   * CSS-style tag selector for the page body. Currently unused by
   * the converter directly — we drop chrome via Turndown rules
   * instead — but kept for future extensibility / clarity.
   */
  mainSelector?: string;
}

/**
 * Convert a full Astro-rendered HTML page into clean markdown body
 * text. The returned string is the body only; the integration
 * prepends frontmatter and appends the `## Sitemap` footer.
 */
export function renderPageMarkdown(
  html: string,
  _opts: HtmlToMarkdownOptions = {},
): string {
  const main = extractMain(html);
  const td = createService();
  return td.turndown(main).trim() + '\n';
}

/**
 * Pull the inner HTML of the page's `<main>` element. Falls back
 * to the full HTML if no `<main>` is found, but every a14y page
 * wraps its content in `<main class="container[--wide]">` via
 * BaseLayout.astro, so the fallback is defensive only.
 */
function extractMain(html: string): string {
  const match = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return match ? match[1] : html;
}

function createService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  // Drop chrome / interactive UI / iconography — none of it is
  // useful in a `.md` mirror.
  td.remove(['script', 'style', 'svg', 'button', 'noscript']);

  // Eyebrow chrome ("v0.2.0 · Open spec · 38 versioned checks") is
  // visual chrome that doesn't read as content. Strip it entirely.
  td.addRule('drop-eyebrows', {
    filter: (node) => isHtmlElement(node) && node.classList.contains('eyebrow'),
    replacement: () => '',
  });

  // Copy buttons + their labels are interactive UI — not content.
  td.addRule('drop-copy-cli', {
    filter: (node) =>
      isHtmlElement(node) &&
      (node.classList.contains('copy-cli') ||
        node.classList.contains('cta-stack')),
    replacement: () => '',
  });

  // The hero's right-side badge is a self-contained visual card
  // (inline-styled anchor wrapping the score, host, and stats). It
  // makes no sense as markdown; emit a single embed link instead.
  td.addRule('hero-badge', {
    filter: (node) =>
      isHtmlElement(node) && node.classList.contains('hero-badge'),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const link = el.querySelector('a.hero-badge-link');
      const href = link?.getAttribute('href') ?? '/badge/';
      const text = link ? (link.textContent ?? '').trim() : 'Embed your own a14y badge';
      return `\n\n[${text}](${href})\n\n`;
    },
  });

  // Tool-card command snippet — and the visually identical command
  // block inside the automation section. A styled `<pre><code>...`
  // with `<span class="prompt">` highlighting; emit as a fenced
  // shell block of plain text.
  td.addRule('tool-cmd-pre', {
    filter: (node) =>
      isHtmlElement(node) &&
      node.tagName === 'PRE' &&
      (node.classList.contains('tool-cmd') ||
        node.classList.contains('automate-cmd')),
    replacement: (_content, node) => {
      const text = (node as HTMLElement).textContent ?? '';
      return `\n\n\`\`\`shell\n${text.trim()}\n\`\`\`\n\n`;
    },
  });

  // Step card: a list item with number / h3 / paragraph. Convert to:
  //
  //   ### NN — Title
  //
  //   {description with inline links preserved}
  td.addRule('step-card', {
    filter: (node) =>
      isHtmlElement(node) && node.classList.contains('step-card'),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const num = textOf(el, '.step-num');
      const heading = textOf(el, 'h3');
      const p = el.querySelector('p');
      const body = p ? td.turndown(p.innerHTML).trim() : '';
      const title = num ? `${num} — ${heading}` : heading;
      return `\n\n### ${title}\n\n${body}\n\n`;
    },
  });

  // Automation card: an eyebrow + h3 + paragraph + command + actions.
  // Convert to a block with the eyebrow folded into the heading so
  // path A / path B remain distinguishable in the mirror.
  td.addRule('automate-card', {
    filter: (node) =>
      isHtmlElement(node) && node.classList.contains('automate-card'),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const eyebrow = textOf(el, '.automate-eyebrow');
      const heading = textOf(el, 'h3');
      const p = el.querySelector('p');
      const body = p ? td.turndown(p.innerHTML).trim() : '';
      const cmdEl = el.querySelector('pre.automate-cmd');
      const cmd = cmdEl ? (cmdEl.textContent ?? '').trim() : '';
      const actions = Array.from(
        el.querySelectorAll('.automate-actions a, .automate-actions button'),
      )
        .map((a) => {
          const t = (a.textContent ?? '').trim();
          const h = a.getAttribute('href');
          if (!t) return '';
          return h ? `- [${t}](${h})` : `- ${t}`;
        })
        .filter(Boolean)
        .join('\n');
      const title = eyebrow ? `${eyebrow} — ${heading}` : heading;
      const parts = [`### ${title}`, '', body, ''];
      if (cmd) parts.push('```shell', cmd, '```', '');
      if (actions) parts.push(actions, '');
      return `\n\n${parts.join('\n').trim()}\n\n`;
    },
  });

  // Tool card: an article containing a head (badge + h3), a
  // description, an optional <pre class="tool-cmd">, and an
  // actions row. Convert to a block:
  //
  //   ### {tool name}
  //
  //   {description}
  //
  //   ```shell
  //   ...
  //   ```
  //
  //   - [Action 1](href)
  //   - [Action 2](href)
  td.addRule('tool-card', {
    filter: (node) =>
      isHtmlElement(node) && node.classList.contains('tool-card'),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const name = textOf(el, '.tool-head h3') || textOf(el, 'h3');
      const desc = textOf(el, '.tool-desc');
      // Don't collapse whitespace inside the CLI snippet — newlines
      // separate the install/run lines.
      const cmdEl = el.querySelector('pre.tool-cmd');
      const cmd = cmdEl ? (cmdEl.textContent ?? '').trim() : '';
      const note = textOf(el, '.tool-note');
      const actions = Array.from(
        el.querySelectorAll('.tool-actions a, .tool-actions span'),
      )
        .map((a) => {
          const t = (a.textContent ?? '').trim();
          const h = a.getAttribute('href');
          if (!t) return '';
          return h ? `- [${t}](${h})` : `- ${t}`;
        })
        .filter(Boolean)
        .join('\n');
      const parts = [`### ${name}`, '', desc, ''];
      if (cmd) {
        parts.push('```shell', cmd.trim(), '```', '');
      }
      if (actions) parts.push(actions, '');
      if (note) parts.push(note, '');
      return `\n\n${parts.join('\n').trim()}\n\n`;
    },
  });

  // Spec-layer card: emits as `### Layer NN — Title` then the
  // paragraph (preserving inline `<code>` as backticks via
  // Turndown's default code rule).
  td.addRule('spec-layer', {
    filter: (node) =>
      isHtmlElement(node) && node.classList.contains('spec-layer'),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const num = textOf(el, '.layer-num');
      const heading = textOf(el, 'h3');
      const p = el.querySelector('p');
      const body = p ? td.turndown(p.innerHTML).trim() : '';
      const title = num ? `${num} — ${heading}` : heading;
      return `\n\n### ${title}\n\n${body}\n\n`;
    },
  });

  return td;
}

function isHtmlElement(node: TurndownService.Node): node is HTMLElement {
  return (
    node.nodeType === 1 &&
    typeof (node as HTMLElement).classList !== 'undefined'
  );
}

function textOf(root: HTMLElement, selector: string): string {
  const el = root.querySelector(selector);
  return el ? (el.textContent ?? '').trim().replace(/\s+/g, ' ') : '';
}

/**
 * Extract `<title>` and `<meta name="description" content="...">`
 * from an Astro-rendered page. Both are emitted by BaseLayout.
 */
export function extractMetadataFromHtml(html: string): {
  title: string;
  description: string;
} {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const descMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
  );
  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    description: descMatch ? descMatch[1].trim() : '',
  };
}
