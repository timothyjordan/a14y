// Per-site Open Graph image at /leaderboard/<slug>/og.png. Generated at
// `astro build` time via getStaticPaths + the GET handler below, so each
// SiteRun page can advertise a unique social-share preview with the
// score, site name, host, scorecard version, and stat counts — see
// `BaseLayout.astro` (og:image meta) and `pages/leaderboard/[slug]/
// index.astro` (which points og:image here).

import type { APIRoute, GetStaticPaths } from 'astro';
import type { LeaderboardEntry } from '~/lib/research-data';
import { getLeaderboard } from '~/lib/research-data';
import { listSiteRunSlugs, loadSiteRun } from '~/lib/site-run';
import { renderSiteOgPng } from '~/lib/build-site-og';

export const getStaticPaths = (() => {
  // Mirror leaderboard/[slug]/index.astro: only emit OG images for
  // slugs that have BOTH a research entry and a published SiteRun.
  const published = new Set(listSiteRunSlugs());
  return getLeaderboard()
    .filter((entry) => published.has(entry.slug))
    .map((entry) => ({
      params: { slug: entry.slug },
      props: { entry },
    }));
}) satisfies GetStaticPaths;

interface Props {
  entry: LeaderboardEntry;
}

export const GET: APIRoute<Props> = async ({ props }) => {
  const { entry } = props;
  const run = await loadSiteRun(entry.slug);
  if (!run) {
    return new Response('Not found', { status: 404 });
  }

  const buffer = await renderSiteOgPng({
    siteName: entry.name,
    hostLabel: hostOf(entry.url) || entry.url,
    score: run.summary.score,
    scorecardVersion: run.scorecardVersion,
    scannedAt: run.finishedAt,
    mode: run.mode,
    summary: {
      passed: run.summary.passed,
      failed: run.summary.failed,
      warned: run.summary.warned,
      na: run.summary.na,
      total: run.summary.total,
      applicable: run.summary.applicable,
    },
  });

  // Cast to Uint8Array — Astro's APIRoute Response wants a BodyInit and
  // some Node Buffer typings don't satisfy it directly.
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}
