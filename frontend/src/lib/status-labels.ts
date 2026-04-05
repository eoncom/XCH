/**
 * Centralized status labels for the entire application.
 * Single source of truth for health, monitor, task, and priority labels.
 * Will become the source for i18n translation keys in Phase 4.
 */

// ============================================================================
// Health Status (Site-level)
// ============================================================================

export const healthStatusLabels: Record<string, string> = {
  HEALTHY: 'Sain',
  WARNING: 'Attention',
  CRITICAL: 'Critique',
  UNKNOWN: 'Inconnu',
};

export const healthStatusColors: Record<string, { text: string; bg: string; dot: string; border: string }> = {
  HEALTHY: {
    text: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/30',
    dot: 'bg-green-500',
    border: 'border-l-green-500',
  },
  WARNING: {
    text: 'text-amber-600',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    dot: 'bg-amber-500',
    border: 'border-l-amber-500',
  },
  CRITICAL: {
    text: 'text-red-600',
    bg: 'bg-red-100 dark:bg-red-900/30',
    dot: 'bg-red-500',
    border: 'border-l-red-500',
  },
  UNKNOWN: {
    text: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800/30',
    dot: 'bg-gray-400',
    border: 'border-l-gray-400',
  },
};

// ============================================================================
// Monitor Status (Component-level: links, sdwan, assets)
// ============================================================================

export const monitorStatusLabels: Record<string, string> = {
  up: 'Opérationnel',
  down: 'En panne',
  degraded: 'Dégradé',
  maintenance: 'Maintenance',
  unknown: 'Inconnu',
};

export const monitorStatusColors: Record<string, string> = {
  up: 'text-green-600',
  down: 'text-red-600',
  degraded: 'text-amber-600',
  maintenance: 'text-blue-600',
  unknown: 'text-gray-500',
};

// ============================================================================
// Task Status
// ============================================================================

export const taskStatusLabels: Record<string, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  BLOCKED: 'Bloqué',
  DONE: 'Terminé',
  CANCELLED: 'Annulé',
};

export const taskStatusColors: Record<string, string> = {
  TODO: 'secondary',
  IN_PROGRESS: 'default',
  BLOCKED: 'error',
  DONE: 'success',
  CANCELLED: 'secondary',
};

// ============================================================================
// Task Priority
// ============================================================================

export const taskPriorityLabels: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  URGENT: 'Urgente',
};

export const taskPriorityColors: Record<string, string> = {
  LOW: 'secondary',
  MEDIUM: 'default',
  HIGH: 'warning',
  URGENT: 'error',
};

// ============================================================================
// Site Status
// ============================================================================

export const siteStatusLabels: Record<string, string> = {
  PREPARATION: 'Préparation',
  ACTIVE: 'Actif',
  CLOSED: 'Fermé',
};

export const siteStatusColors: Record<string, string> = {
  PREPARATION: 'warning',
  ACTIVE: 'success',
  CLOSED: 'secondary',
};
