import * as cheerio from 'cheerio';

export interface FetchedPage {
  url: string;
  originalUrl: string;
  status: number;
  headers: Headers;
  body: string;
  $: cheerio.CheerioAPI;
  redirectChain: string[];
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const redirectChain: string[] = [];
  let currentUrl = url;
  let response: Response;
  let hops = 0;
  const maxHops = 10;

  while (true) {
    response = await fetch(currentUrl, { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      
      redirectChain.push(currentUrl);
      // Handle relative redirects
      currentUrl = new URL(location, currentUrl).toString();
      hops++;
      
      if (hops > maxHops) throw new Error('Too many redirects');
    } else {
      break;
    }
  }

  const body = await response.text();
  const $ = cheerio.load(body);

  return {
    url: currentUrl,
    originalUrl: url,
    status: response.status,
    headers: response.headers,
    body,
    $,
    redirectChain
  };
}
