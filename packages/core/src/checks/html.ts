import { CheckResult } from '../types';
import { FetchedPage } from '../utils';

export function checkHtml(page: FetchedPage): CheckResult[] {
  const results: CheckResult[] = [];
  const $ = page.$;

  // FR-CORE-005: Canonical link
  const canonical = $('link[rel="canonical"]').attr('href');
  if (canonical) {
    results.push({
      id: 'FR-CORE-005',
      name: 'Canonical Link',
      status: 'pass',
      message: `Found canonical link: ${canonical}`
    });
  } else {
    results.push({
      id: 'FR-CORE-005',
      name: 'Canonical Link',
      status: 'fail',
      message: 'Missing <link rel="canonical">'
    });
  }

  // FR-CORE-302: Meta tags
  const description = $('meta[name="description"]').attr('content');
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDesc = $('meta[property="og:description"]').attr('content');
  const lang = $('html').attr('lang');

  if (description && ogTitle && ogDesc && lang) {
      results.push({
          id: 'FR-CORE-302',
          name: 'Meta Tags',
          status: 'pass',
          message: 'Found description, og:title, og:description, and lang attribute'
      });
  } else {
      const missing = [];
      if (!description) missing.push('description');
      if (!ogTitle) missing.push('og:title');
      if (!ogDesc) missing.push('og:description');
      if (!lang) missing.push('html lang');
      
      results.push({
          id: 'FR-CORE-302',
          name: 'Meta Tags',
          status: 'warn',
          message: `Missing meta tags: ${missing.join(', ')}`
      });
  }

  // FR-CORE-103: Noise Ratio
  const textLength = $('body').text().replace(/\s+/g, ' ').length;
  const htmlLength = page.body.length;
  const ratio = htmlLength > 0 ? (textLength / htmlLength) : 0;
  
  // Arbitrary threshold for "good" ratio. 
  // Documentation sites are usually text heavy.
  // If ratio is very low (< 0.1), it might be JS heavy or bloated.
  if (ratio > 0.15) {
      results.push({
          id: 'FR-CORE-103',
          name: 'Signal-to-Noise Ratio',
          status: 'pass',
          message: `Text/HTML ratio is ${(ratio * 100).toFixed(1)}%`
      });
  } else {
      results.push({
          id: 'FR-CORE-103',
          name: 'Signal-to-Noise Ratio',
          status: 'warn',
          message: `Low text/HTML ratio: ${(ratio * 100).toFixed(1)}%. Site might be JS-heavy or bloated.`
      });
  }

  // FR-CORE-203: Schema.org metadata
  // Check for JSON-LD or microdata
  const jsonLd = $('script[type="application/ld+json"]');
  const itemType = $('[itemtype]');
  
  if (jsonLd.length > 0 || itemType.length > 0) {
      results.push({
          id: 'FR-CORE-203',
          name: 'Structured Data (Schema.org)',
          status: 'pass',
          message: `Found ${jsonLd.length} JSON-LD blocks and ${itemType.length} microdata items`
      });
  } else {
      results.push({
          id: 'FR-CORE-203',
          name: 'Structured Data (Schema.org)',
          status: 'warn',
          message: 'No Schema.org structured data found'
      });
  }

  // FR-CORE-205: Section demarcations
  const headers = $('h1, h2, h3');
  if (headers.length > 2) {
      results.push({
          id: 'FR-CORE-205',
          name: 'Section Demarcations',
          status: 'pass',
          message: `Found ${headers.length} headers for structure`
      });
  } else {
      results.push({
          id: 'FR-CORE-205',
          name: 'Section Demarcations',
          status: 'warn',
          message: 'Few headers found, structure might be poor for embeddings'
      });
  }

  // FR-CORE-206: Summaries
  // We used meta description for this earlier, but maybe check for a "Summary" section?
  // Let's stick to meta description as the summary for now.
  if (description && description.length > 50) {
      results.push({
          id: 'FR-CORE-206',
          name: 'Content Summary',
          status: 'pass',
          message: 'Meta description is present and substantial'
      });
  } else {
       results.push({
          id: 'FR-CORE-206',
          name: 'Content Summary',
          status: 'warn',
          message: 'Meta description missing or too short'
      });
  }

  // FR-CORE-007: Glossary
  // Simple check for a link containing "Glossary" or "Terminology"
  const glossaryLink = $('a').filter((i, el) => {
      const t = $(el).text().toLowerCase();
      return t.includes('glossary') || t.includes('terminology');
  });

  if (glossaryLink.length > 0) {
       results.push({
          id: 'FR-CORE-007',
          name: 'Glossary Link',
          status: 'pass',
          message: 'Found link to Glossary/Terminology'
      });
  } else {
      results.push({
          id: 'FR-CORE-007',
          name: 'Glossary Link',
          status: 'warn',
          message: 'No explicit Glossary link found on page'
      });
  }

  return results;
}
