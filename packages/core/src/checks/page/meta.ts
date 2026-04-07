import { registerCheck } from '../../scorecard/registry';
import type { PageCheckContext, PageCheckSpec } from '../../scorecard/types';
import { htmlOnly } from './_htmlOnly';

const GROUP = 'HTML metadata';

export const htmlCanonicalLink: PageCheckSpec = {
  id: 'html.canonical-link',
  scope: 'page',
  name: 'Has <link rel="canonical">',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if the page declares a canonical URL via <link rel="canonical">. N/A on non-HTML responses.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const href = (ctx as PageCheckContext).page.$('link[rel="canonical"]').attr('href');
        return href
          ? { status: 'pass', message: href }
          : { status: 'fail', message: 'missing' };
      },
    },
  },
};

export const htmlMetaDescription: PageCheckSpec = {
  id: 'html.meta-description',
  scope: 'page',
  name: 'Has meta description (>= 50 chars)',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if <meta name="description"> exists and its content is at least 50 characters.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const desc = (ctx as PageCheckContext).page.$('meta[name="description"]').attr('content') ?? '';
        if (!desc) return { status: 'fail', message: 'missing' };
        return desc.trim().length >= 50
          ? { status: 'pass', message: `${desc.trim().length} chars` }
          : { status: 'fail', message: `only ${desc.trim().length} chars` };
      },
    },
  },
};

export const htmlOgTitle: PageCheckSpec = {
  id: 'html.og-title',
  scope: 'page',
  name: 'Has og:title',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if <meta property="og:title"> exists with non-empty content.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const v = (ctx as PageCheckContext).page.$('meta[property="og:title"]').attr('content');
        return v ? { status: 'pass' } : { status: 'fail', message: 'missing' };
      },
    },
  },
};

export const htmlOgDescription: PageCheckSpec = {
  id: 'html.og-description',
  scope: 'page',
  name: 'Has og:description',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if <meta property="og:description"> exists with non-empty content.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const v = (ctx as PageCheckContext).page.$('meta[property="og:description"]').attr('content');
        return v ? { status: 'pass' } : { status: 'fail', message: 'missing' };
      },
    },
  },
};

export const htmlLangAttribute: PageCheckSpec = {
  id: 'html.lang-attribute',
  scope: 'page',
  name: 'Root <html> has lang attribute',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if the <html> element declares a lang attribute.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const v = (ctx as PageCheckContext).page.$('html').attr('lang');
        return v ? { status: 'pass', message: v } : { status: 'fail', message: 'missing' };
      },
    },
  },
};

registerCheck(htmlCanonicalLink);
registerCheck(htmlMetaDescription);
registerCheck(htmlOgTitle);
registerCheck(htmlOgDescription);
registerCheck(htmlLangAttribute);
