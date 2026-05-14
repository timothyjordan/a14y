/**
 * Validators for the date strings asserted by the modified-date checks.
 *
 * Two flavors exist because the two relevant specs intersect but do not
 * overlap exactly — and the choice of validator is a load-bearing
 * statement about which upstream spec a call site is enforcing.
 *
 *  - `isW3CDateTime` matches the W3C Datetime profile referenced by
 *    sitemaps.org for `<lastmod>`. Timezone designators require the
 *    colon form (`Z` or `[+-]hh:mm`).
 *    Spec: https://www.w3.org/TR/NOTE-datetime
 *  - `isIso8601DateOrDateTime` matches the schema.org Date / DateTime
 *    grammar referenced by `dateModified`. Schema.org Date is the
 *    `YYYY-MM-DD` profile of ISO 8601 and DateTime is the combined
 *    date-and-time profile, so we accept either — and ISO 8601 permits
 *    a no-colon TZD (`+0000`), which W3C does not.
 *    Spec: https://schema.org/Date and https://schema.org/DateTime
 *
 * Deliberate narrowings (apply to BOTH validators):
 *   - Year-only `YYYY` and year-month `YYYY-MM` forms (valid W3C
 *     Datetime granularities) are rejected. Modified-date checks want a
 *     calendar day at minimum — coarser values aren't actionable.
 *   - Seconds are required when a time component is present. W3C
 *     Datetime allows `YYYY-MM-DDThh:mmTZD` without seconds; we reject
 *     it for the same reason (parity with the date-only narrowing and
 *     to keep the regex one-shape-per-form).
 *   - W3C TZD requires `Z` or `[+-]hh:mm` exactly. ISO 8601 also
 *     accepts `[+-]hhmm` (no colon); that's where the two validators
 *     intentionally diverge.
 *   - Hours-only TZD (`[+-]hh`) is rejected for both. ISO 8601 permits
 *     it but it's vanishingly rare in modified-date strings, and
 *     supporting it would force the regex to carry an asymmetric
 *     alternation that obscures the W3C/ISO 8601 divergence above.
 *
 * Both functions confirm the calendar values are real (e.g. `2024-02-30`
 * is rejected) by constructing a UTC `Date` from the parsed Y/M/D and
 * confirming each component round-trips — `Date.UTC` happily coerces
 * out-of-range days into the next month, so the surface regex alone
 * isn't enough. Real TZD offset bounds (|hh| ≤ 14, mm ≤ 59) are
 * enforced in `checkDateTime`; the regex alone would accept `+99:59`.
 *
 * Inputs are trimmed of surrounding whitespace before matching;
 * pretty-printed XML in particular can present `<lastmod>\n  …\n</lastmod>`.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
// Capture group 7 is the TZD ("Z" or "[+-]hh[:mm]") so checkDateTime
// can enforce offset bounds beyond what the regex alone expresses.
const DATE_TIME_W3C =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_TIME_ISO8601 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
const TZD_OFFSET = /^[+-](\d{2}):?(\d{2})$/;

function isCalendarValid(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

function checkDateOnly(s: string): boolean {
  const m = DATE_ONLY.exec(s);
  if (!m) return false;
  const [, y, mo, d] = m;
  return isCalendarValid(Number(y), Number(mo), Number(d));
}

function checkDateTime(s: string, re: RegExp): boolean {
  const m = re.exec(s);
  if (!m) return false;
  const [, y, mo, d, hh, mm, ss, tzd] = m;
  if (!isCalendarValid(Number(y), Number(mo), Number(d))) return false;
  const H = Number(hh);
  const M = Number(mm);
  const S = Number(ss);
  if (H > 23 || M > 59 || S > 59) return false;
  // Real-world TZD offsets are within ±14:00 (ISO 8601). The regex
  // already shaped the form; this rejects nonsense like "+99:59".
  if (tzd !== 'Z') {
    const off = TZD_OFFSET.exec(tzd);
    if (!off) return false;
    const offH = Number(off[1]);
    const offM = Number(off[2]);
    if (offH > 14 || offM > 59) return false;
    if (offH === 14 && offM !== 0) return false;
  }
  return true;
}

export function isIso8601DateOrDateTime(value: string): boolean {
  const s = value.trim();
  return checkDateOnly(s) || checkDateTime(s, DATE_TIME_ISO8601);
}

export function isW3CDateTime(value: string): boolean {
  const s = value.trim();
  return checkDateOnly(s) || checkDateTime(s, DATE_TIME_W3C);
}
