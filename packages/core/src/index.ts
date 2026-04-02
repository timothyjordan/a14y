export * from './llmstxt';
export * from './robots';
export * from './types';
export * from './utils';

import { validateLllmsTxt } from './llmstxt';
import { validateRobotsTxt } from './robots';
import { ValidationResult, ValidationOptions } from './types';
import { fetchPage } from './utils';
import { checkHttp } from './checks/http';
import { checkHtml } from './checks/html';
import { checkFormat } from './checks/format';
import { checkStructured } from './checks/structured';

export async function validate(url: string, options: ValidationOptions): Promise<ValidationResult> {
  const result: ValidationResult = {
    url,
    score: 0,
    checks: []
  };

  // Phase 1: LLMs.txt validation
  if (options.onProgress) options.onProgress('Checking llms.txt...');
  const llmsCheck = await validateLllmsTxt(url, options.onProgress);
  result.checks.push(...llmsCheck);

  // Phase 2: robots.txt
  if (options.onProgress) options.onProgress('Checking robots.txt...');
  const robotsCheck = await validateRobotsTxt(url);
  result.checks.push(...robotsCheck);

  // Phase 3: Page Analysis
  try {
      if (options.onProgress) options.onProgress('Fetching main page for analysis...');
      const page = await fetchPage(url);
      
      if (options.onProgress) options.onProgress('Running HTTP & HTML checks...');
      result.checks.push(...checkHttp(page, options.onProgress));
      result.checks.push(...checkHtml(page, options.onProgress));
      result.checks.push(...checkStructured(page, options.onProgress));
      
      if (options.onProgress) options.onProgress('Checking for Markdown availability...');
      const formatChecks = await checkFormat(page, options.onProgress);
      result.checks.push(...formatChecks);

  } catch (e: any) {
      result.checks.push({
          id: 'FR-CORE-PAGE',
          name: 'Page Fetch',
          status: 'error',
          message: `Failed to fetch page ${url}: ${e.message}`
      });
  }

  // Calculate score
  // Weighted scoring could be implemented here.
  // For now, simple pass/total ratio.
  const passed = result.checks.filter(c => c.status === 'pass').length;
  const total = result.checks.length;
  result.score = total > 0 ? Math.round((passed / total) * 100) : 0;

  return result;
}
