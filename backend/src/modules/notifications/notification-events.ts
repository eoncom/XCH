/**
 * Notification Events — Central definition of all notification event types.
 * Extensible: add new events here, they auto-appear in config UI.
 */

export enum NotificationEventType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
  SITE_STATUS_CHANGED = 'SITE_STATUS_CHANGED',
  ASSET_CRITICAL = 'ASSET_CRITICAL',
  MONITORING_ALERT = 'MONITORING_ALERT',
  USER_INVITED = 'USER_INVITED',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export enum NotificationChannel {
  EMAIL = 'email',
  TEAMS = 'teams',
}

export interface NotificationEventMeta {
  label: string;
  description: string;
  defaultChannels: NotificationChannel[];
  category: 'tasks' | 'sites' | 'assets' | 'monitoring' | 'auth';
}

export const NOTIFICATION_EVENTS: Record<NotificationEventType, NotificationEventMeta> = {
  [NotificationEventType.TASK_ASSIGNED]: {
    label: 'Tâche assignée',
    description: 'Notification quand une tâche est assignée à un utilisateur',
    defaultChannels: [NotificationChannel.EMAIL],
    category: 'tasks',
  },
  [NotificationEventType.TASK_STATUS_CHANGED]: {
    label: 'Changement statut tâche',
    description: 'Notification quand le statut d\'une tâche change',
    defaultChannels: [NotificationChannel.EMAIL],
    category: 'tasks',
  },
  [NotificationEventType.SITE_STATUS_CHANGED]: {
    label: 'Changement statut site',
    description: 'Notification quand le statut d\'un site change (actif, fermé, etc.)',
    defaultChannels: [NotificationChannel.EMAIL, NotificationChannel.TEAMS],
    category: 'sites',
  },
  [NotificationEventType.ASSET_CRITICAL]: {
    label: 'Asset critique hors service',
    description: 'Notification quand un asset critique passe hors service',
    defaultChannels: [NotificationChannel.EMAIL, NotificationChannel.TEAMS],
    category: 'assets',
  },
  [NotificationEventType.MONITORING_ALERT]: {
    label: 'Alerte monitoring',
    description: 'Notification lors d\'un changement de health status',
    defaultChannels: [NotificationChannel.EMAIL, NotificationChannel.TEAMS],
    category: 'monitoring',
  },
  [NotificationEventType.USER_INVITED]: {
    label: 'Invitation utilisateur',
    description: 'Email d\'invitation envoyé à un nouvel utilisateur',
    defaultChannels: [NotificationChannel.EMAIL],
    category: 'auth',
  },
  [NotificationEventType.PASSWORD_RESET]: {
    label: 'Réinitialisation mot de passe',
    description: 'Email de réinitialisation de mot de passe',
    defaultChannels: [NotificationChannel.EMAIL],
    category: 'auth',
  },
};

/** Payload sent to notification channels */
export interface NotificationPayload {
  tenantId: string;
  eventType: NotificationEventType;
  /** Scope context — used for config resolution */
  scopeContext?: {
    siteId?: string;
    delegationId?: string;
  };
  /** Entity that triggered the notification */
  entity: {
    type: string; // 'task', 'site', 'asset', 'user'
    id: string;
    name: string;
  };
  /** Human-readable title */
  title: string;
  /** Human-readable body (HTML for email, plain for Teams) */
  bodyHtml: string;
  bodyText: string;
  /** Link to the entity in XCH UI */
  actionUrl?: string;
  /** Additional context */
  metadata?: Record<string, any>;
  /** Actor who triggered the event */
  actor?: {
    id: string;
    name: string;
    email: string;
  };
}

/** Channel config shape */
export interface ChannelConfig {
  inherit: boolean;
  enabled: boolean;
  // Channel-specific
  recipients?: string[]; // email
  webhookUrl?: string;   // teams
}

/** Event config shape */
export interface EventConfig {
  inherit: boolean;
  enabled: boolean;
  channels: NotificationChannel[];
}

/** Full notification config shape (stored in DB as JSON) */
export interface NotificationChannelsConfig {
  email: ChannelConfig;
  teams: ChannelConfig;
}

export interface NotificationEventsConfig {
  [key: string]: EventConfig;
}

/** Default tenant-level config */
export function getDefaultConfig(): { channels: NotificationChannelsConfig; events: NotificationEventsConfig } {
  return {
    channels: {
      email: { inherit: false, enabled: true, recipients: [] },
      teams: { inherit: false, enabled: false, webhookUrl: '' },
    },
    events: Object.fromEntries(
      Object.entries(NOTIFICATION_EVENTS).map(([key, meta]) => [
        key,
        {
          inherit: false,
          enabled: true,
          channels: meta.defaultChannels,
        },
      ]),
    ),
  };
}
