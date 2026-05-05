/**
 * Reads the repo-root `skills/` directory and exposes each skill's
 * frontmatter to the docs site. Used by the agent-skills discovery
 * file generator (see `integrations/discovery-files.ts`) to build
 * `/.well-known/agent-skills/index.json`.
 *
 * The agentskills.io spec keeps the SKILL.md frontmatter shape simple:
 * required `name` and `description` strings, plus optional `license`,
 * `compatibility`, `allowed-tools`, and a `metadata` map. We parse
 * just that shape — adding a YAML dependency would be overkill.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  /** Space-separated list per the spec; we keep the raw string. */
  allowedTools?: string;
  /** Additional spec-permitted key/value strings under `metadata:`. */
  metadata?: Record<string, string>;
}

export interface SkillEntry extends SkillFrontmatter {
  /** Directory name under `skills/`, equals frontmatter.name per spec. */
  dirName: string;
  /** Absolute path to the SKILL.md on disk. */
  filePath: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILLS_ROOT = path.resolve(__dirname, '../../../../../skills');

/**
 * Returns every skill in the repo's `skills/` directory, sorted by
 * directory name. Throws if the frontmatter is malformed — the docs
 * build should fail loudly rather than silently emit a broken
 * discovery index.
 */
export async function getAllSkills(): Promise<SkillEntry[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(SKILLS_ROOT, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  const skills: SkillEntry[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    const skillMdPath = path.join(SKILLS_ROOT, entry.name, 'SKILL.md');
    let raw: string;
    try {
      raw = await fs.readFile(skillMdPath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }
    const fm = parseFrontmatter(raw, skillMdPath);
    if (fm.name !== entry.name) {
      throw new Error(
        `Skill ${skillMdPath}: frontmatter name "${fm.name}" must match parent directory "${entry.name}" per agentskills.io spec.`,
      );
    }
    skills.push({ ...fm, dirName: entry.name, filePath: skillMdPath });
  }
  skills.sort((a, b) => a.dirName.localeCompare(b.dirName));
  return skills;
}

/**
 * Parses the YAML frontmatter of a SKILL.md. Supports:
 *   - top-level string scalars (with optional quoting)
 *   - the `metadata:` nested mapping (one level deep, string values)
 *   - the `allowed-tools:` field (kept as raw space-separated string)
 *
 * Rejects multi-line strings, sequences, or anything else not used
 * by the agentskills.io spec. The error names the file so build
 * failures are easy to debug.
 */
export function parseFrontmatter(raw: string, filePath: string): SkillFrontmatter {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error(`Skill ${filePath}: missing YAML frontmatter (must start with ---).`);
  }
  const body = match[1];
  const lines = body.split(/\r?\n/);

  const fm: Partial<SkillFrontmatter> = {};
  const metadata: Record<string, string> = {};
  let inMetadata = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    if (inMetadata && /^ {2,}\S/.test(line)) {
      const m = line.match(/^\s+([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!m) {
        throw new Error(`Skill ${filePath}: cannot parse metadata line: ${JSON.stringify(line)}`);
      }
      metadata[m[1]] = unquote(m[2]);
      continue;
    }
    inMetadata = false;

    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) {
      throw new Error(`Skill ${filePath}: cannot parse frontmatter line: ${JSON.stringify(line)}`);
    }
    const key = m[1];
    const value = m[2];

    if (key === 'metadata') {
      if (value.trim() !== '') {
        throw new Error(`Skill ${filePath}: metadata must be a nested mapping, not inline.`);
      }
      inMetadata = true;
      continue;
    }

    const stringValue = unquote(value);
    switch (key) {
      case 'name':
        fm.name = stringValue;
        break;
      case 'description':
        fm.description = stringValue;
        break;
      case 'license':
        fm.license = stringValue;
        break;
      case 'compatibility':
        fm.compatibility = stringValue;
        break;
      case 'allowed-tools':
        fm.allowedTools = stringValue;
        break;
      default:
        // Forward-compat: ignore unknown keys rather than fail. The
        // spec explicitly allows clients to ignore fields they don't
        // recognize.
        break;
    }
  }

  if (!fm.name) throw new Error(`Skill ${filePath}: missing required "name" field.`);
  if (!fm.description) throw new Error(`Skill ${filePath}: missing required "description" field.`);
  if (fm.name.length > 64 || !/^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$|^[a-z0-9]$/.test(fm.name)) {
    throw new Error(
      `Skill ${filePath}: name "${fm.name}" violates agentskills.io spec (1-64 chars, lowercase a-z/0-9/hyphens, no leading/trailing/consecutive hyphens).`,
    );
  }
  if (fm.description.length > 1024) {
    throw new Error(
      `Skill ${filePath}: description is ${fm.description.length} characters; spec maximum is 1024.`,
    );
  }

  if (Object.keys(metadata).length > 0) fm.metadata = metadata;
  return fm as SkillFrontmatter;
}

function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
  }
  return trimmed;
}

/**
 * Reads the raw markdown body of a skill (everything after the
 * frontmatter `---` fence). Used by the well-known SKILL.md mirror
 * in `discovery-files.ts`.
 */
export async function getSkillBody(skill: SkillEntry): Promise<string> {
  const raw = await fs.readFile(skill.filePath, 'utf8');
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/** Exported for tests so they don't have to depend on file layout. */
export { SKILLS_ROOT };
