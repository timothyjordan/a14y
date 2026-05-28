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

/**
 * Spec placeholder ahead of the impl PR. The contract: pass if the
 * server-rendered HTML (the initial response body, before any client-side
 * JavaScript runs) already carries the page's substantive text — agents
 * like Anthropic's and Perplexity's crawlers do not execute JS, so an
 * empty SPA shell that hydrates on the client is invisible to them even
 * when Googlebot can render it. Returns `na` until the detector ships,
 * so it contributes nothing to the draft score in the meantime.
 */
export const htmlSsrContent: PageCheckSpec = {
  id: 'html.ssr-content',
  scope: 'page',
  name: 'Initial HTML contains substantive text',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the server-rendered HTML already contains the page\'s main text (no JS execution required). Spec placeholder — detection ships in the follow-up implementation PR.',
      run: async () => ({ status: 'na', message: 'spec placeholder — detection ships in the impl PR' }),
    },
  },
};

registerCheck(htmlHeadings);
registerCheck(htmlTextRatio);
registerCheck(htmlGlossaryLink);
registerCheck(htmlSsrContent);
