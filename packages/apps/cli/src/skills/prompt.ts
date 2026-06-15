import prompts from 'prompts';

export interface SelectChoice {
  /** The target file path (returned when chosen). */
  value: string;
  /** Display title, e.g. "Claude Code  ~/.claude/skills". */
  title: string;
  /** Right-hand status hint, e.g. "not installed" / "outdated 0.1.0 -> 0.2.0". */
  hint: string;
  /** Whether the row starts checked. */
  selected: boolean;
}

/**
 * Render a multi-select checklist and return the chosen values, or null when
 * the user cancels (Ctrl-C / Esc). Injected in tests; the real implementation
 * uses the `prompts` library so it works under the CLI's CommonJS build.
 */
export type PromptSelect = (
  message: string,
  choices: SelectChoice[],
) => Promise<string[] | null>;

export const promptSelectTargets: PromptSelect = async (message, choices) => {
  let cancelled = false;
  const res = await prompts(
    {
      type: 'multiselect',
      name: 'paths',
      message,
      instructions: false,
      hint: 'space to toggle · a to select all · enter to confirm',
      choices: choices.map((c) => ({
        title: c.title,
        value: c.value,
        selected: c.selected,
        description: c.hint,
      })),
    },
    { onCancel: () => (cancelled = true) },
  );
  if (cancelled || !res || !Array.isArray(res.paths)) return null;
  return res.paths as string[];
};
