import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const html = readFileSync(path.join(root, 'src/results.html'), 'utf-8');
const resultsCss = readFileSync(path.join(root, 'src/styles/results.css'), 'utf-8');
const resultsTs = readFileSync(path.join(root, 'src/results.ts'), 'utf-8');

describe('share-score popover (TJ-412)', () => {
  it('places the share icon button inside the scorecard tile, after the meta', () => {
    // Share lives in the score-line so it sits to the right of the score+meta,
    // not in the cta-row alongside the download buttons.
    const scorecardSection = html.match(/<section id="scorecard"[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(scorecardSection).toMatch(/id="share-score"[^>]*class="share-icon-btn"/);
    expect(scorecardSection).toMatch(/aria-label="Share score"/);
    // Order check: report-meta appears before the share button in the score-line.
    const metaIdx = scorecardSection.indexOf('id="report-meta"');
    const shareIdx = scorecardSection.indexOf('id="share-score"');
    expect(metaIdx).toBeGreaterThan(-1);
    expect(shareIdx).toBeGreaterThan(metaIdx);
    // Share button is anchored right of the score-line via margin-left: auto.
    expect(resultsCss).toMatch(/\.scorecard-callout \.share-icon-btn\s*\{[\s\S]*margin-left:\s*auto/);
  });

  it('keeps the cta-row free of the share button (download buttons only)', () => {
    const exportRow = html.match(/id="export-buttons"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(exportRow).not.toMatch(/id="share-score"/);
    expect(exportRow).toMatch(/Download:/);
    expect(exportRow).toMatch(/id="export-prompt"/);
  });

  it('renders a hidden popover dialog with the share text and platform icons', () => {
    expect(html).toMatch(/id="share-popover"[\s\S]*role="dialog"[\s\S]*aria-label="Share your score"[\s\S]*hidden/);
    expect(html).toMatch(/<pre id="share-text" class="share-text">/);
    // Live region so screen readers announce status without grabbing focus.
    expect(html).toMatch(/id="share-status"[^>]*aria-live="polite"/);
  });

  it('renders X, LinkedIn, Bluesky, Copy, and Close buttons in the share actions', () => {
    const popover = html.match(/id="share-popover"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    expect(popover).toMatch(/id="share-x"[\s\S]*aria-label="Share on X"/);
    expect(popover).toMatch(/id="share-linkedin"[\s\S]*aria-label="Share on LinkedIn"/);
    expect(popover).toMatch(/id="share-bluesky"[\s\S]*aria-label="Share on Bluesky"/);
    expect(popover).toMatch(/id="share-copy"[\s\S]*aria-label="Copy share text"/);
    expect(popover).toMatch(/id="share-close"[\s\S]*aria-label="Close"/);
    // Platform anchors open in a new tab.
    expect(popover).toMatch(/id="share-x"[\s\S]*target="_blank"[\s\S]*rel="noopener"/);
    expect(popover).toMatch(/id="share-linkedin"[\s\S]*target="_blank"[\s\S]*rel="noopener"/);
    expect(popover).toMatch(/id="share-bluesky"[\s\S]*target="_blank"[\s\S]*rel="noopener"/);
  });

  it('sets share-intent URLs from the formatted share text', () => {
    expect(resultsTs).toMatch(/shareXLink\.href\s*=\s*`https:\/\/x\.com\/intent\/post\?text=\$\{encodeURIComponent\(text\)\}`/);
    expect(resultsTs).toMatch(/shareBlueskyLink\.href\s*=\s*`https:\/\/bsky\.app\/intent\/compose\?text=\$\{encodeURIComponent\(text\)\}`/);
    // LinkedIn share-offsite only takes a URL, so we send the CTA URL there.
    expect(resultsTs).toMatch(/shareLinkedInLink\.href\s*=\s*`https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=\$\{encodeURIComponent\(SHARE_CTA_URL\)\}`/);
    expect(resultsTs).toMatch(/SHARE_CTA_URL\s*=\s*['"]https:\/\/a14y\.dev\?utm_source=extension&utm_medium=share['"]/);
  });

  it('copies the share text to the clipboard when the LinkedIn link is clicked', () => {
    // LinkedIn's intent only carries the URL, so we copy the rich text on click.
    expect(resultsTs).toMatch(/shareLinkedInLink\.addEventListener\(['"]click['"]/);
    expect(resultsTs).toMatch(/navigator\.clipboard\?\.writeText\(shareTextEl\.textContent[\s\S]*paste it into your LinkedIn post/);
  });

  it('styles the share-platform buttons with shared design tokens', () => {
    expect(resultsCss).toMatch(/\.share-platform-btn[\s\S]*var\(--border\)/);
    expect(resultsCss).toMatch(/\.share-platform-btn[\s\S]*border-radius:\s*8px/);
    expect(resultsCss).toMatch(/\.share-text[\s\S]*user-select:\s*all/);
  });

  it('hides the popover via the [hidden] attribute (no leaked layout)', () => {
    expect(resultsCss).toMatch(/\.share-popover\[hidden\]\s*\{\s*display:\s*none/);
  });

  it('wires the popover via formatShareSummary with surface=extension', () => {
    expect(resultsTs).toMatch(/import\s*\{[\s\S]*formatShareSummary[\s\S]*\}\s*from\s*['"]@a14y\/core['"]/);
    expect(resultsTs).toMatch(/formatShareSummary\(\s*run\s*,\s*\{\s*surface:\s*['"]extension['"]\s*\}\s*\)/);
  });

  it('uses navigator.clipboard.writeText for the Copy button and confirms with status', () => {
    expect(resultsTs).toMatch(/shareCopyBtn\.onclick[\s\S]*navigator\.clipboard\.writeText/);
    expect(resultsTs).toMatch(/shareStatus\.textContent\s*=\s*['"]Copied!['"]/);
  });

  it('closes on Esc, outside click, and the Close button', () => {
    expect(resultsTs).toMatch(/event\.key\s*===\s*['"]Escape['"]/);
    expect(resultsTs).toMatch(/onSharePopoverOutsideClick/);
    expect(resultsTs).toMatch(/shareCloseBtn\.onclick\s*=\s*closeSharePopover/);
  });

  it('removes scroll/resize listeners on close so they do not leak', () => {
    expect(resultsTs).toMatch(/window\.removeEventListener\(['"]resize['"]\s*,\s*positionSharePopover/);
    expect(resultsTs).toMatch(/window\.removeEventListener\(['"]scroll['"]\s*,\s*positionSharePopover/);
  });
});
