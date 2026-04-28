import type { EventParamValue } from './types';

const PII_KEY_RE = /url|href|host|email|\bip\b/i;
const PATH_KEY_RE = /(^|_)path($|_)/i;
const GA4_EVENT_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const MAX_PARAM_NAME = 40;
const MAX_STRING_VALUE = 100;
const MAX_PARAMS_PER_EVENT = 25;

const PATH_KEY_ALLOWLIST = new Set(['path_category']);

export function errorClassName(e: unknown): string {
  if (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { constructor?: { name?: string } }).constructor?.name === 'string'
  ) {
    return (e as { constructor: { name: string } }).constructor.name;
  }
  return 'Error';
}

export function isValidEventName(name: string): boolean {
  return GA4_EVENT_NAME_RE.test(name);
}

/**
 * Strip PII-shaped keys, coerce values to GA4-compatible primitives, enforce
 * GA4 length limits. Drops anything it can't safely send.
 */
export function sanitizeProps(
  props: Record<string, unknown>,
): Record<string, EventParamValue> {
  const out: Record<string, EventParamValue> = {};
  let count = 0;
  for (const [key, raw] of Object.entries(props)) {
    if (count >= MAX_PARAMS_PER_EVENT) break;
    if (raw === undefined || raw === null) continue;
    if (key.length === 0 || key.length > MAX_PARAM_NAME) continue;
    if (PII_KEY_RE.test(key)) continue;
    if (PATH_KEY_RE.test(key) && !PATH_KEY_ALLOWLIST.has(key)) continue;
    let value: EventParamValue;
    if (typeof raw === 'boolean' || typeof raw === 'number') {
      if (typeof raw === 'number' && !Number.isFinite(raw)) continue;
      value = raw;
    } else if (typeof raw === 'string') {
      value = raw.slice(0, MAX_STRING_VALUE);
    } else {
      continue;
    }
    out[key] = value;
    count++;
  }
  return out;
}
