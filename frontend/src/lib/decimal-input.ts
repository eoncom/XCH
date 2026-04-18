/**
 * Decimal input utilities for forms.
 *
 * HTML `<input type="number">` rejects the French decimal separator (comma)
 * on most locales, which blocks operators from typing values like "3,5" for
 * weight in kg or "0,001" for a precise power reading copied from a datasheet.
 * v1.4.x UX fix: use `<input type="text" inputMode="decimal">` in forms and
 * let react-hook-form normalise the string via `setValueAs: parseDecimalInput`.
 *
 * - Accepts both `,` (FR) and `.` (EN/default) as decimal separator.
 * - Trims surrounding whitespace.
 * - Returns `undefined` for empty / unparseable input (so the field is
 *   serialised as absent rather than `NaN`).
 * - Preserves arbitrary precision — no implicit rounding.
 */
export function parseDecimalInput(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const cleaned = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return undefined;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Same as parseDecimalInput, but rounds to an integer. Use for fields where
 * fractional values have no meaning (e.g. dBm, U height, port count).
 */
export function parseIntegerInput(value: unknown): number | undefined {
  const n = parseDecimalInput(value);
  if (n === undefined) return undefined;
  return Math.round(n);
}
