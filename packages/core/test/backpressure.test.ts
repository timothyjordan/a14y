import { describe, expect, it } from 'vitest';
import type { CheerioAPI } from 'cheerio';
import { fakeHttpClient, type FakeRoute } from './_helpers';
import { ConcurrentQueue } from '../src/crawler/queue';
import { validate, type ProgressEvent } from '../src/runner/runSite';
import type { HttpClient } from '../src/fetch/types';

describe('ConcurrentQueue.waitForSlot', () => {
  it('resolves immediately when active + pending is below the bound', async () => {
    const queue = new ConcurrentQueue({ concurrency: 2 });
    // Empty queue: any bound > 0 should resolve without scheduling.
    await queue.waitForSlot(1);
    await queue.waitForSlot(8);
  });

  it('blocks while at-or-above bound, releases as soon as a slot frees', async () => {
    const queue = new ConcurrentQueue({ concurrency: 2 });
    // Fill the queue with two long-running tasks that we control via
    // explicit resolvers. After both `add` calls, active+pending == 2.
    let release1: (() => void) | null = null;
    let release2: (() => void) | null = null;
    const t1 = queue.add(
      () => new Promise<void>((r) => { release1 = r; }),
    );
    const t2 = queue.add(
      () => new Promise<void>((r) => { release2 = r; }),
    );

    expect(queue['active'] + queue['pending'].length).toBe(2);

    // waitForSlot(2) at this point should be blocked.
    let resolved = false;
    const waiter = queue.waitForSlot(2).then(() => { resolved = true; });
    // Give the event loop a tick — the waiter should NOT resolve yet.
    await new Promise((r) => setTimeout(r, 5));
    expect(resolved).toBe(false);

    // Release one task. The slot frees, waitForSlot(2) becomes
    // satisfiable (active + pending = 1 < 2) and should resolve.
    release1!();
    await t1;
    await waiter;
    expect(resolved).toBe(true);

    // Drain the second task so the test exits cleanly.
    release2!();
    await t2;
  });

  it('handles multiple waiters: each re-checks the bound on wake', async () => {
    const queue = new ConcurrentQueue({ concurrency: 1 });
    // Fill the queue: 1 active + 2 pending = 3 in flight.
    const releases: Array<() => void> = [];
    const tasks: Array<Promise<void>> = [];
    for (let i = 0; i < 3; i++) {
      tasks.push(
        queue.add(() => new Promise<void>((r) => { releases.push(r); })),
      );
    }
    expect(queue['active'] + queue['pending'].length).toBe(3);

    // Two waiters with different bounds.
    let wokeAt2 = false;
    let wokeAt1 = false;
    const waitA = queue.waitForSlot(2).then(() => { wokeAt2 = true; });
    const waitB = queue.waitForSlot(1).then(() => { wokeAt1 = true; });
    await new Promise((r) => setTimeout(r, 5));
    expect(wokeAt2).toBe(false);
    expect(wokeAt1).toBe(false);

    // Release one task: active+pending drops to 2. waitForSlot(2)
    // should still block (need < 2). waitForSlot(1) still blocks too.
    releases[0]();
    await tasks[0];
    // Both waiters get woken by the slot-free wake, but the bound is
    // still ≥ their thresholds — they re-register.
    await new Promise((r) => setTimeout(r, 5));
    expect(wokeAt2).toBe(false);
    expect(wokeAt1).toBe(false);

    // Release another: active+pending drops to 1. waitForSlot(2)
    // becomes satisfiable; waitForSlot(1) still blocks.
    releases[1]();
    await tasks[1];
    await waitA;
    expect(wokeAt2).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    expect(wokeAt1).toBe(false);

    // Release the last: waitForSlot(1) unblocks.
    releases[2]();
    await tasks[2];
    await waitB;
    expect(wokeAt1).toBe(true);
  });
});

describe('site runner backpressure (integration)', () => {
  // Build a fake site of N HTML pages, each linking to the next. The
  // sitemap announces only the entry so discovery happens through link
  // extraction — that exercises the full crawler + page-check pipeline
  // exactly the way a real site does. Each page has a small fetch
  // delay so workers don't all resolve in one microtask, which is what
  // would mask a missing backpressure gate.
  function buildChainRoutes(n: number, delayMs: number): Record<string, FakeRoute> {
    const routes: Record<string, FakeRoute> = {
      'https://example.com/sitemap.xml': {
        body: `<urlset><url><loc>https://example.com/p0</loc></url></urlset>`,
        delayMs,
      },
    };
    for (let i = 0; i < n; i++) {
      const next = i + 1 < n ? `<a href="/p${i + 1}">next</a>` : '';
      routes[`https://example.com/p${i}`] = {
        body: `<!doctype html><html lang="en"><body><h1>page ${i}</h1>${next}</body></html>`,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        delayMs,
      };
    }
    return routes;
  }

  it('keeps the in-flight page-check count bounded under load', async () => {
    const N = 30;
    const pageCheckConcurrency = 4;
    const concurrency = 8;
    // Pages don't fire `page-discovered` until the for-await consumer
    // yields them, so the crawler buffer (size `concurrency`) is not
    // counted here. What we DO observe is the gap between
    // `page-discovered` and `page-done`:
    //   - up to (pageCheckConcurrency + 1) in the page-check queue
    //     (its `waitForSlot` bound), plus
    //   - exactly 1 page mid-await between progress-event and
    //     handlePage scheduling.
    const expectedBound = pageCheckConcurrency + 1 + 1;
    const slack = 1;

    let inFlight = 0;
    let peakInFlight = 0;
    const events: ProgressEvent['type'][] = [];

    await validate({
      url: 'https://example.com/p0',
      mode: 'site',
      http: fakeHttpClient(buildChainRoutes(N, 1)),
      concurrency,
      pageCheckConcurrency,
      politeDelayMs: 0,
      onProgress: (ev) => {
        events.push(ev.type);
        if (ev.type === 'page-discovered') {
          inFlight++;
          if (inFlight > peakInFlight) peakInFlight = inFlight;
        } else if (ev.type === 'page-done') {
          inFlight--;
        }
      },
    });

    expect(events).toContain('finished');
    expect(peakInFlight).toBeLessThanOrEqual(expectedBound + slack);
    // Sanity: backpressure shouldn't trivially pass by serializing —
    // we should observe at least some real concurrency.
    expect(peakInFlight).toBeGreaterThan(1);
  });

  it('parses each HTML page with cheerio exactly twice (link extract + checks)', async () => {
    // Disposable `$` should mean the lazy getter on FetchedPage fires
    // once per page during link extraction (crawler task), then again
    // on the first page-check access (after dispose dropped the
    // cached parse). Any drift (e.g. dispose stops being called, or
    // someone touches `$` more than once between dispose calls) would
    // push this above 2× and we'd want to know.
    //
    // We count *actual parses* by tracking distinct cheerio instances
    // returned from each page's `$` getter — every time the lazy
    // cache is empty and the getter parses afresh, the returned
    // instance is new. (Spying on cheerio.load directly doesn't work:
    // the module exports it as non-configurable.) Each page should
    // produce exactly 2 distinct instances: 1 during link extraction,
    // 1 during page-checks after dispose drops the first.
    const N = 12;
    let parseCount = 0;
    const baseClient = fakeHttpClient(buildChainRoutes(N, 0));
    const http: HttpClient = {
      fetch: baseClient.fetch,
      async fetchPage(url, options) {
        const page = await baseClient.fetchPage(url, options);
        const desc = Object.getOwnPropertyDescriptor(page, '$');
        if (!desc?.get) return page;
        const originalGet = desc.get.bind(page);
        const originalDispose = page.dispose.bind(page);
        let lastSeen: CheerioAPI | null = null;
        Object.defineProperty(page, '$', {
          configurable: true,
          enumerable: desc.enumerable,
          get(): CheerioAPI {
            const $ = originalGet();
            if ($ !== lastSeen) {
              parseCount++;
              lastSeen = $;
            }
            return $;
          },
        });
        page.dispose = (): void => {
          originalDispose();
          lastSeen = null;
        };
        return page;
      },
    };

    await validate({
      url: 'https://example.com/p0',
      mode: 'site',
      http,
      concurrency: 4,
      pageCheckConcurrency: 4,
      politeDelayMs: 0,
    });

    // Exactly 2 parses per page: 1 link extract + 1 checks.
    // Stricter than ≥ — catches both ends:
    //   < 2N would mean dispose isn't dropping the cache,
    //   > 2N would mean someone is touching $ between dispose and
    //   the next cache write, e.g. dispose being called twice.
    expect(parseCount).toBe(N * 2);
  });
});
