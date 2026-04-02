import { CheckResult } from './types';

export async function validateRobotsTxt(baseUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const robotsUrl = new URL('/robots.txt', baseUrl).toString();
  
  try {
    const response = await fetch(robotsUrl);
    if (!response.ok) {
         // robots.txt is optional but good practice. 
         // If missing, it defaults to allow all.
         results.push({
             id: 'FR-CORE-004',
             name: 'robots.txt Existence',
             status: 'warn',
             message: 'robots.txt not found (implies allow all)'
         });
         return results;
    }

    const content = await response.text();
    const lines = content.split('\n');
    let userAgent = '';
    const disallow: string[] = [];
    
    const aiBots = ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended'];
    const blockedBots: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || trimmed.length === 0) continue;

        const [key, ...values] = trimmed.split(':');
        const value = values.join(':').trim();
        
        if (key.toLowerCase() === 'user-agent') {
            userAgent = value;
        } else if (key.toLowerCase() === 'disallow') {
            if (aiBots.some(bot => userAgent.includes(bot)) || (userAgent === '*' && value === '/')) {
                 // simplistic check
                 if (aiBots.some(bot => userAgent.includes(bot))) {
                     blockedBots.push(userAgent);
                 }
            }
        }
    }
    
    // Check for specific blocks
    // This is a very basic parser, real world robots.txt parsing is complex.
    // We just check if the text contains "User-agent: GPTBot" and "Disallow: /" nearby?
    // Let's just do a string search for now to be safe/simple for Alpha.
    
    let aiBlockFound = false;
    for (const bot of aiBots) {
        // Regex to find User-agent: <bot> followed eventually by Disallow: /
        // This is tricky with regex across lines.
        // Let's just check if the bot is mentioned.
        if (content.includes(bot)) {
             // If mentioned, it might be allowed or disallowed.
             // We'll just warn for now that it's explicitly configured.
             // results.push({ ... })
        }
    }
    
    if (blockedBots.length > 0) {
         results.push({
             id: 'FR-CORE-004',
             name: 'robots.txt AI Access',
             status: 'warn',
             message: `Potential AI bot blocks found for: ${blockedBots.join(', ')}`
         });
    } else {
        results.push({
            id: 'FR-CORE-004',
            name: 'robots.txt AI Access',
            status: 'pass',
            message: 'No explicit AI bot blocks found in robots.txt'
        });
    }
    
    // Check conflict with llms.txt
    // If llms.txt exists but is disallowed in robots.txt?
    // We found llms.txt in previous step.
    // If robots.txt says Disallow: /llms.txt
    if (content.includes('Disallow: /llms.txt') || content.includes('Disallow: /.well-known/llms.txt')) {
         results.push({
             id: 'FR-CORE-004',
             name: 'robots.txt Conflict',
             status: 'fail',
             message: 'robots.txt disallows access to llms.txt'
         });
    }

  } catch (e: any) {
      results.push({
          id: 'FR-CORE-004',
          name: 'robots.txt Check',
          status: 'error',
          message: `Error checking robots.txt: ${e.message}`
      });
  }

  return results;
}
