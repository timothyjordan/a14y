import prompts from 'prompts';

const NAV_SELECT = '↑/↓ move, enter to confirm';
const NAV_MULTI = '↑/↓ move, space to select, enter to confirm';

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
      message: `${message}\n  ${NAV_MULTI}`,
      instructions: false,
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
        message: `Install for detected harnesses only, or add more?\n  ${NAV_SELECT}`,
        initial: 0,
        choices: [
          { title: `Detected only (${detected.labels.join(', ')})`, value: 'detected' },
          { title: 'Customize…', value: 'customize' },
        ],
      },
      { onCancel },
    );
    if (cancelled) return null;
    if (pick.v === 'detected') return detected.names;
  }

  const res = await prompts(
    {
      type: 'multiselect',
      name: 'v',
      message: `Select harnesses\n  ${NAV_MULTI}`,
      instructions: false,
      choices: all.map((c) => ({ title: c.title, value: c.name, selected: c.selected })),
    },
    { onCancel },
  );
  if (cancelled || !Array.isArray(res.v)) return null;
  return res.v as string[];
};

export type InstallLocation = 'global-shared' | 'local-project';

/** Ask whether to install once globally (shared + symlinks) or into this project. */
export type PromptLocation = () => Promise<InstallLocation | null>;

export const promptLocation: PromptLocation = async () => {
  let cancelled = false;
  const res = await prompts(
    {
      type: 'select',
      name: 'v',
      message: `Where should the skill be installed?\n  ${NAV_SELECT}`,
      initial: 0,
      choices: [
        {
          title: 'A shared global location',
          value: 'global-shared',
          description: 'one copy in ~/.agents/skills, symlinked from each agent',
        },
        {
          title: 'This project',
          value: 'local-project',
          description: "a copy in each agent's dir under the current project",
        },
      ],
    },
    { onCancel: () => (cancelled = true) },
  );
  if (cancelled || (res.v !== 'global-shared' && res.v !== 'local-project')) return null;
  return res.v;
};
