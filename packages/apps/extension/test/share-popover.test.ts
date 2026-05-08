import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const html = readFileSync(path.join(root, 'src/results.html'), 'utf-8');
const resultsCss = readFileSync(path.join(root, 'src/styles/results.css'), 'utf-8');
const resultsTs = readFileSync(path.join(root, 'src/results.ts'), 'utf-8');

describe('share-score popover (TJ-412)', () => {
  it('places a Share button as the first item in the export row', () => {
    const exportRow = html.match(/id="export-buttons"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(exportRow).toMatch(/<button id="share-score" class="btn"[^>]*>Share score</);
    // Share comes before the Download label and the existing buttons.
    const shareIdx = exportRow.indexOf('id="share-score"');
    const labelIdx = exportRow.indexOf('Download:');
    const promptIdx = exportRow.indexOf('id="export-prompt"');
    expect(shareIdx).toBeGreaterThan(-1);
    expect(labelIdx).toBeGreaterThan(shareIdx);
    expect(promptIdx).toBeGreaterThan(labelIdx);
  });

  it('renders a hidden popover dialog with the share text and Copy/Close buttons', () => {
    expect(html).toMatch(/id="share-popover"[\s\S]*role="dialog"[\s\S]*aria-label="Share your score"[\s\S]*hidden/);
    expect(html).toMatch(/<pre id="share-text" class="share-text">/);
    expect(html).toMatch(/id="share-copy"[^>]*>Copy</);
    expect(html).toMatch(/id="share-close"[^>]*>Close</);
    // Live region so screen readers announce "Copied!" without grabbing focus.
    expect(html).toMatch(/id="share-status"[^>]*aria-live="polite"/);
  });

  it('styles the popover with shared design tokens', () => {
    expect(resultsCss).toMatch(/\.share-popover\s*\{[\s\S]*position:\s*absolute/);
    expect(resultsCss).toMatch(/\.share-popover[\s\S]*var\(--surface\)/);
    expect(resultsCss).toMatch(/\.share-popover[\s\S]*var\(--border\)/);
    expect(resultsCss).toMatch(/\.share-popover[\s\S]*var\(--radius-lg\)/);
    expect(resultsCss).toMatch(/\.share-popover[\s\S]*var\(--shadow-card-hover\)/);
    // Triple-click must select the whole share block as a clipboard fallback.
    expect(resultsCss).toMatch(/\.share-text[\s\S]*user-select:\s*all/);
  });

  it('hides the popover via the [hidden] attribute (no leaked layout)', () => {
    expect(resultsCss).toMatch(/\.share-popover\[hidden\]\s*\{\s*display:\s*none/);
  });

  it('wires the popover via formatShareSummary with surface=extension', () => {
    expect(resultsTs).toMatch(/import\s*\{[\s\S]*formatShareSummary[\s\S]*\}\s*from\s*['"]@a14y\/core['"]/);
    expect(resultsTs).toMatch(/formatShareSummary\(\s*run\s*,\s*\{\s*surface:\s*['"]extension['"]\s*\}\s*\)/);
  });

  it('uses navigator.clipboard.writeText to copy and confirms with a status update', () => {
    expect(resultsTs).toMatch(/navigator\.clipboard\.writeText/);
    expect(resultsTs).toMatch(/shareStatus\.textContent\s*=\s*['"]Copied!['"]/);
  });

  it('closes on Esc, outside click, and the Close button', () => {
    expect(resultsTs).toMatch(/event\.key\s*===\s*['"]Escape['"]/);
    expect(resultsTs).toMatch(/onSharePopoverOutsideClick/);
    expect(resultsTs).toMatch(/shareCloseBtn\.onclick\s*=\s*closeSharePopover/);
  });

  it('removes scroll/resize listeners on close so they don\'t leak', () => {
    expect(resultsTs).toMatch(/window\.removeEventListener\(['"]resize['"]\s*,\s*positionSharePopover/);
    expect(resultsTs).toMatch(/window\.removeEventListener\(['"]scroll['"]\s*,\s*positionSharePopover/);
  });
});
