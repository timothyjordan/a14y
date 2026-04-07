import { registerCheck } from '../../scorecard/registry';
import type { PageCheckContext, PageCheckSpec } from '../../scorecard/types';

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

registerCheck(htmlHeadings);
registerCheck(htmlTextRatio);
registerCheck(htmlGlossaryLink);
