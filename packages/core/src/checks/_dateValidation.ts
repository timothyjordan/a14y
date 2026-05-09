/**
 * Validators for the date strings asserted by the modified-date checks.
 *
 * Two flavors exist because the two relevant specs intersect but do not
 * overlap exactly:
 *
 *  - `isW3CDateTime` matches the W3C Datetime profile referenced by
 *    sitemaps.org for `<lastmod>`. Accepts the documented date and
 *    date-time forms with timezone designators.
 *    Spec: https://www.w3.org/TR/NOTE-datetime
 *  - `isIso8601DateOrDateTime` matches the schema.org Date / DateTime
 *    grammar referenced by `dateModified`. Schema.org Date is the
 *    `YYYY-MM-DD` profile of ISO 8601 and DateTime is the combined
 *    date-and-time profile, so we accept either.
 *    Spec: https://schema.org/Date and https://schema.org/DateTime
 *
 * In practice the two grammars accept the same set of strings for
 * everything we care about; the names exist so each call site can cite
 * the correct upstream spec when it rejects an input.
 *
 * Both functions also confirm the calendar values are real (e.g.
 * `2024-02-30` is rejected) by parsing the string with `Date` and
 * cross-checking the round-trip — `Date.parse` happily coerces
 * out-of-range days into the next month, so the surface check alone
 * isn't enough.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

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

function checkDateTime(s: string): boolean {
  const m = DATE_TIME.exec(s);
  if (!m) return false;
  const [, y, mo, d, hh, mm, ss] = m;
  if (!isCalendarValid(Number(y), Number(mo), Number(d))) return false;
  const H = Number(hh);
  const M = Number(mm);
  const S = ss === undefined ? 0 : Number(ss);
  if (H > 23 || M > 59 || S > 59) return false;
  return true;
}

export function isIso8601DateOrDateTime(value: string): boolean {
  return checkDateOnly(value) || checkDateTime(value);
}

export function isW3CDateTime(value: string): boolean {
  return checkDateOnly(value) || checkDateTime(value);
}
