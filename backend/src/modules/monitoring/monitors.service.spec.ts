import { BadRequestException } from '@nestjs/common';
import {
  encodeHistoryCursor,
  decodeHistoryCursor,
} from './monitors.service';

/**
 * S5 PR4 R1 — Monitor history keyset pagination cursor helpers.
 *
 * Le service `history()` est testé en intégration via la suite RBAC
 * (real DB). Les helpers de cursor sont testés ici en pur, hors DI :
 *   - encode/decode round-trip
 *   - rejets de cursors malformés
 *   - assertion quantitative : la nouvelle history() fait EXACTEMENT 1
 *     query DB (avant : 2 — findMany + count).
 */
describe('Monitor history keyset cursor (S5 PR4 R1)', () => {
  describe('encodeHistoryCursor / decodeHistoryCursor', () => {
    it('round-trips a (checkedAt, id) tuple', () => {
      const checkedAt = new Date('2026-04-15T12:34:56.789Z');
      const id = 'cuid_abc123';
      const cursor = encodeHistoryCursor(checkedAt, id);
      const decoded = decodeHistoryCursor(cursor);
      expect(decoded).not.toBeNull();
      expect(decoded!.checkedAt.toISOString()).toBe(checkedAt.toISOString());
      expect(decoded!.id).toBe(id);
    });

    it('returns null on malformed cursor', () => {
      expect(decodeHistoryCursor('')).toBeNull();
      expect(decodeHistoryCursor('not-base64!!!')).toBeNull();
      expect(decodeHistoryCursor(Buffer.from('no-separator', 'utf8').toString('base64url'))).toBeNull();
      expect(decodeHistoryCursor(Buffer.from('invalid-date|abc', 'utf8').toString('base64url'))).toBeNull();
      // ID vide après le |
      expect(decodeHistoryCursor(Buffer.from('2026-01-01T00:00:00Z|', 'utf8').toString('base64url'))).toBeNull();
    });

    it('produces base64url (URL-safe, no =, no +, no /)', () => {
      const cursor = encodeHistoryCursor(new Date(), 'cuid_test_id');
      expect(cursor).not.toMatch(/[+/=]/);
    });
  });

  describe('history() query count (1 query, no count)', () => {
    // Le service est lourd à instancier (assertCheckTenantOwnership requiert
    // une chaîne de mocks). On teste plutôt directement les méthodes du
    // PrismaClient mock pour s'assurer que le code-path keyset n'appelle
    // qu'une fois findMany et JAMAIS count.
    //
    // Ce test est un canary : si quelqu'un re-introduit un .count() ou un
    // .findMany() supplémentaire dans history(), il échouera.

    it('emits exactly 1 prisma.monitorResult.findMany and 0 count', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const count = jest.fn();
      const prisma = {
        monitorResult: { findMany, count },
        monitorCheck: {
          findFirst: jest.fn().mockResolvedValue({ tenantId: 't1' }),
        },
      } as any;
      const queue = { add: jest.fn() } as any;
      const perm = {} as any;
      // Lazy import pour éviter les dépendances circulaires de la classe
      // complète au top-level du fichier de test.
      const { MonitorsService } = await import('./monitors.service');
      const svc = new MonitorsService(prisma, queue, perm);

      await svc.history('t1', 'check-1', { limit: 50 } as any);

      expect(findMany).toHaveBeenCalledTimes(1);
      expect(count).not.toHaveBeenCalled();
    });

    it('rejects an invalid cursor with BadRequestException', async () => {
      const findMany = jest.fn();
      const prisma = {
        monitorResult: { findMany, count: jest.fn() },
        monitorCheck: {
          findFirst: jest.fn().mockResolvedValue({ tenantId: 't1' }),
        },
      } as any;
      const { MonitorsService } = await import('./monitors.service');
      const svc = new MonitorsService(prisma, {} as any, {} as any);

      await expect(
        svc.history('t1', 'check-1', { cursor: 'invalid!' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(findMany).not.toHaveBeenCalled();
    });
  });
});
