export * from './llmstxt';
export * from './robots';
export * from './types';

import { validateLllmsTxt } from './llmstxt';
import { validateRobotsTxt } from './robots';
import { ValidationResult, ValidationOptions } from './types';

export async function validate(url: string, options: ValidationOptions): Promise<ValidationResult> {
  const result: ValidationResult = {
    url,
    score: 0,
    checks: []
  };

  // Phase 1: LLMs.txt validation
  const llmsCheck = await validateLllmsTxt(url);
  result.checks.push(...llmsCheck);

  const robotsCheck = await validateRobotsTxt(url);
  result.checks.push(...robotsCheck);

  // Calculate score (simplistic for now)
  const passed = result.checks.filter(c => c.status === 'pass').length;
  const total = result.checks.length;
  result.score = total > 0 ? Math.round((passed / total) * 100) : 0;

  return result;
}
