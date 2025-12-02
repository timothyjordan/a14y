import { CheckResult } from '../types';
import { FetchedPage } from '../utils';

export function checkHttp(page: FetchedPage): CheckResult[] {
  const results: CheckResult[] = [];

  // FR-CORE-006: Redirect chains: None should exceed 1 hop.
  if (page.redirectChain.length > 1) {
    results.push({
      id: 'FR-CORE-006',
      name: 'Redirect Chains',
      status: 'fail',
      message: `Redirect chain exceeds 1 hop: ${page.redirectChain.length} hops (${page.redirectChain.join(' -> ')} -> ${page.url})`
    });
  } else {
    results.push({
      id: 'FR-CORE-006',
      name: 'Redirect Chains',
      status: 'pass',
      message: `Redirect chain is acceptable (${page.redirectChain.length} hops)`
    });
  }

  // FR-CORE-301: Response headers
  const contentType = page.headers.get('content-type');
  if (contentType && contentType.includes('text/html') && contentType.includes('utf-8')) {
      results.push({
          id: 'FR-CORE-301',
          name: 'Content-Type Header',
          status: 'pass',
          message: `Content-Type is correct: ${contentType}`
      });
  } else {
       results.push({
          id: 'FR-CORE-301',
          name: 'Content-Type Header',
          status: 'warn',
          message: `Content-Type should be text/html; charset=utf-8, found: ${contentType}`
      });
  }

  const headersToCheck = ['x-robots-tag', 'cache-control'];
  headersToCheck.forEach(h => {
      if (page.headers.has(h)) {
           // Basic existence check, logic can be complex
           if (h === 'x-robots-tag') {
               const val = page.headers.get(h)?.toLowerCase() || '';
               if (val.includes('noindex') || val.includes('noai') || val.includes('noimageai')) {
                   results.push({
                       id: 'FR-CORE-301',
                       name: 'Robots Header',
                       status: 'warn',
                       message: `x-robots-tag contains restrictive directives: ${val}`
                   });
               }
           }
      }
  });

  return results;
}
