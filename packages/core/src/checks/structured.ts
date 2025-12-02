import { CheckResult } from '../types';
import { FetchedPage } from '../utils';

export function checkStructured(page: FetchedPage): CheckResult[] {
  const results: CheckResult[] = [];
  const $ = page.$;

  // FR-CORE-201: Machine-readable endpoints
  const apiLinks = $('a').filter((i, el) => {
      const href = $(el).attr('href') || '';
      return href.endsWith('openapi.json') || 
             href.endsWith('swagger.json') || 
             href.endsWith('swagger.yaml') || 
             href.endsWith('schema.json');
  });

  if (apiLinks.length > 0) {
      results.push({
          id: 'FR-CORE-201',
          name: 'API Schemas',
          status: 'pass',
          message: `Found ${apiLinks.length} links to API schemas`
      });
  } else {
      // This is only relevant for docs with APIs, so maybe just a generic info?
      // Or we assume strict checking.
      results.push({
          id: 'FR-CORE-201',
          name: 'API Schemas',
          status: 'warn',
          message: 'No direct links to machine-readable API schemas found (openapi/swagger)'
      });
  }

  // FR-CORE-202 & FR-CORE-204: Code blocks with language fencing
  const codeBlocks = $('pre code');
  if (codeBlocks.length > 0) {
      let validBlocks = 0;
      let total = codeBlocks.length;

      codeBlocks.each((i, el) => {
          const cls = $(el).attr('class') || '';
          const parentCls = $(el).parent().attr('class') || '';
          // Check for 'language-xyz' or 'lang-xyz'
          if (cls.includes('language-') || cls.includes('lang-') || 
              parentCls.includes('language-') || parentCls.includes('lang-')) {
              validBlocks++;
          }
      });

      if (validBlocks === total) {
          results.push({
              id: 'FR-CORE-202',
              name: 'Code Block Fencing',
              status: 'pass',
              message: `All ${total} code blocks have language identifiers`
          });
      } else {
           results.push({
              id: 'FR-CORE-202',
              name: 'Code Block Fencing',
              status: 'warn',
              message: `Found ${total - validBlocks} code blocks without language identifiers out of ${total}`
          });
      }
  } else {
       // No code blocks, pass?
       results.push({
          id: 'FR-CORE-202',
          name: 'Code Block Fencing',
          status: 'pass',
          message: 'No code blocks found on this page'
      });
  }

  return results;
}
