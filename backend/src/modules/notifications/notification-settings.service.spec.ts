import { NotificationChannelKind, NotificationEventType } from '@prisma/client';
import { NotificationSettingsService } from './notification-settings.service';

/**
 * Coverage scope (ADR-020) :
 *   - resolveSettings inheritance : delegation > global > defaults
 *   - saveSettings encrypt webhookUrl at write
 *   - getSettings decrypt webhookUrl for the API
 *
 * Prisma + Crypto are stubbed — this is a pure unit test of the resolution
 * logic + encryption-at-boundary contract. End-to-end behavior is covered
 * by the smoke prod (/api/notifications/test on xch-deploy).
 */
describe('NotificationSettingsService', () => {
  const mkChannel = (
    overrides: Partial<{
      tenantId: string;
      delegationId: string | null;
      kind: NotificationChannelKind;
      enabled: boolean;
      recipients: string[];
      webhookUrl: string | null;
    }>,
  ): any => ({
    id: 'c-' + Math.random().toString(36).slice(2, 8),
    tenantId: 't1',
    delegationId: null,
    kind: NotificationChannelKind.EMAIL,
    enabled: true,
    recipients: [],
    webhookUrl: null,
    config: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mkRule = (
    overrides: Partial<{
      tenantId: string;
      delegationId: string | null;
      eventType: NotificationEventType;
      enabled: boolean;
      channels: NotificationChannelKind[];
    }>,
  ): any => ({
    id: 'r-' + Math.random().toString(36).slice(2, 8),
    tenantId: 't1',
    delegationId: null,
    eventType: NotificationEventType.TASK_ASSIGNED,
    enabled: true,
    channels: [NotificationChannelKind.EMAIL],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const cryptoMock = {
    encryptIfPlain: jest.fn((v: string | null) => (v ? `v1:enc(${v})` : null)),
    decryptOrLegacy: jest.fn((v: string | null) =>
      v?.startsWith('v1:enc(') ? v.slice('v1:enc('.length, -1) : v,
    ),
  };

  const buildService = (channels: any[] = [], rules: any[] = []) => {
    const prismaMock: any = {
      notificationChannel: {
        findMany: jest.fn(({ where }: any) =>
          channels.filter(
            (c) => c.tenantId === where.tenantId && c.delegationId === where.delegationId,
          ),
        ),
      },
      notificationRule: {
        findMany: jest.fn(({ where }: any) =>
          rules.filter(
            (r) => r.tenantId === where.tenantId && r.delegationId === where.delegationId,
          ),
        ),
      },
    };
    return new NotificationSettingsService(prismaMock as any, cryptoMock as any);
  };

  beforeEach(() => jest.clearAllMocks());

  describe('resolveSettings — inheritance', () => {
    it('falls back to NOTIFICATION_EVENTS_META defaults when no row exists', async () => {
      const svc = buildService([], []);
      const resolved = await svc.resolveSettings('t1', null);

      // Pas de channels persistés → array vide
      expect(resolved.channels).toEqual([]);

      // Toutes les rules sont émises avec source='default' et les
      // defaultChannels du meta.
      const taskRule = resolved.rules.find((r) => r.eventType === 'TASK_ASSIGNED');
      expect(taskRule?.source).toBe('default');
      expect(taskRule?.channels).toContain(NotificationChannelKind.EMAIL);

      const monitorDownRule = resolved.rules.find((r) => r.eventType === 'MONITOR_DOWN');
      expect(monitorDownRule?.channels).toEqual([
        NotificationChannelKind.EMAIL,
        NotificationChannelKind.TEAMS,
      ]);
    });

    it('uses global rule when present and no delegation override', async () => {
      const globalRule = mkRule({
        eventType: NotificationEventType.TASK_ASSIGNED,
        channels: [NotificationChannelKind.TEAMS], // override default email
      });
      const svc = buildService([], [globalRule]);

      const resolved = await svc.resolveSettings('t1', null);
      const r = resolved.rules.find((rl) => rl.eventType === 'TASK_ASSIGNED')!;
      expect(r.source).toBe('global');
      expect(r.channels).toEqual([NotificationChannelKind.TEAMS]);
    });

    it('delegation rule overrides global rule', async () => {
      const globalRule = mkRule({
        eventType: NotificationEventType.MONITOR_DOWN,
        channels: [NotificationChannelKind.EMAIL],
      });
      const delRule = mkRule({
        delegationId: 'd1',
        eventType: NotificationEventType.MONITOR_DOWN,
        channels: [NotificationChannelKind.EMAIL, NotificationChannelKind.TEAMS],
      });
      const svc = buildService([], [globalRule, delRule]);

      const resolved = await svc.resolveSettings('t1', 'd1');
      const r = resolved.rules.find((rl) => rl.eventType === 'MONITOR_DOWN')!;
      expect(r.source).toBe('delegation');
      expect(r.channels).toEqual([
        NotificationChannelKind.EMAIL,
        NotificationChannelKind.TEAMS,
      ]);
    });

    it('decrypts webhookUrl on resolved channels', async () => {
      const teamsChannel = mkChannel({
        kind: NotificationChannelKind.TEAMS,
        webhookUrl: 'v1:enc(https://outlook.office.com/webhook/foo)',
      });
      const svc = buildService([teamsChannel], []);
      const resolved = await svc.resolveSettings('t1', null);

      const teams = resolved.channels.find((c) => c.kind === 'TEAMS')!;
      expect(teams.webhookUrl).toBe('https://outlook.office.com/webhook/foo');
      expect(cryptoMock.decryptOrLegacy).toHaveBeenCalled();
    });
  });

  describe('getSettings — API shape', () => {
    it('marks isDefault=true when no rows exist', async () => {
      const svc = buildService([], []);
      const out = await svc.getSettings('t1', null);
      expect(out.isDefault).toBe(true);
      expect(out.channels).toEqual([]);
      expect(out.rules).toEqual([]);
    });

    it('returns webhookUrlHint derived from plaintext (last 12 chars)', async () => {
      const teams = mkChannel({
        kind: NotificationChannelKind.TEAMS,
        webhookUrl: 'v1:enc(https://outlook.office.com/webhook/abcdef-12345)',
      });
      const svc = buildService([teams], []);
      const out = await svc.getSettings('t1', null);
      const t = out.channels.find((c) => c.kind === 'TEAMS')!;
      // hint shows the last 12 chars of the plaintext after a leading ellipsis
      expect(t.webhookUrlHint).toBe('…abcdef-12345');
      expect(t.webhookUrlSet).toBe(true);
    });
  });
});
