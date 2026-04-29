/**
 * Notification Events catalog (ADR-020).
 *
 * Ces enums DOIVENT rester alignés avec les enums Prisma `NotificationEventType`
 * et `NotificationChannelKind` (schema.prisma). Pour ajouter un event :
 *  1. Étendre l'enum TS ci-dessous.
 *  2. Étendre l'enum Prisma + nouvelle migration.
 *  3. Ajouter une entrée NOTIFICATION_EVENTS_META.
 */

import { NotificationEventType, NotificationChannelKind } from '@prisma/client';

// Re-export Prisma enums so the rest of the module reads from a single source.
export { NotificationEventType, NotificationChannelKind };

export interface NotificationEventMeta {
  label: string;
  description: string;
  defaultChannels: NotificationChannelKind[];
  category: 'tasks' | 'sites' | 'assets' | 'monitoring' | 'auth';
}

export const NOTIFICATION_EVENTS_META: Record<NotificationEventType, NotificationEventMeta> = {
  TASK_ASSIGNED: {
    label: 'Tâche assignée',
    description: 'Notification quand une tâche est assignée à un utilisateur',
    defaultChannels: [NotificationChannelKind.EMAIL],
    category: 'tasks',
  },
  TASK_STATUS_CHANGED: {
    label: 'Changement statut tâche',
    description: "Notification quand le statut d'une tâche change",
    defaultChannels: [NotificationChannelKind.EMAIL],
    category: 'tasks',
  },
  SITE_STATUS_CHANGED: {
    label: 'Changement statut site',
    description: "Notification quand le statut d'un site change (actif, fermé, etc.)",
    defaultChannels: [NotificationChannelKind.EMAIL, NotificationChannelKind.TEAMS],
    category: 'sites',
  },
  ASSET_CRITICAL: {
    label: 'Asset critique hors service',
    description: 'Notification quand un asset critique passe hors service',
    defaultChannels: [NotificationChannelKind.EMAIL, NotificationChannelKind.TEAMS],
    category: 'assets',
  },
  MONITOR_DOWN: {
    label: 'Monitor en panne',
    description: 'Notification quand un monitor natif passe à DOWN (ADR-014)',
    defaultChannels: [NotificationChannelKind.EMAIL, NotificationChannelKind.TEAMS],
    category: 'monitoring',
  },
  MONITOR_UP: {
    label: 'Monitor rétabli',
    description: 'Notification quand un monitor natif revient UP (ADR-014)',
    defaultChannels: [NotificationChannelKind.EMAIL],
    category: 'monitoring',
  },
  USER_INVITED: {
    label: 'Invitation utilisateur',
    description: "Email d'invitation envoyé à un nouvel utilisateur",
    defaultChannels: [NotificationChannelKind.EMAIL],
    category: 'auth',
  },
  PASSWORD_RESET: {
    label: 'Réinitialisation mot de passe',
    description: 'Email de réinitialisation de mot de passe',
    defaultChannels: [NotificationChannelKind.EMAIL],
    category: 'auth',
  },
};

/**
 * Payload sent through the queue. The processor enriches it with the
 * resolved channel configs at dispatch time.
 */
export interface NotificationPayload {
  tenantId: string;
  eventType: NotificationEventType;
  /** Scope context — used for rule resolution (delegation override). */
  scopeContext?: {
    siteId?: string;
    delegationId?: string;
  };
  /** Entity that triggered the notification. */
  entity: {
    type: string; // 'task', 'site', 'asset', 'user'
    id: string;
    name: string;
  };
  title: string;
  /** HTML body for email. */
  bodyHtml: string;
  /** Plain-text body for Teams. */
  bodyText: string;
  /** Link to the entity in XCH UI (relative path). */
  actionUrl?: string;
  metadata?: Record<string, any>;
  actor?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Plain runtime config passed to channel senders. webhookUrl + recipients
 * are already decrypted / plain at this point.
 */
export interface RuntimeChannelConfig {
  kind: NotificationChannelKind;
  recipients: string[];
  webhookUrl: string | null;
}
