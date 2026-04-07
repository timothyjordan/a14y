import { registerCheck } from '../../scorecard/registry';
import type { PageCheckContext, PageCheckSpec } from '../../scorecard/types';

export const codeLanguageTags: PageCheckSpec = {
  id: 'code.language-tags',
  scope: 'page',
  name: 'Code blocks declare a language',
  group: 'Code',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if every <pre><code> block has a language-* or lang-* class on either the <code> or its parent <pre>.',
      run: async (ctx) => {
        const $ = (ctx as PageCheckContext).page.$;
        const blocks = $('pre code').toArray();
        if (blocks.length === 0) return { status: 'na', message: 'no code blocks on page' };
        const tagged = blocks.filter((el) => {
          const cls = ($(el).attr('class') ?? '') + ' ' + ($(el).parent().attr('class') ?? '');
          return /\b(language-|lang-)/.test(cls);
        });
        return tagged.length === blocks.length
          ? { status: 'pass', message: `${blocks.length} blocks` }
          : { status: 'fail', message: `${blocks.length - tagged.length}/${blocks.length} blocks missing language` };
      },
    },
  },
};

registerCheck(codeLanguageTags);
