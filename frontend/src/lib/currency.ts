/**
 * Single source of truth for money formatting across XCH.
 *
 * Always use `formatCurrency` (or the `<Currency>` component) instead of
 * ad-hoc `.toFixed(2) + ' EUR'` / local `Intl.NumberFormat` helpers — keeps
 * decimals, thousand separators, and the currency symbol consistent across
 * every screen.
 */

const DEFAULT_CURRENCY = 'EUR';
const DEFAULT_LOCALE = 'fr-FR';

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string | null | undefined = DEFAULT_CURRENCY,
  opts: { locale?: string; signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero' } = {},
): string {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(opts.locale ?? DEFAULT_LOCALE, {
      style: 'currency',
      currency: currency || DEFAULT_CURRENCY,
      signDisplay: opts.signDisplay ?? 'auto',
    }).format(n);
  } catch {
    // Fall back to a neutral "amount CUR" if the currency code is invalid
    // (e.g. a tenant typed 'eur' lowercase into the DB). Keeps the UI alive.
    return `${n.toFixed(2)} ${currency || DEFAULT_CURRENCY}`;
  }
}

/**
 * Format a monthly price with an explicit "/mois" suffix in French. Use this
 * instead of formatting a price + appending '/mois' inline so the spacing and
 * the amount stay tied together.
 */
export function formatMonthlyPrice(
  amount: number | string | null | undefined,
  currency: string | null | undefined = DEFAULT_CURRENCY,
): string {
  const base = formatCurrency(amount, currency);
  if (base === '—') return base;
  return `${base}/mois`;
}
