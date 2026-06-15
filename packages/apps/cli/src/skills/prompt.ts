import prompts from 'prompts';
import chalk from 'chalk';

// Navigation hints rendered in the secondary (dim) color, matching the
// library's own hint styling. `select` greys its `hint` automatically;
// `multiselect` renders the `instructions` string verbatim, so we dim it.
const HINT_SELECT = 'Use arrow-keys, enter to confirm.';
const HINT_MULTI = chalk.gray('Use arrow-keys, space to select, enter to confirm.');

/** A blank line after a prompt, for breathing room before the next output. */
function spacer(): void {
  process.stdout.write('\n');
}

export interface SelectChoice {
  /** The value returned when chosen. */
  value: string;
  /** Display title. */
  title: string;
  /** Right-hand status hint. */
  hint: string;
  /** Whether the row starts checked. */
  selected: boolean;
}

/**
 * Render a multi-select checklist and return the chosen values, or null when
 * the user cancels. Used for the uninstall picker; injected in tests.
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
      instructions: HINT_MULTI,
      choices: choices.map((c) => ({
        title: c.title,
        value: c.value,
        selected: c.selected,
        description: c.hint,
      })),
    },
    { onCancel: () => (cancelled = true) },
  );
  spacer();
  if (cancelled || !res || !Array.isArray(res.paths)) return null;
  return res.paths as string[];
};

export interface AgentChoice {
  /** Agent key (returned when selected). */
  name: string;
  /** Display title, e.g. "Cursor (.cursor/skills)". */
  title: string;
  /** Whether the row starts checked (detected agents do). */
  selected: boolean;
}

/**
 * Offer "install for detected harnesses only, or customize", then (if
 * customizing, or when nothing is detected) a full multi-select over every
 * supported harness. Returns the chosen agent keys, or null on cancel.
 */
export type PromptChooseAgents = (
  detected: { names: string[]; labels: string[] },
  all: AgentChoice[],
) => Promise<string[] | null>;

export const promptChooseAgents: PromptChooseAgents = async (detected, all) => {
  let cancelled = false;
  const onCancel = () => {
    cancelled = true;
  };

  if (detected.names.length > 0) {
    const pick = await prompts(
      {
        type: 'select',
        name: 'v',
        message: 'Install for detected harnesses only, or add more?',
        hint: HINT_SELECT,
        initial: 0,
        choices: [
          { title: `Detected only (${detected.labels.join(', ')})`, value: 'detected' },
          { title: 'Customize…', value: 'customize' },
        ],
      },
      { onCancel },
    );
    spacer();
    if (cancelled) return null;
    if (pick.v === 'detected') return detected.names;
  }

  const res = await prompts(
    {
      type: 'multiselect',
      name: 'v',
      message: 'Select harnesses',
      instructions: HINT_MULTI,
      choices: all.map((c) => ({ title: c.title, value: c.name, selected: c.selected })),
    },
    { onCancel },
  );
  spacer();
  if (cancelled || !Array.isArray(res.v)) return null;
  return res.v as string[];
};

export type InstallLocation = 'global-shared' | 'each-agent';

/** Ask whether to install once globally (shared + symlinks) or a copy per agent. */
export type PromptLocation = () => Promise<InstallLocation | null>;

export const promptLocation: PromptLocation = async () => {
  let cancelled = false;
  const res = await prompts(
    {
      type: 'select',
      name: 'v',
      message: 'Where should the skill be installed?',
      hint: HINT_SELECT,
      initial: 0,
      choices: [
        {
          title: 'A shared global location',
          value: 'global-shared',
          description: 'one copy in ~/.agents/skills, symlinked from each agent',
        },
        {
          title: 'Each agent',
          value: 'each-agent',
          description: "a copy in each agent's own directory",
        },
      ],
    },
    { onCancel: () => (cancelled = true) },
  );
  spacer();
  if (cancelled || (res.v !== 'global-shared' && res.v !== 'each-agent')) return null;
  return res.v;
};
