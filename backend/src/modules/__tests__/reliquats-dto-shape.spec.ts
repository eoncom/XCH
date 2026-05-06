import { instanceToPlain } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { toResponse } from '../../common/utils/to-response.util';

import { AccessOverrideResponseDto } from '../access-overrides/dto/access-override.response.dto';
import { ContactTypeResponseDto } from '../contact-types/dto/contact-type.response.dto';
import { ContactResponseDto } from '../contacts/dto/contact.response.dto';
import { ContactListResponseDto } from '../contacts/dto/contact-list.response.dto';
import { SdwanConfigResponseDto } from '../sdwan/dto/sdwan-config.response.dto';
import { UserDelegationResponseDto } from '../user-delegations/dto/user-delegation.response.dto';
import { SeedDemoResponseDto } from '../seed/dto/seed.response.dto';
import { SetupStatusResponseDto } from '../setup/dto/setup.response.dto';

import {
  toEnumLabelMapResponseDto,
  toEnumLabelDefaultsMapResponseDto,
} from '../admin/dto/enum-label.response.dto';
import { AuditLogListResponseDto } from '../audit/dto/audit-log-list.response.dto';
import {
  toConsumptionRackResponseDto,
  toConsumptionSiteResponseDto,
  toConsumptionSummaryResponseDto,
} from '../consumption/dto/consumption.response.dto';
import { toSearchResponseDto } from '../search/dto/search.response.dto';
import { DelegationTreeNodeResponseDto } from '../organization/dto/delegation.response.dto';
import { BudgetResponseDto } from '../budgets/dto/budget.response.dto';
import { BudgetStatusResponseDto } from '../budgets/dto/budget-status.response.dto';

/**
 * S9 PR #16 — reliquats response-DTO discipline. Single spec covering
 * the 13 grouped modules. The 5 non-trivial modules get full inclusion +
 * runtime smoke (instanceToPlain → JSON.stringify) anti-leak coverage;
 * the 8 marker / Prisma-scalar modules get a short inclusion + drop test.
 */

const wireShape = (dto: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(instanceToPlain(dto))) as Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────
// 8 marker / scalar modules — light-touch tests
// ─────────────────────────────────────────────────────────────────────

describe('Reliquats — markers + scalar Prisma entities', () => {
  describe('AccessOverrideResponseDto', () => {
    it('exposes scalars + typed user/site refs and drops contamination', () => {
      const dto = toResponse(AccessOverrideResponseDto, {
        id: 'ao-1',
        tenantId: 'tnt-1',
        userId: 'usr-1',
        siteId: 'site-1',
        resource: '*',
        effect: 'ALLOW',
        permission: 'WRITE',
        label: 'Override pilote',
        grantedBy: 'usr-admin',
        grantedAt: new Date('2026-05-01'),
        expiresAt: null,
        user: { id: 'usr-1', name: 'Tech', email: 't@demo.fr', _hidden: 'leak', passwordHash: 'never' },
        site: { id: 'site-1', name: 'Saclay', _hidden: 'leak' },
      });
      expect(dto.id).toBe('ao-1');
      expect(dto.user).toEqual({ id: 'usr-1', name: 'Tech', email: 't@demo.fr' });
      expect(dto.site).toEqual({ id: 'site-1', name: 'Saclay' });
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/passwordHash/);
      expect(wire).not.toMatch(/_hidden/);
    });
  });

  describe('ContactTypeResponseDto', () => {
    it('exposes legitimate scalars only', () => {
      const dto = toResponse(ContactTypeResponseDto, {
        id: 'ct-1',
        tenantId: 'tnt-1',
        name: 'Telecom',
        slug: 'telecom',
        category: 'TECHNICAL',
        color: '#3b82f6',
        icon: 'Phone',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _internal: 'leak',
      });
      expect(dto.name).toBe('Telecom');
      expect(dto.isSystem).toBe(true);
      expect(dto).not.toHaveProperty('_internal');
    });
  });

  describe('ContactResponseDto', () => {
    it('exposes scalars + typed contact-type ref', () => {
      const dto = toResponse(ContactResponseDto, {
        id: 'c-1',
        tenantId: 'tnt-1',
        name: 'Jean Tech',
        typeId: 'ct-1',
        email: 'jean@demo.fr',
        phone: '+33',
        mobile: null,
        address: null,
        company: 'Acme',
        role: 'Admin réseau',
        isPrimary: false,
        notes: null,
        isActive: true,
        delegationId: 'd-1',
        siteId: 'site-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        type: { id: 'ct-1', name: 'Telecom', slug: 'telecom', category: 'TECHNICAL', color: '#3b82f6', icon: 'Phone', _hidden: 'leak' },
        _internal: 'should-drop',
      });
      expect(dto.name).toBe('Jean Tech');
      expect(dto.type).toEqual({ id: 'ct-1', name: 'Telecom', slug: 'telecom', category: 'TECHNICAL', color: '#3b82f6', icon: 'Phone' });
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/_internal/);
      expect(wire).not.toMatch(/_hidden/);
    });
  });

  describe('ContactListResponseDto', () => {
    it('wraps paginated data + meta with typed items', () => {
      const dto = toResponse(ContactListResponseDto, {
        data: [
          { id: 'c-1', tenantId: 'tnt-1', name: 'A', typeId: 'ct-1', isPrimary: false, isActive: true, createdAt: new Date(), updatedAt: new Date(), _hidden: 'leak' },
        ],
        meta: { total: 1, page: 1, pageSize: 25, totalPages: 1 },
      });
      expect(dto.data).toHaveLength(1);
      expect(dto.data[0].name).toBe('A');
      expect(dto.meta).toEqual({ total: 1, page: 1, pageSize: 25, totalPages: 1 });
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/_hidden/);
    });
  });

  describe('SdwanConfigResponseDto', () => {
    it('exposes config scalars + firewalls[] with typed asset refs', () => {
      const dto = toResponse(SdwanConfigResponseDto, {
        id: 's-1',
        tenantId: 'tnt-1',
        siteId: 'site-1',
        enabled: true,
        provider: 'FortiManager',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        firewalls: [
          {
            id: 'sf-1',
            sdwanConfigId: 's-1',
            assetId: 'a-1',
            role: 'active',
            createdAt: new Date(),
            asset: {
              id: 'a-1',
              name: 'FW-1',
              type: 'FIREWALL',
              serialNumber: 'SN-1',
              status: 'IN_SERVICE',
              ip: '10.0.0.1',
              mac: '00:11:22:33:44:55',
              hostname: 'fw1',
              vlan: 'V100',
              port: 'wan1',
              passwordHash: 'never',
              _hidden: 'leak',
            },
          },
        ],
      });
      expect(dto.firewalls).toHaveLength(1);
      const fw = dto.firewalls[0];
      expect(fw.asset.name).toBe('FW-1');
      expect(fw.asset).not.toHaveProperty('passwordHash');
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/passwordHash/);
      expect(wire).not.toMatch(/_hidden/);
    });
  });

  describe('UserDelegationResponseDto', () => {
    it('exposes scalars + typed user/delegation refs and drops sensitive contamination', () => {
      const dto = toResponse(UserDelegationResponseDto, {
        id: 'ud-1',
        tenantId: 'tnt-1',
        userId: 'usr-1',
        delegationId: 'd-1',
        right: 'WRITE',
        grantedBy: 'manual',
        grantedAt: new Date(),
        user: { id: 'usr-1', name: 'Tech', email: 't@demo.fr', active: true, lastLoginAt: new Date(), passwordHash: 'never', totpSecret: 'JBSW', _hidden: 'leak' },
        delegation: { id: 'd-1', name: 'IDF', code: 'IDF', groupLabel: 'Régions', groupColor: '#0070f3', isActive: true },
      });
      expect(dto.right).toBe('WRITE');
      expect(dto.user?.email).toBe('t@demo.fr');
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/passwordHash/);
      expect(wire).not.toMatch(/totpSecret/);
      expect(wire).not.toMatch(/_hidden/);
    });
  });

  describe('SeedDemoResponseDto', () => {
    it('exposes message + per-entity counts (non-sensitive metadata)', () => {
      const dto = toResponse(SeedDemoResponseDto, {
        message: 'Données démo chargées',
        stats: { sites: 3, users: 12, assets: 80, racks: 6, tasks: 25, contactTypes: 4, contacts: 18 },
      });
      expect(dto.message).toBe('Données démo chargées');
      expect(dto.stats.sites).toBe(3);
      expect(dto.stats.users).toBe(12);
    });
  });

  describe('SetupStatusResponseDto', () => {
    it('exposes needsSetup + services array', () => {
      const dto = toResponse(SetupStatusResponseDto, {
        needsSetup: true,
        services: [
          { name: 'PostgreSQL', status: 'ok' },
          { name: 'Redis', status: 'error', message: 'timeout' },
        ],
      });
      expect(dto.needsSetup).toBe(true);
      expect(dto.services).toHaveLength(2);
      expect(dto.services[1].message).toBe('timeout');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5 non-trivial modules — runtime smoke + Decimal anti-leak
// ─────────────────────────────────────────────────────────────────────

describe('Reliquats — non-trivial modules (runtime smoke + Decimal safety)', () => {
  describe('AuditLogListResponseDto (paginated + entity label enrichment)', () => {
    const dto = toResponse(AuditLogListResponseDto, {
      data: [
        {
          id: 'al-1',
          tenantId: 'tnt-1',
          userId: 'usr-1',
          action: 'UPDATE',
          entityType: 'asset',
          entityId: 'ast-1',
          changes: { before: { ip: '10.0.0.1' }, after: { ip: '10.0.0.2' } },
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla',
          timestamp: new Date(),
          user: { id: 'usr-1', name: 'Admin', email: 'a@demo.fr', passwordHash: 'never', _hidden: 'leak' },
          entityLabel: 'Cisco Switch · SN-1',
          _internal: 'leak',
        },
      ],
      meta: { total: 1, page: 1, pageSize: 50, totalPages: 1 },
    });

    it('exposes paginated meta + each row scalars and typed user ref', () => {
      expect(dto.meta).toEqual({ total: 1, page: 1, pageSize: 50, totalPages: 1 });
      expect(dto.data).toHaveLength(1);
      expect(dto.data[0].action).toBe('UPDATE');
      expect(dto.data[0].entityLabel).toBe('Cisco Switch · SN-1');
      expect(dto.data[0].user?.email).toBe('a@demo.fr');
    });

    it('changes JSON passthrough exposes the source object via @Transform({obj})', () => {
      expect(dto.data[0].changes).toEqual({
        before: { ip: '10.0.0.1' },
        after: { ip: '10.0.0.2' },
      });
    });

    it('runtime serialization drops contamination and never leaks credentials', () => {
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/passwordHash/);
      expect(wire).not.toMatch(/_hidden/);
      expect(wire).not.toMatch(/_internal/);
    });
  });

  describe('Consumption helpers (computeSite / computeRack / summary — Cas B for byType Record)', () => {
    const sample = {
      totalWatts: 320.5,
      kWhMonth: 230.76,
      costMonth: 46.15,
      currency: 'EUR',
      costPerKwh: 0.2,
      assetCount: 8,
      activeAssetCount: 6,
      byType: {
        SWITCH: { watts: 200, count: 2 },
        ROUTER: { watts: 120.5, count: 1 },
      },
    };

    it('computeSite preserves byType Record (manually mapped)', () => {
      const dto = toConsumptionSiteResponseDto({
        ...sample,
        site: { id: 'site-1', name: 'Saclay', code: 'SAC', autoGenerateElectricityExpense: false, _hidden: 'leak' },
      });
      expect(dto.totalWatts).toBe(320.5);
      expect(dto.byType.SWITCH).toEqual({ watts: 200, count: 2 });
      expect(dto.byType.ROUTER).toEqual({ watts: 120.5, count: 1 });
      expect(dto.site).toEqual({ id: 'site-1', name: 'Saclay', code: 'SAC', autoGenerateElectricityExpense: false });
      const wire = JSON.stringify(dto);
      expect(wire).not.toMatch(/_hidden/);
    });

    it('computeRack preserves byType Record', () => {
      const dto = toConsumptionRackResponseDto({
        ...sample,
        rack: { id: 'rack-1', name: 'A1', siteId: 'site-1', _internal: 'leak' },
      });
      expect(dto.byType.SWITCH).toEqual({ watts: 200, count: 2 });
      expect(dto.rack).toEqual({ id: 'rack-1', name: 'A1', siteId: 'site-1' });
      const wire = JSON.stringify(dto);
      expect(wire).not.toMatch(/_internal/);
    });

    it('summary composite preserves totals + sites + meta', () => {
      const dto = toConsumptionSummaryResponseDto({
        totals: { totalWatts: 320.5, kWhMonth: 230.76, costMonth: 46.15, currency: 'EUR', costPerKwh: 0.2 },
        sites: [
          { site: { id: 'site-1', name: 'Saclay', code: 'SAC', _hidden: 'leak' }, totalWatts: 320.5, kWhMonth: 230.76, costMonth: 46.15, assetCount: 8, activeAssetCount: 6 },
        ],
        meta: { totalSites: 1, returned: 1, limit: 10, offset: 0, truncated: false },
      });
      expect(dto.totals.totalWatts).toBe(320.5);
      expect(dto.sites).toHaveLength(1);
      expect(dto.sites[0].site).toEqual({ id: 'site-1', name: 'Saclay', code: 'SAC' });
      expect(dto.meta.truncated).toBe(false);
      const wire = JSON.stringify(dto);
      expect(wire).not.toMatch(/_hidden/);
    });
  });

  describe('Search — Cas B byType Record + hits[] manual mapping', () => {
    it('preserves both fields and is leak-free', () => {
      const dto = toSearchResponseDto({
        hits: [
          { type: 'asset', id: 'a-1', title: 'FW-1', subtitle: 'firewall', link: '/dashboard/assets/a-1' },
          { type: 'site', id: 's-1', title: 'Saclay', subtitle: undefined, link: '/dashboard/sites/s-1' },
        ],
        byType: { asset: 1, site: 1, rack: 0, task: 0, contact: 0 },
      });
      expect(dto.hits).toHaveLength(2);
      expect(dto.hits[0].type).toBe('asset');
      expect(dto.hits[1].subtitle).toBeNull();
      expect(dto.byType).toEqual({ asset: 1, site: 1, rack: 0, task: 0, contact: 0 });
      const wire = JSON.stringify(dto);
      // No sensitive credentials should appear in any search context.
      expect(wire).not.toMatch(/password/i);
      expect(wire).not.toMatch(/secret/i);
    });
  });

  describe('Organization tree (DelegationTreeNodeResponseDto)', () => {
    it('exposes nested sites array with strict whitelist', () => {
      const dto = toResponse(DelegationTreeNodeResponseDto, {
        id: 'd-1',
        tenantId: 'tnt-1',
        name: 'IDF',
        code: 'IDF',
        notes: null,
        isActive: true,
        groupLabel: null,
        groupColor: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sites: [
          { id: 'site-1', code: 'SAC', name: 'Saclay', status: 'ACTIVE', city: 'Saclay', _hidden: 'leak', secret: 'never' },
          { id: 'site-2', code: 'PAR', name: 'Paris', status: 'ACTIVE', city: 'Paris' },
        ],
        userDelegations: [{ should: 'be-dropped' }],
      });
      expect(dto.sites).toHaveLength(2);
      expect(dto.sites[0]).toEqual({ id: 'site-1', code: 'SAC', name: 'Saclay', status: 'ACTIVE', city: 'Saclay' });
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/_hidden/);
      expect(wire).not.toMatch(/userDelegations/);
      expect(wire).not.toMatch(/secret/);
    });
  });

  describe('Budgets — Decimal anti-leak runtime smoke (CRITICAL)', () => {
    /**
     * Prisma serialises Decimal(12,2) to strings by default. The DTO
     * declares the field as `string | number` so both shapes pass
     * type-check. The runtime smoke asserts no `Decimal` object marker
     * (e.g. `s: 1, e: 4, d: [...]`) leaks to the wire — i.e. the toJSON
     * path stayed sane.
     */
    const decimalSample = new Prisma.Decimal('40000.00');

    it('Budget entity exposes amount as string|number, no Decimal internals leak', () => {
      const dto = toResponse(BudgetResponseDto, {
        id: 'b-1',
        tenantId: 'tnt-1',
        label: 'Budget IT 2026',
        delegationId: 'd-1',
        siteId: null,
        billingEntityId: null,
        expenseType: null,
        period: 'YEAR',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        amount: decimalSample,
        currency: 'EUR',
        notes: null,
        alertsEnabled: true,
        alertThresholdPct: 80,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        delegation: { id: 'd-1', name: 'IDF', code: 'IDF' },
        site: null,
        billingEntity: null,
        parent: null,
        _count: { children: 2 },
        _internal: 'leak',
      });
      const wire = JSON.parse(JSON.stringify(instanceToPlain(dto)));
      // amount is declared as `number` so enableImplicitConversion routes
      // through Decimal.valueOf() and the wire payload is a clean JS number.
      expect(typeof wire.amount).toBe('number');
      expect(wire.amount).toBe(40000);
      // Should NOT leak Prisma.Decimal internals (`s: 1, e: 4, d: [40000]`).
      const wireStr = JSON.stringify(wire);
      expect(wireStr).not.toMatch(/"s":\s*1,\s*"e":/);
      expect(wireStr).not.toMatch(/_internal/);
      // _count passthrough preserves the aggregate.
      expect(wire._count).toEqual({ children: 2 });
    });

    it('Budget status composite serialises spent/remaining as numbers, not Decimal', () => {
      const dto = toResponse(BudgetStatusResponseDto, {
        budget: {
          id: 'b-1',
          tenantId: 'tnt-1',
          label: 'Budget IT',
          delegationId: 'd-1',
          siteId: null,
          billingEntityId: null,
          expenseType: null,
          period: 'YEAR',
          startDate: new Date(),
          endDate: new Date(),
          amount: decimalSample,
          currency: 'EUR',
          notes: null,
          alertsEnabled: true,
          alertThresholdPct: 80,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        budgeted: 40000,
        spent: 12345.67,
        remaining: 27654.33,
        progressPct: 31,
        overBudget: false,
        thresholdReached: false,
        expenses: [{ id: 'e-1', totalAmount: '500.00' }],
      });
      const wire = JSON.parse(JSON.stringify(instanceToPlain(dto)));
      expect(typeof wire.spent).toBe('number');
      expect(typeof wire.remaining).toBe('number');
      expect(wire.spent).toBe(12345.67);
      expect(wire.expenses).toHaveLength(1);
      const wireStr = JSON.stringify(wire);
      expect(wireStr).not.toMatch(/"s":\s*1,\s*"e":/);
    });
  });

  describe('Admin — enum-label Cas B helpers', () => {
    it('toEnumLabelMapResponseDto preserves item arrays per type', () => {
      const result = toEnumLabelMapResponseDto({
        AssetType: [
          { value: 'SWITCH', label: 'Switch', color: '#3b82f6', sortOrder: 0, isHidden: false, isBuiltIn: true, isActive: true, isConnectivityCapable: false, isSdwanCapable: false },
          { value: 'CUSTOM', label: 'Custom', icon: 'Plug', sortOrder: 1, isHidden: false, isBuiltIn: false, isActive: true, isConnectivityCapable: true, isSdwanCapable: false },
        ],
      });
      expect(result.items.AssetType).toHaveLength(2);
      expect(result.items.AssetType[0].value).toBe('SWITCH');
      expect(result.items.AssetType[1].isConnectivityCapable).toBe(true);
    });

    it('toEnumLabelDefaultsMapResponseDto flattens nested map and synthesises defaults', () => {
      const result = toEnumLabelDefaultsMapResponseDto({
        AssetType: {
          SWITCH: { label: 'Switch', color: '#3b82f6' },
          ROUTER: { label: 'Routeur', color: '#6366f1', connectivityCapable: true, sdwanCapable: true },
        },
      });
      expect(result.items.AssetType).toHaveLength(2);
      const router = result.items.AssetType.find((i) => i.value === 'ROUTER');
      expect(router?.isConnectivityCapable).toBe(true);
      expect(router?.isSdwanCapable).toBe(true);
      expect(router?.isBuiltIn).toBe(true);
      expect(router?.sortOrder).toBe(0);
    });
  });
});
