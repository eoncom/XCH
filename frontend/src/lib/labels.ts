/**
 * Shared label helpers — translate internal enum values into user-facing French labels.
 * Keep the enum names as the source of truth in the DB; only the *display* string is
 * localised.
 */

import type { DelegationRight } from '@/types';

/**
 * DelegationRight → UX label.
 * The underlying enum stays MANAGE/WRITE/READ everywhere in the code; this helper
 * is used solely to format for display (profile card, sidebar badge, badges lists).
 */
export function rightLabel(right: DelegationRight | string | null | undefined): string {
  switch (right) {
    case 'MANAGE':
      return 'Administrateur';
    case 'WRITE':
      return 'Éditeur';
    case 'READ':
      return 'Lecteur';
    default:
      return right || '—';
  }
}

/**
 * Site health status label (FR).
 */
export function healthLabel(status: string | null | undefined): string {
  switch ((status || '').toUpperCase()) {
    case 'HEALTHY':
      return 'Sain';
    case 'WARNING':
      return 'Attention';
    case 'CRITICAL':
      return 'Critique';
    case 'UNKNOWN':
      return 'Inconnu';
    default:
      return status || '—';
  }
}

/**
 * Site operational status label (FR).
 */
export function siteStatusLabel(status: string | null | undefined): string {
  switch ((status || '').toUpperCase()) {
    case 'ACTIVE':
      return 'Actif';
    case 'PREPARATION':
      return 'En préparation';
    case 'CLOSED':
      return 'Clôturé';
    default:
      return status || '—';
  }
}

/**
 * AccessOverride scope / "portée" display — translates the internal `resource`
 * key ("*", "assets", "racks", ...) into a FR-friendly label.
 */
export function overrideScopeLabel(resource: string | null | undefined): string {
  const r = (resource || '*').toLowerCase();
  switch (r) {
    case '*':
      return 'Site entier';
    case 'assets':
      return 'Équipements';
    case 'racks':
      return 'Baies';
    case 'tasks':
      return 'Tâches';
    case 'plans':
    case 'floorplans':
      return 'Plans';
    case 'contacts':
      return 'Contacts';
    case 'expenses':
      return 'Dépenses';
    case 'monitoring':
      return 'Supervision';
    default:
      return resource || '—';
  }
}
