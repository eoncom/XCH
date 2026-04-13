/**
 * Validated resource identifiers for AccessOverride.
 * "*" = entire site, others = specific modules.
 *
 * This is the single source of truth. AccessOverride creation validates
 * against this list — any value outside it → 400 Bad Request.
 */
export const RESOURCES = [
  '*',
  'assets',
  'racks',
  'tasks',
  'plans',
  'contacts',
  'expenses',
  'monitoring',
] as const;

export type Resource = (typeof RESOURCES)[number];

export function isValidResource(value: string): value is Resource {
  return (RESOURCES as readonly string[]).includes(value);
}
