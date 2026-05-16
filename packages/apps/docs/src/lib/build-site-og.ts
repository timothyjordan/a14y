// Composes the standalone HTML page that Playwright screenshots into
// `public/leaderboard/<slug>/og.png`. The page wraps the live
// `buildBadgeHtml()` output (the same string that powers /badge) on a
// 1200×630 canvas, scaled 2× so the score and labels remain legible
// at social-thumbnail sizes.
//
// Kept separate from the script (`scripts/build-site-og.mjs`) so the
// HTML composition is pure and unit-testable without launching a
// browser. The script imports the function, sets it as page content,
// waits for fonts, and snapshots.

import type { BadgeData } from '@a14y/core';
import { buildBadgeHtml } from './build-badge-html';
import { BADGE_LIGHT_PALETTE } from './badge-style';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// Google Fonts CSS — same href used by BaseLayout so the screenshot
// renders with the site's typography (Atkinson Hyperlegible Next +
// JetBrains Mono).
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,200..800;1,200..800&family=JetBrains+Mono:ital,wght@0,400..700;1,400..700&display=swap';

export function renderBadgeOgHtml(data: BadgeData): string {
  const p = BADGE_LIGHT_PALETTE;
  const badge = buildBadgeHtml(data, { renderAs: 'div' });
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>a14y OG preview</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${FONTS_HREF}" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: ${OG_WIDTH}px;
        height: ${OG_HEIGHT}px;
        background: ${p.bg};
        overflow: hidden;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      /* Badge native width is 520px and ~360px tall. We scale uniformly
         to fit both dimensions of the 1200×630 canvas with breathing
         room around it — at scale 1.7 the badge measures 884×~612 and
         leaves ~150px of horizontal margin plus enough vertical space
         that the rounded corners are not clipped. */
      .a14y-og-scale {
        transform: scale(1.7);
        transform-origin: center;
      }
      /* Cancel the badge's own max-width inside the scaled wrapper so
         the layout doesn't get squeezed by the parent flex centering. */
      .a14y-og-scale > .a14y-badge {
        max-width: none !important;
        width: 520px !important;
      }
    </style>
  </head>
  <body>
    <div class="a14y-og-scale">${badge}</div>
  </body>
</html>`;
}
