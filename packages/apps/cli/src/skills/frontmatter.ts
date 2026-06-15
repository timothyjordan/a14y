// Minimal, zero-dependency reads of the two SKILL.md frontmatter fields the
// installer cares about: the top-level `name` (to tell our own skill apart from
// a foreign file) and the nested `metadata.version` (to surface old -> new on an
// update). The frontmatter shape is fixed and simple, so a focused scan beats
// pulling a YAML parser into the published CLI bundle.

function extractFrontmatter(content: string): string | null {
  // Optional BOM, then a `---` fence, the body, then a closing `---` fence.
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  return match ? match[1] : null;
}

function stripQuotes(value: string): string {
  const t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

/** Top-level `name:` from the frontmatter, or null. */
export function parseSkillName(content: string): string | null {
  const fm = extractFrontmatter(content);
  if (!fm) return null;
  const m = /^name:[ \t]*(.+?)[ \t]*$/m.exec(fm);
  return m ? stripQuotes(m[1]) : null;
}

/** `metadata.version` from the frontmatter, or null when absent/unparseable. */
export function parseSkillVersion(content: string): string | null {
  const fm = extractFrontmatter(content);
  if (!fm) return null;
  const lines = fm.split(/\r?\n/);
  let inMetadata = false;
  for (const line of lines) {
    if (/^metadata:[ \t]*$/.test(line)) {
      inMetadata = true;
      continue;
    }
    if (!inMetadata) continue;
    // A non-indented line ends the metadata block.
    if (/^\S/.test(line)) {
      inMetadata = false;
      continue;
    }
    const m = /^[ \t]+version:[ \t]*(.+?)[ \t]*$/.exec(line);
    if (m) return stripQuotes(m[1]);
  }
  return null;
}
