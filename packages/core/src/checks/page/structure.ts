import { registerCheck } from '../../scorecard/registry';
import type { PageCheckContext, PageCheckSpec } from '../../scorecard/types';
import { htmlOnly } from './_htmlOnly';

const GROUP = 'Content structure';

export const htmlHeadings: PageCheckSpec = {
  id: 'html.headings',
  scope: 'page',
  name: 'Has at least 3 section headings',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if the page contains 3 or more <h1>/<h2>/<h3> headings.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const count = (ctx as PageCheckContext).page.$('h1, h2, h3').length;
        return count >= 3
          ? { status: 'pass', message: `${count} headings` }
          : { status: 'fail', message: `only ${count} headings` };
      },
    },
  },
};

export const htmlTextRatio: PageCheckSpec = {
  id: 'html.text-ratio',
  scope: 'page',
  name: 'Text-to-HTML ratio is above 15%',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if visible body text takes up more than 15% of the raw HTML byte length.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const page = (ctx as PageCheckContext).page;
        const text = page.$('body').text().replace(/\s+/g, ' ').trim().length;
        const htmlLen = page.body.length || 1;
        const ratio = text / htmlLen;
        const pct = (ratio * 100).toFixed(1) + '%';
        return ratio > 0.15
          ? { status: 'pass', message: pct }
          : { status: 'fail', message: pct };
      },
    },
  },
};

export const htmlGlossaryLink: PageCheckSpec = {
  id: 'html.glossary-link',
  scope: 'page',
  name: 'Links to a glossary or terminology page',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the page contains an <a> whose text mentions glossary or terminology.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const page = (ctx as PageCheckContext).page;
        const found = page
          .$('a')
          .toArray()
          .some((el) => /(glossary|terminology)/i.test(page.$(el).text()));
        return found
          ? { status: 'pass' }
          : { status: 'fail', message: 'no glossary/terminology link' };
      },
    },
  },
};

// Word count floor for the initial HTML to count as "substantive."
// Loose by design: many legitimate but thin pages (404s, contact stubs,
// landing tiles) sit well below 100 words. 50 lets those through and
// only flags the body-is-just-framework-boot-tags case.
const SSR_MIN_WORDS = 50;

export const htmlSsrContent: PageCheckSpec = {
  id: 'html.ssr-content',
  scope: 'page',
  name: 'Initial HTML contains substantive text',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: `Pass if the initial HTML response (no JS executed) carries at least ${SSR_MIN_WORDS} words of visible text after stripping <script>, <style>, <noscript>, and <template>. Agents like Anthropic's, Perplexity's, and OpenAI's SearchBot do not run JS, so an SPA shell that hydrates client-side is invisible to them even when Googlebot can render it.`,
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const page = (ctx as PageCheckContext).page;
        const $body = page.$('body').clone();
        // Strip code, styling, no-JS fallback, and inert template
        // content so we measure only what an agent would actually read.
        $body.find('script, style, noscript, template').remove();
        const text = $body.text().replace(/\s+/g, ' ').trim();
        const words = text ? text.split(' ').length : 0;
        return words >= SSR_MIN_WORDS
          ? { status: 'pass', message: `${words} words in initial HTML` }
          : {
              status: 'fail',
              message: `only ${words} words in initial HTML (looks like a JS-rendered shell)`,
            };
      },
    },
  },
};

registerCheck(htmlHeadings);
registerCheck(htmlTextRatio);
registerCheck(htmlGlossaryLink);
registerCheck(htmlSsrContent);
