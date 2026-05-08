import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const html = readFileSync(path.join(root, 'src/results.html'), 'utf-8');
const resultsCss = readFileSync(path.join(root, 'src/styles/results.css'), 'utf-8');
const resultsTs = readFileSync(path.join(root, 'src/results.ts'), 'utf-8');

describe('share-score popover (TJ-412)', () => {
  it('places the share icon button inside the scorecard tile, after the meta', () => {
    const scorecardSection = html.match(/<section id="scorecard"[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(scorecardSection).toMatch(/id="share-score"[^>]*class="share-icon-btn"/);
    expect(scorecardSection).toMatch(/aria-label="Share score"/);
    const metaIdx = scorecardSection.indexOf('id="report-meta"');
    const shareIdx = scorecardSection.indexOf('id="share-score"');
    expect(metaIdx).toBeGreaterThan(-1);
    expect(shareIdx).toBeGreaterThan(metaIdx);
    expect(resultsCss).toMatch(/\.scorecard-callout \.share-icon-btn\s*\{[\s\S]*margin-left:\s*auto/);
  });

  it('uses the classic three-circles share glyph (not an upload arrow)', () => {
    const shareBtn = html.match(/id="share-score"[\s\S]*?<\/button>/)?.[0] ?? '';
    // Three circles + two connecting lines — the canonical Android share icon.
    const circleMatches = shareBtn.match(/<circle\b/g) ?? [];
    const lineMatches = shareBtn.match(/<line\b/g) ?? [];
    expect(circleMatches.length).toBe(3);
    expect(lineMatches.length).toBe(2);
    // Should not contain the upload-arrow polyline used previously.
    expect(shareBtn).not.toMatch(/<polyline\b/);
  });

  it('keeps the cta-row free of the share button (download buttons only)', () => {
    const exportRow = html.match(/id="export-buttons"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(exportRow).not.toMatch(/id="share-score"/);
    expect(exportRow).toMatch(/Download:/);
    expect(exportRow).toMatch(/id="export-prompt"/);
  });

  it('renders a hidden popover dialog with the share text and platform actions row', () => {
    expect(html).toMatch(/id="share-popover"[\s\S]*role="dialog"[\s\S]*aria-label="Share your score"[\s\S]*hidden/);
    expect(html).toMatch(/<pre id="share-text" class="share-text">/);
    expect(html).toMatch(/id="share-actions" class="share-actions"/);
    expect(html).toMatch(/id="share-status"[^>]*aria-live="polite"/);
  });

  it('renders X, LinkedIn, Bluesky, Copy, and Close buttons in the actions row', () => {
    const actionsRow = html.match(/id="share-actions"[\s\S]*?<\/div>/)?.[0] ?? '';
    // Each entry: extract the element and assert its attributes.
    const xEl = actionsRow.match(/<a\b[^>]*id="share-x"[^>]*>/)?.[0] ?? '';
    expect(xEl).toMatch(/aria-label="Share on X"/);
    expect(xEl).toMatch(/target="_blank"/);
    expect(xEl).toMatch(/rel="noopener"/);

    const blueskyEl = actionsRow.match(/<a\b[^>]*id="share-bluesky"[^>]*>/)?.[0] ?? '';
    expect(blueskyEl).toMatch(/aria-label="Share on Bluesky"/);
    expect(blueskyEl).toMatch(/target="_blank"/);
    expect(blueskyEl).toMatch(/rel="noopener"/);

    // LinkedIn is now a button (not an anchor) so we can intercept the click
    // and show the copy-confirm step before opening the LinkedIn dialog.
    const linkedInEl = actionsRow.match(/<button\b[^>]*id="share-linkedin"[^>]*>/)?.[0] ?? '';
    expect(linkedInEl).toMatch(/aria-label="Share on LinkedIn"/);
    expect(linkedInEl).toMatch(/type="button"/);

    expect(actionsRow).toMatch(/id="share-copy"[^>]*aria-label="Copy share text"/);
    expect(actionsRow).toMatch(/id="share-close"[^>]*aria-label="Close"/);
  });

  it('renders a hidden LinkedIn-confirm view with explanation, Continue link, and Back', () => {
    expect(html).toMatch(/id="share-linkedin-confirm"[\s\S]*hidden/);
    const confirm = html.match(/id="share-linkedin-confirm"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    expect(confirm).toMatch(/copied to the clipboard/i);
    expect(confirm).toMatch(/<a[\s\S]*?id="share-linkedin-continue"[\s\S]*?target="_blank"[\s\S]*?rel="noopener"[\s\S]*?>Continue to LinkedIn</);
    expect(confirm).toMatch(/<button[\s\S]*?id="share-linkedin-back"[\s\S]*?>Back</);
  });

  it('sets share-intent URLs from the formatted share text', () => {
    expect(resultsTs).toMatch(/shareXLink\.href\s*=\s*`https:\/\/x\.com\/intent\/post\?text=\$\{encodeURIComponent\(text\)\}`/);
    expect(resultsTs).toMatch(/shareBlueskyLink\.href\s*=\s*`https:\/\/bsky\.app\/intent\/compose\?text=\$\{encodeURIComponent\(text\)\}`/);
    // The LinkedIn URL is now applied to the Continue link in the confirm view.
    expect(resultsTs).toMatch(/shareLinkedInContinue\.href\s*=\s*`https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=\$\{encodeURIComponent\(SHARE_CTA_URL\)\}`/);
    expect(resultsTs).toMatch(/SHARE_CTA_URL\s*=\s*['"]https:\/\/a14y\.dev\?utm_source=extension&utm_medium=share['"]/);
  });

  it('copies share text and switches to the confirm view when LinkedIn is clicked', () => {
    expect(resultsTs).toMatch(/shareLinkedInBtn\.onclick\s*=\s*async/);
    expect(resultsTs).toMatch(/navigator\.clipboard\.writeText\(shareTextEl\.textContent[\s\S]*showLinkedInConfirmView/);
  });

  it('toggles between the actions row and the LinkedIn confirm view via hidden', () => {
    expect(resultsTs).toMatch(/showShareActionsView[\s\S]*shareActionsRow\.hidden\s*=\s*false[\s\S]*shareLinkedInConfirm\.hidden\s*=\s*true/);
    expect(resultsTs).toMatch(/showLinkedInConfirmView[\s\S]*shareActionsRow\.hidden\s*=\s*true[\s\S]*shareLinkedInConfirm\.hidden\s*=\s*false/);
    expect(resultsTs).toMatch(/shareLinkedInBack\.onclick\s*=\s*\(\)\s*=>\s*\{[\s\S]*showShareActionsView/);
  });

  it('closes the popover after the user follows the Continue link to LinkedIn', () => {
    expect(resultsTs).toMatch(/shareLinkedInContinue\.addEventListener\(['"]click['"][\s\S]*closeSharePopover/);
  });

  it('styles the share-platform buttons with shared design tokens', () => {
    expect(resultsCss).toMatch(/\.share-platform-btn[\s\S]*var\(--border\)/);
    expect(resultsCss).toMatch(/\.share-platform-btn[\s\S]*border-radius:\s*8px/);
    expect(resultsCss).toMatch(/\.share-text[\s\S]*user-select:\s*all/);
    expect(resultsCss).toMatch(/\.share-linkedin-confirm\[hidden\]\s*\{\s*display:\s*none/);
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
