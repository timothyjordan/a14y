import { registerCheck } from '../../scorecard/registry';
import type { PageCheckContext, PageCheckSpec } from '../../scorecard/types';

export const httpStatus200: PageCheckSpec = {
  id: 'http.status-200',
  scope: 'page',
  name: 'Page returns HTTP 200',
  group: 'HTTP',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if the final response status (after redirects) is exactly 200.',
      run: async (ctx) => {
        const status = (ctx as PageCheckContext).page.status;
        return status === 200
          ? { status: 'pass', message: '200' }
          : { status: 'fail', message: `Got ${status}` };
      },
    },
  },
};

export const httpRedirectChain: PageCheckSpec = {
  id: 'http.redirect-chain',
  scope: 'page',
  name: 'Redirect chain is at most 1 hop',
  group: 'HTTP',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if the page was reached with 0 or 1 redirect hops.',
      run: async (ctx) => {
        const hops = (ctx as PageCheckContext).page.redirectChain.length;
        return hops <= 1
          ? { status: 'pass', message: `${hops} hops` }
          : { status: 'fail', message: `${hops} hops` };
      },
    },
  },
};

export const httpContentTypeHtml: PageCheckSpec = {
  id: 'http.content-type-html',
  scope: 'page',
  name: 'Content-Type is text/html; charset=utf-8',
  group: 'HTTP',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the response Content-Type is text/html and declares utf-8 charset.',
      run: async (ctx) => {
        const ct = ((ctx as PageCheckContext).page.headers.get('content-type') ?? '').toLowerCase();
        const ok = ct.includes('text/html') && ct.includes('utf-8');
        return ok
          ? { status: 'pass', message: ct }
          : { status: 'fail', message: ct || '(missing)' };
      },
    },
  },
};

export const httpNoNoindexNoai: PageCheckSpec = {
  id: 'http.no-noindex-noai',
  scope: 'page',
  name: 'x-robots-tag does not block agents',
  group: 'HTTP',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the x-robots-tag response header does not contain noindex, noai, or noimageai.',
      run: async (ctx) => {
        const val = ((ctx as PageCheckContext).page.headers.get('x-robots-tag') ?? '').toLowerCase();
        if (!val) return { status: 'pass', message: 'no x-robots-tag' };
        const bad = ['noindex', 'noai', 'noimageai'].filter((d) => val.includes(d));
        return bad.length === 0
          ? { status: 'pass', message: val }
          : { status: 'fail', message: `Contains: ${bad.join(', ')}` };
      },
    },
  },
};

registerCheck(httpStatus200);
registerCheck(httpRedirectChain);
registerCheck(httpContentTypeHtml);
registerCheck(httpNoNoindexNoai);
