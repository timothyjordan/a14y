/**
 * Side-effect-only barrel that pulls in every check file so each one can
 * call `registerCheck()` at module load. Adding a new check means adding an
 * import line here.
 *
 * This file is intentionally split out from registry.ts to avoid a circular
 * import: check files import types from `./types`, registry exports
 * `registerCheck`, and check files call it at top level.
 */

// Site-level checks — populated by TJ-96.
// (placeholder; intentionally empty until check files exist)

// Page-level checks — populated by TJ-97.
// (placeholder; intentionally empty until check files exist)

export {};
