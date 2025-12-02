import { CheckResult } from './types';

export async function validateLllmsTxt(baseUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const paths = ['/llms.txt', '/.well-known/llms.txt'];
  
  let found = false;
  let content = '';
  let foundUrl = '';

  for (const path of paths) {
    const url = new URL(path, baseUrl).toString();
    try {
      const response = await fetch(url);
      if (response.ok) {
        found = true;
        foundUrl = url;
        
        // Check Content-Type
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/plain')) {
           results.push({
             id: 'FR-CORE-001',
             name: `llms.txt Content-Type`,
             status: 'pass',
             message: `Found ${path} with correct content-type: ${contentType}`
           });
        } else {
           results.push({
             id: 'FR-CORE-001',
             name: `llms.txt Content-Type`,
             status: 'warn',
             message: `Found ${path} but content-type is ${contentType}, expected text/plain`
           });
        }
        
        content = await response.text();
        break; // Stop after finding the first valid one
      }
    } catch (error) {
       // Ignore connection errors for now, try next path
    }
  }

  if (!found) {
    results.push({
      id: 'FR-CORE-001',
      name: 'llms.txt Existence',
      status: 'fail',
      message: 'Could not find llms.txt or .well-known/llms.txt'
    });
    return results;
  } else {
      results.push({
      id: 'FR-CORE-001',
      name: 'llms.txt Existence',
      status: 'pass',
      message: `Found llms.txt at ${foundUrl}`
    });
  }

  // FR-CORE-002: Validate Markdown syntax (Simple check for now)
  // We assume if it's text/plain and has some content, it's likely markdown.
  // A better check would be to parse it.
  if (content.length > 0) {
      results.push({
          id: 'FR-CORE-002',
          name: 'llms.txt Content',
          status: 'pass',
          message: 'llms.txt is not empty'
      });
  } else {
      results.push({
          id: 'FR-CORE-002',
          name: 'llms.txt Content',
          status: 'fail',
          message: 'llms.txt is empty'
      });
  }

  // FR-CORE-003: Extract URLs and verify 200 OK
  // Regex to find URLs in markdown links: [title](url) or just raw URLs
  // This is a basic regex, might need refinement.
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  const urlsToCheck: string[] = [];
  
  while ((match = linkRegex.exec(content)) !== null) {
    urlsToCheck.push(match[2]);
  }

  // TODO: Check other raw URLs?

  if (urlsToCheck.length > 0) {
      const brokenLinks: string[] = [];
      
      // Check up to 5 links for now to be polite and fast in this alpha
      for (const link of urlsToCheck.slice(0, 5)) {
          try {
              // Handle relative URLs
              const absoluteLink = new URL(link, baseUrl).toString();
              const linkResp = await fetch(absoluteLink, { method: 'HEAD' });
              if (!linkResp.ok) {
                  brokenLinks.push(`${link} (${linkResp.status})`);
              }
          } catch (e) {
              brokenLinks.push(`${link} (Network Error)`);
          }
      }

      if (brokenLinks.length === 0) {
          results.push({
              id: 'FR-CORE-003',
              name: 'llms.txt Links',
              status: 'pass',
              message: `Checked ${Math.min(urlsToCheck.length, 5)} links, all valid.`
          });
      } else {
          results.push({
              id: 'FR-CORE-003',
              name: 'llms.txt Links',
              status: 'fail',
              message: `Found broken links: ${brokenLinks.join(', ')}`
          });
      }
  }

  return results;
}
