import { AuditLogEntry, auditCtxFrom } from './audit-log.service';
import { CallerCtx, SYSTEM_CTX } from '../types/caller-ctx.interface';

/**
 * Unit tests pour ADR-028 §B.3 helper `auditCtxFrom()` qui propage
 * `delegationId` + `ipAddress` + `userAgent` depuis CallerCtx vers
 * AuditLogEntry. Pas de DB nécessaire pour ces tests (pure helper).
 *
 * Tests integration end-to-end (PATCH /sites avec delegationId NOT NULL,
 * SYSTEM_CTX avec delegationId NULL) sont differred Track E.4 PR2 (test
 * environment Jest + Postgres seed required, scope hors PR1).
 */
describe('AuditLogEntry / auditCtxFrom helper (ADR-028 §B.0 + §B.3)', () => {
  describe('auditCtxFrom() — propagation depuis CallerCtx', () => {
    it('capture ctx complet (Option A actée Cat 3/4 + endpoints délégation-scoped)', () => {
      const ctx: CallerCtx = {
        userId: 'u1',
        tenantId: 't1',
        isSuperAdmin: false,
        activeDelegationId: 'd1',
        activeRight: 'WRITE',
        ipAddress: '203.0.113.5',
        userAgent: 'Mozilla/5.0',
      };

      const result = auditCtxFrom(ctx);

      expect(result).toEqual({
        delegationId: 'd1',
        ipAddress: '203.0.113.5',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('preserves null activeDelegationId (Cat 1/2/5 légitime) + null ip/ua', () => {
      const ctx: CallerCtx = {
        userId: 'admin',
        tenantId: 't1',
        isSuperAdmin: true,
        activeDelegationId: null,
        activeRight: null,
        ipAddress: null,
        userAgent: null,
      };

      const result = auditCtxFrom(ctx);

      expect(result.delegationId).toBeNull();
      expect(result.ipAddress).toBeNull();
      expect(result.userAgent).toBeNull();
    });

    it('handles SYSTEM_CTX (forced null per ADR-028 §B.0 mapping)', () => {
      const ctx = SYSTEM_CTX('cron-warranty-expiring', 'tenant-1');

      const result = auditCtxFrom(ctx);

      expect(result.delegationId).toBeNull();
      expect(result.ipAddress).toBeNull();
      expect(result.userAgent).toBeNull();
    });

    it('Cat 3 self-scoped — user sans délégation active → null capture (Option A)', () => {
      // Cas Option A acté §B.0.2 : user appelant /notifications/me sans
      // X-Delegation-Id sélectionné dans son UI = activeDelegationId null
      const ctx: CallerCtx = {
        userId: 'u1',
        tenantId: 't1',
        isSuperAdmin: false,
        activeDelegationId: null,  // user sans délégation active
        activeRight: null,
        ipAddress: '203.0.113.5',
        userAgent: 'Mozilla/5.0',
      };

      const result = auditCtxFrom(ctx);

      // Option A : null légitime sur Cat 3 si user sans délégation active
      expect(result.delegationId).toBeNull();
      // Mais IP/UA toujours capturés (ADR-028 §B.1 systématique)
      expect(result.ipAddress).toBe('203.0.113.5');
      expect(result.userAgent).toBe('Mozilla/5.0');
    });

    it('Cat 3 self-scoped — user avec délégation active → capture (Option A)', () => {
      // Cas Option A acté §B.0.2 : user appelant /notifications/me avec
      // X-Delegation-Id présent = capture pour traçabilité forensique
      const ctx: CallerCtx = {
        userId: 'u1',
        tenantId: 't1',
        isSuperAdmin: false,
        activeDelegationId: 'd2',  // user a sélectionné délégation
        activeRight: 'READ',
        ipAddress: '203.0.113.5',
        userAgent: 'Mozilla/5.0',
      };

      const result = auditCtxFrom(ctx);

      // Option A : capture même si endpoint @SkipDelegation Cat 3
      expect(result.delegationId).toBe('d2');
    });
  });

  describe('AuditLogEntry interface — nullability discipline figée', () => {
    it('accepts entry with all new fields (delegationId + ipAddress + userAgent)', () => {
      const entry: AuditLogEntry = {
        tenantId: 't1',
        userId: 'u1',
        action: 'CREATE',
        entityType: 'site',
        entityId: 'site-1',
        changes: { after: { name: 'New Site' } },
        delegationId: 'd1',
        ipAddress: '203.0.113.5',
        userAgent: 'Mozilla/5.0',
      };

      // Type-only assertion : compile-time check
      expect(entry.delegationId).toBe('d1');
    });

    it('accepts entry without optional fields (backward-compat)', () => {
      const entry: AuditLogEntry = {
        tenantId: 't1',
        userId: 'u1',
        action: 'UPDATE',
        entityType: 'site',
        entityId: 'site-1',
        changes: { before: { name: 'A' }, after: { name: 'B' } },
        // delegationId, ipAddress, userAgent omis : tier-2 propagation Track F
      };

      expect(entry.delegationId).toBeUndefined();
    });
  });
});
