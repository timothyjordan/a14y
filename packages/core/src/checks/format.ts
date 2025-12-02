import { CheckResult } from '../types';
import { FetchedPage } from '../utils';

export async function checkFormat(page: FetchedPage): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  
  // FR-CORE-101: Suffix Check
  // Try to replace extension with .md or .mdx
  let urlWithoutExt = page.url;
  if (urlWithoutExt.endsWith('.html')) {
      urlWithoutExt = urlWithoutExt.substring(0, urlWithoutExt.length - 5);
  } else if (urlWithoutExt.endsWith('/')) {
      urlWithoutExt = urlWithoutExt.substring(0, urlWithoutExt.length - 1);
  }

  const suffixes = ['.md', '.mdx'];
  let foundSuffix = false;

  for (const suffix of suffixes) {
      const mdUrl = urlWithoutExt + suffix;
      try {
          const resp = await fetch(mdUrl, { method: 'HEAD' });
          if (resp.ok) {
              results.push({
                  id: 'FR-CORE-101',
                  name: 'Markdown Mirror (Suffix)',
                  status: 'pass',
                  message: `Found Markdown mirror at ${mdUrl}`
              });
              foundSuffix = true;
              break;
          }
      } catch (e) {
          // ignore
      }
  }

  if (!foundSuffix) {
      results.push({
          id: 'FR-CORE-101',
          name: 'Markdown Mirror (Suffix)',
          status: 'warn',
          message: 'Could not find .md or .mdx mirror for this page'
      });
  }

  // FR-CORE-102: Content Negotiation
  try {
      const negResp = await fetch(page.url, {
          headers: { 'Accept': 'text/markdown' }
      });
      const contentType = negResp.headers.get('content-type');
      if (contentType && (contentType.includes('text/markdown') || contentType.includes('text/x-markdown'))) {
          results.push({
              id: 'FR-CORE-102',
              name: 'Content Negotiation',
              status: 'pass',
              message: 'Responds with Markdown when Accept: text/markdown is set'
          });
      } else {
           results.push({
              id: 'FR-CORE-102',
              name: 'Content Negotiation',
              status: 'warn',
              message: `Server did not return Markdown for Accept header (got ${contentType})`
          });
      }
  } catch (e) {
      // ignore
  }

  return results;
}
