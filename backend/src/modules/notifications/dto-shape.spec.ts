import { instanceToPlain } from 'class-transformer';
import { NotificationChannelKind, NotificationEventType } from '@prisma/client';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { NotificationChannelResponseDto } from './dto/notification-channel.response.dto';
import {
  NotificationRuleResponseDto,
  NotificationResolvedRuleResponseDto,
} from './dto/notification-rule.response.dto';
import {
  NotificationSettingsResponseDto,
  NotificationAllSettingsResponseDto,
} from './dto/notification-settings.response.dto';
import { NotificationResolvedSettingsResponseDto } from './dto/notification-resolved-settings.response.dto';
import {
  NotificationMetaResponseDto,
  toNotificationMetaResponseDto,
} from './dto/notification-meta.response.dto';
import { NotificationLogPageResponseDto } from './dto/notification-log.response.dto';
import {
  NotificationDeleteSettingsResponseDto,
  NotificationTestResultResponseDto,
} from './dto/notification-action.response.dto';
import {
  UserNotificationResponseDto,
  UserNotificationMarkAllReadResponseDto,
  UserNotificationRemoveResponseDto,
} from './dto/user-notification.response.dto';

/**
 * S9 ADR-023 — Notifications response DTO shape verification.
 * Same pattern as monitoring + connectivity pivots.
 */
describe('Notifications response DTO shapes', () => {
  describe('NotificationChannelResponseDto (Cas A — API-shaped channel)', () => {
    const apiShaped = {
      id: 'ch-1',
      kind: NotificationChannelKind.TEAMS,
      enabled: true,
      recipients: [],
      webhookUrl: 'https://outlook.office.com/webhook/abc123',
      webhookUrlSet: true,
      webhookUrlHint: '…webhook/abc1',
      // Extraneous / sensitive — must NOT leak.
      _encryptedBlob: 'v1:lkjsdfqlksdj',
      tenantId: 'tnt-1',
      delegationId: null,
    };

    it('exposes API fields and strips internal columns', () => {
      const dto = toResponse(NotificationChannelResponseDto, apiShaped);
      expect(dto).toHaveProperty('id', 'ch-1');
      expect(dto).toHaveProperty('kind', NotificationChannelKind.TEAMS);
      expect(dto).toHaveProperty('webhookUrlHint', '…webhook/abc1');
      expect(dto).not.toHaveProperty('_encryptedBlob');
      expect(dto).not.toHaveProperty('tenantId');
      expect(dto).not.toHaveProperty('delegationId');
    });

    it('runtime serialization does not leak the encrypted blob', () => {
      const dto = toResponse(NotificationChannelResponseDto, apiShaped);
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/_encryptedBlob/);
      expect(wireJson).not.toMatch(/v1:/);
    });
  });

  describe('NotificationRule + ResolvedRule', () => {
    it('regular rule shape', () => {
      const dto = toResponse(NotificationRuleResponseDto, {
        id: 'r-1',
        eventType: NotificationEventType.TASK_ASSIGNED,
        enabled: true,
        channels: [NotificationChannelKind.EMAIL],
        _internal: 'leak',
      });
      expect(dto).toHaveProperty('id', 'r-1');
      expect(dto.channels).toEqual([NotificationChannelKind.EMAIL]);
      expect(dto).not.toHaveProperty('_internal');
    });

    it('resolved rule includes source flag', () => {
      const dto = toResponse(NotificationResolvedRuleResponseDto, {
        eventType: NotificationEventType.SITE_STATUS_CHANGED,
        enabled: true,
        channels: [NotificationChannelKind.EMAIL, NotificationChannelKind.TEAMS],
        source: 'delegation',
      });
      expect(dto).toHaveProperty('source', 'delegation');
      expect(dto.channels).toHaveLength(2);
    });
  });

  describe('NotificationSettingsResponseDto (Cas C composite)', () => {
    const composite = {
      scope: { tenantId: 'tnt-1', delegationId: null, _hidden: 'leak' },
      channels: [
        {
          id: 'ch-1',
          kind: NotificationChannelKind.EMAIL,
          enabled: true,
          recipients: ['ops@example.com'],
          webhookUrl: null,
          webhookUrlSet: false,
          webhookUrlHint: null,
        },
      ],
      rules: [
        {
          id: 'r-1',
          eventType: NotificationEventType.TASK_ASSIGNED,
          enabled: true,
          channels: [NotificationChannelKind.EMAIL],
        },
      ],
      isDefault: false,
      _internalAuditTimestamp: new Date(),
    };

    it('composes scope + channels + rules and strips extraneous', () => {
      const dto = toResponse(NotificationSettingsResponseDto, composite);
      expect(dto.scope).toHaveProperty('tenantId', 'tnt-1');
      expect(dto.scope).not.toHaveProperty('_hidden');
      expect(dto.channels).toHaveLength(1);
      expect(dto.rules).toHaveLength(1);
      expect(dto).toHaveProperty('isDefault', false);
      expect(dto).not.toHaveProperty('_internalAuditTimestamp');
    });

    it('runtime serialization is leak-free', () => {
      const dto = toResponse(NotificationSettingsResponseDto, composite);
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/_hidden/);
      expect(wireJson).not.toMatch(/_internalAuditTimestamp/);
    });
  });

  describe('NotificationAllSettingsResponseDto', () => {
    it('exposes channels + rules arrays', () => {
      const dto = toResponse(NotificationAllSettingsResponseDto, {
        channels: [],
        rules: [],
      });
      expect(dto.channels).toEqual([]);
      expect(dto.rules).toEqual([]);
    });
  });

  describe('NotificationResolvedSettingsResponseDto', () => {
    const resolved = {
      channels: [
        {
          kind: NotificationChannelKind.EMAIL,
          recipients: ['ops@example.com'],
          webhookUrl: null,
          enabled: true,
        },
      ],
      rules: [
        {
          eventType: NotificationEventType.MONITOR_DOWN,
          enabled: true,
          channels: [NotificationChannelKind.EMAIL],
          source: 'default',
        },
      ],
    };

    it('exposes runtime channels + resolved rules', () => {
      const dto = toResponse(NotificationResolvedSettingsResponseDto, resolved);
      expect(dto.channels).toHaveLength(1);
      expect(dto.channels[0]).toHaveProperty('kind', NotificationChannelKind.EMAIL);
      expect(dto.rules[0]).toHaveProperty('source', 'default');
    });
  });

  describe('NotificationMetaResponseDto (Cas B helper)', () => {
    const meta = toNotificationMetaResponseDto({
      events: {
        [NotificationEventType.TASK_ASSIGNED]: {
          label: 'Tâche assignée',
          description: 'Notification quand une tâche est assignée',
          defaultChannels: [NotificationChannelKind.EMAIL],
          category: 'tasks' as const,
        },
      } as NotificationMetaResponseDto['events'],
      channels: [
        { kind: NotificationChannelKind.EMAIL, label: 'Email' },
        { kind: NotificationChannelKind.TEAMS, label: 'Microsoft Teams' },
      ],
    });

    it('preserves the events record + available channels list', () => {
      expect(meta.events).toHaveProperty(NotificationEventType.TASK_ASSIGNED);
      expect(meta.channels).toHaveLength(2);
      expect(meta.channels[1]).toHaveProperty('label', 'Microsoft Teams');
    });
  });

  describe('NotificationLogPageResponseDto', () => {
    const page = {
      data: [
        {
          id: 'l-1',
          tenantId: 'tnt-1',
          eventType: 'TASK_ASSIGNED',
          channel: 'email',
          delegationId: null,
          recipient: 'ops@example.com',
          subject: 'New task',
          success: true,
          errorMessage: null,
          context: { taskId: 't-1' },
          createdAt: new Date(),
          // Extraneous.
          _internalProcessTime: 42,
        },
      ],
      meta: { total: 1, page: 1, pageSize: 25, totalPages: 1, _hidden: 'leak' },
    };

    it('maps data + meta and strips extraneous', () => {
      const dto = toResponse(NotificationLogPageResponseDto, page);
      expect(dto.data).toHaveLength(1);
      expect(dto.data[0]).toHaveProperty('eventType', 'TASK_ASSIGNED');
      expect(dto.data[0]).not.toHaveProperty('_internalProcessTime');
      expect(dto.meta).toHaveProperty('total', 1);
      expect(dto.meta).not.toHaveProperty('_hidden');
    });

    it('runtime JSON wire payload is leak-free', () => {
      const dto = toResponse(NotificationLogPageResponseDto, page);
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/_internalProcessTime/);
      expect(wireJson).not.toMatch(/_hidden/);
    });
  });

  describe('Action result shapes', () => {
    it('NotificationDeleteSettingsResponseDto exposes counts only', () => {
      const dto = toResponse(NotificationDeleteSettingsResponseDto, {
        deletedChannels: 2,
        deletedRules: 8,
        _txDuration: 0.4,
      });
      expect(dto).toEqual({ deletedChannels: 2, deletedRules: 8 });
    });

    it('NotificationTestResultResponseDto exposes success + optional error', () => {
      expect(
        toResponse(NotificationTestResultResponseDto, { success: true }),
      ).toEqual({ success: true });
      expect(
        toResponse(NotificationTestResultResponseDto, {
          success: false,
          error: 'SMTP refused',
          _internalDelay: 1234,
        }),
      ).toEqual({ success: false, error: 'SMTP refused' });
    });
  });

  describe('UserNotification shapes', () => {
    const userNotif = {
      id: 'un-1',
      tenantId: 'tnt-1',
      userId: 'usr-1',
      type: 'WARRANTY_EXPIRING',
      title: 'Garantie bientôt expirée',
      body: 'Expire le 2026-06-01',
      link: '/dashboard/assets/ast-1',
      readAt: null,
      createdAt: new Date('2026-05-04T10:00:00Z'),
      // Extraneous.
      _bull_meta: { jobId: 'job-99' },
    };

    it('exposes user-notification scalars', () => {
      const dto = toResponse(UserNotificationResponseDto, userNotif);
      expect(dto).toHaveProperty('id', 'un-1');
      expect(dto).toHaveProperty('type', 'WARRANTY_EXPIRING');
      expect(dto.readAt).toBeNull();
      expect(dto).not.toHaveProperty('_bull_meta');
    });

    it('toResponseArray maps a list', () => {
      const list = toResponseArray(UserNotificationResponseDto, [userNotif, userNotif]);
      expect(list).toHaveLength(2);
      expect(list[0]).toHaveProperty('id', 'un-1');
    });

    it('UserNotificationMarkAllReadResponseDto exposes updated count', () => {
      expect(
        toResponse(UserNotificationMarkAllReadResponseDto, { updated: 7, _txTime: 0.2 }),
      ).toEqual({ updated: 7 });
    });

    it('UserNotificationRemoveResponseDto exposes numeric deleted', () => {
      expect(
        toResponse(UserNotificationRemoveResponseDto, { deleted: 1, _internal: 'leak' }),
      ).toEqual({ deleted: 1 });
      expect(toResponse(UserNotificationRemoveResponseDto, { deleted: 0 })).toEqual({
        deleted: 0,
      });
    });
  });
});
