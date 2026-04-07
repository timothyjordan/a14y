import { registerCheck } from '../../scorecard/registry';
import type { PageCheckContext, PageCheckSpec } from '../../scorecard/types';

// Match path segments that ARE one of these words, not paths that
// merely START with one. The previous regex used `\b` which let
// `/checks/api.schema-link/` match because `.` is a word boundary —
// the doc page describing api.schema-link was getting tagged as an
// API page and failing the schema-link check.
const API_PATH_RE = /\/(api|reference|endpoints?|swagger|openapi)(?:\/|$)/i;
const SCHEMA_FILES = ['openapi.json', 'swagger.json', 'swagger.yaml', 'schema.json'];

export const apiSchemaLink: PageCheckSpec = {
  id: 'api.schema-link',
  scope: 'page',
  name: 'API pages link to a machine-readable schema',
  group: 'API',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Only applies to URLs whose path looks like API documentation. Pass if the page links to openapi.json, swagger.json, swagger.yaml, or schema.json. Returns "na" for non-API pages.',
      run: async (ctx) => {
        const c = ctx as PageCheckContext;
        if (!API_PATH_RE.test(new URL(c.url).pathname)) {
          return { status: 'na', message: 'not an API page' };
        }
        const hrefs = c.page
          .$('a[href]')
          .toArray()
          .map((el) => c.page.$(el).attr('href') ?? '');
        const found = hrefs.some((h) => SCHEMA_FILES.some((f) => h.endsWith(f)));
        return found
          ? { status: 'pass' }
          : { status: 'fail', message: 'no openapi/swagger/schema link found' };
      },
    },
  },
};

registerCheck(apiSchemaLink);
