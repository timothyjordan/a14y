import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertCoverage } from '../src/lib/assert-coverage';

const CONTENT_DIR = fileURLToPath(new URL('../src/content/checks/', import.meta.url));

describe('docs content coverage', () => {
  it('reports missing ids when a content file is absent', () => {
    // Use a non-existent directory to simulate the "no content authored
    // yet" failure mode. The error must list every missing id so the
    // author can fix them all in one pass.
    const empty = path.join(CONTENT_DIR, '__nonexistent__');
    expect(() => assertCoverage(empty)).toThrow(/missing content for/);
  });

  // The positive test ("every shipped check has a content file") is
  // added in the content-authoring commit (TJ-123) once all 38 markdown
  // files exist.
});
