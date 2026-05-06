import type { SiteRun } from '@a14y/core';
import {
  emitScorecardChecksFromRun,
  type TelemetrySurface,
} from '@a14y/telemetry';

export interface EmitScorecardChecksOptions {
  run: SiteRun;
  runId: string;
  surface: TelemetrySurface;
}

/**
 * Thin wrapper around `emitScorecardChecksFromRun` that lets the CLI keep a
 * `SiteRun`-typed entry point (telemetry stays decoupled from @a14y/core).
 */
export function emitScorecardChecks(opts: EmitScorecardChecksOptions): number {
  return emitScorecardChecksFromRun({
    run: opts.run,
    runId: opts.runId,
    surface: opts.surface,
  });
}
