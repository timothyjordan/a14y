import { spawn } from 'node:child_process';
import { runSkillsCommand, type RunSkillsDeps, type RunSkillsOptions } from './skills';

type TrackFn = (event: string, props?: Record<string, unknown>) => void;

const GLOBAL_PACKAGE = 'a14y';

/** A spawn shim so the npm call can be faked in unit tests. */
export type SpawnInstall = (command: string, args: string[]) => Promise<number>;

const defaultSpawn: SpawnInstall = (command, args) =>
  new Promise<number>((resolve) => {
    // Send npm's stdout to our stderr (fd 2) so our own stdout stays clean —
    // important for `--output json`. npm's own errors already go to stderr.
    const child = spawn(command, args, { stdio: ['inherit', 2, 'inherit'] });
    child.on('error', () => resolve(127)); // e.g. npm not found
    child.on('close', (code) => resolve(code ?? 1));
  });

/**
 * Run `npm install -g a14y` so the CLI lands permanently on PATH. Returns the
 * exit code. Set `A14Y_INSTALL_SKIP_GLOBAL=1` to skip the spawn (used by the
 * integration tests so they don't touch the real global prefix).
 */
export async function globalInstall(spawnImpl: SpawnInstall = defaultSpawn): Promise<number> {
  if (process.env.A14Y_INSTALL_SKIP_GLOBAL === '1') return 0;
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawnImpl(npm, ['install', '-g', GLOBAL_PACKAGE]);
}

export interface RunInstallDeps extends RunSkillsDeps {
  /** Override the `npm install -g a14y` step (defaults to {@link globalInstall}). */
  installGlobally?: () => Promise<number>;
  /** Override the skill-install step (defaults to {@link runSkillsCommand}). */
  runSkill?: (opts: RunSkillsOptions, deps: RunSkillsDeps) => Promise<number>;
}

/**
 * `a14y install`: install the CLI globally, then install the agent skill. The
 * two steps are independent — if the global install fails we warn and still set
 * up the skill, but the command exits non-zero so the failure is visible.
 */
export async function runInstallCommand(
  opts: RunSkillsOptions,
  deps: RunInstallDeps,
): Promise<number> {
  const track: TrackFn = deps.track ?? (() => {});
  const dryRun = Boolean(opts.check || opts.dryRun);
  // Keep stdout clean for `--output json`; narration goes there only in text mode.
  const note = (line: string) => {
    if (opts.output !== 'json') deps.stdout(line);
  };

  track('cli_command_invoked', {
    command: 'install',
    dry_run: dryRun,
    output_format: opts.output ?? 'text',
    run_id: deps.runId,
  });

  let globalFailed = false;
  if (!dryRun) {
    note('Installing a14y globally (npm install -g a14y)…');
    const code = await (deps.installGlobally ?? globalInstall)();
    if (code !== 0) {
      globalFailed = true;
      deps.stderr(
        `Global install failed (npm exited ${code}). You can install it yourself with: npm install -g a14y`,
      );
      track('cli_error', {
        command: 'install',
        phase: 'global-install',
        error_class: 'NpmInstallFailed',
        run_id: deps.runId,
      });
      note('Continuing with the skill install…');
    }
    note('');
  }

  const runSkill = deps.runSkill ?? runSkillsCommand;
  const skillCode = await runSkill({ ...opts, action: 'install' }, deps);

  return skillCode !== 0 ? skillCode : globalFailed ? 1 : 0;
}
