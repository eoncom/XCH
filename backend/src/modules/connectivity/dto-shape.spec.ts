import { instanceToPlain } from 'class-transformer';
import { ConnectivityRole, ExpenseFrequency } from '@prisma/client';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import {
  ConnectivityLinkResponseDto,
  ConnectivityResyncExpenseResponseDto,
} from './dto/connectivity-link.response.dto';

/**
 * S9 ADR-023 — Connectivity response DTO shape verification.
 *
 * Inclusion-style assertions + runtime serialization smoke
 * (instanceToPlain → JSON) — same pattern as the monitoring pivot.
 */
describe('Connectivity response DTO shapes', () => {
  describe('ConnectivityLinkResponseDto (Cas C — Prisma + relations)', () => {
    const prismaLikeLink = {
      id: 'lnk-1',
      tenantId: 'tnt-1',
      siteId: 'site-1',
      role: ConnectivityRole.PRIMARY,
      provider: 'Orange',
      type: 'FIBER',
      bandwidthDown: 1000,
      bandwidthUp: 500,
      publicIp: '91.121.10.10',
      monthlyPrice: '120.00',
      currency: 'EUR',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: null,
      contractRef: 'CT-2026-001',
      notes: 'GTR 4h',
      assetId: 'ast-1',
      expenseId: 'exp-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-04-15T00:00:00Z'),
      // Extraneous fields that should NOT leak.
      _internalScore: 99,
      passwordHash: 'never-leak-this',
      site: {
        id: 'site-1',
        name: 'Saclay',
        code: 'SAC',
        delegationId: 'dlg-1',
        // Extraneous on the embedded relation.
        _hiddenSiteFlag: 'leak',
      },
      asset: {
        id: 'ast-1',
        name: 'Box Orange',
        type: 'router',
        serialNumber: 'OR-12345',
      },
      expense: {
        id: 'exp-1',
        label: 'Connectivité Orange',
        totalAmount: '120.00',
        frequency: ExpenseFrequency.MONTHLY,
        // Extraneous on the embedded expense.
        _internalRef: 'leak',
      },
      // Raw Prisma relation that's NOT @Type-mapped → must be stripped.
      tenant: { id: 'tnt-1', name: 'Demo' },
    };

    const dto = toResponse(ConnectivityLinkResponseDto, prismaLikeLink);

    it('exposes scalar columns', () => {
      expect(dto).toHaveProperty('id', 'lnk-1');
      expect(dto).toHaveProperty('siteId', 'site-1');
      expect(dto).toHaveProperty('role', ConnectivityRole.PRIMARY);
      expect(dto).toHaveProperty('provider', 'Orange');
      expect(dto).toHaveProperty('type', 'FIBER');
      expect(dto).toHaveProperty('bandwidthDown', 1000);
      expect(dto).toHaveProperty('publicIp', '91.121.10.10');
      expect(dto).toHaveProperty('currency', 'EUR');
      expect(dto).toHaveProperty('contractRef', 'CT-2026-001');
      expect(dto).toHaveProperty('expenseId', 'exp-1');
    });

    it('preserves nullable Decimal monthlyPrice as JSON-serialisable value', () => {
      expect(dto.monthlyPrice).toBe('120.00');
    });

    it('embeds site / asset / expense refs with @Type-mapped sub-DTOs', () => {
      expect(dto.site).toBeDefined();
      expect(dto.site).toHaveProperty('code', 'SAC');
      expect(dto.site).toHaveProperty('delegationId', 'dlg-1');
      expect(dto.asset).toHaveProperty('serialNumber', 'OR-12345');
      expect(dto.expense).toHaveProperty('frequency', ExpenseFrequency.MONTHLY);
      expect(dto.expense).toHaveProperty('totalAmount', '120.00');
    });

    it('strips extraneous fields from embedded relations', () => {
      expect(dto.site).not.toHaveProperty('_hiddenSiteFlag');
      expect(dto.expense).not.toHaveProperty('_internalRef');
    });

    it('does NOT expose extraneous Prisma columns or sensitive flags', () => {
      expect(dto).not.toHaveProperty('_internalScore');
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('tenant'); // raw relation skipped
    });

    /**
     * Runtime serialization smoke — simulate ClassSerializerInterceptor
     * (instanceToPlain → JSON.stringify → JSON.parse).
     */
    it('runtime serialization (instanceToPlain → JSON) does not leak any extraneous field', () => {
      const wirePayload = JSON.parse(JSON.stringify(instanceToPlain(dto)));
      const wireJson = JSON.stringify(wirePayload);
      expect(wireJson).not.toMatch(/passwordHash/i);
      expect(wireJson).not.toMatch(/_internalScore/);
      expect(wireJson).not.toMatch(/_hiddenSiteFlag/);
      expect(wireJson).not.toMatch(/_internalRef/);
      // Sanity check — legitimate fields ARE present on the wire.
      expect(wirePayload).toHaveProperty('id', 'lnk-1');
      expect(wirePayload).toHaveProperty('provider', 'Orange');
      expect(wirePayload.site).toHaveProperty('code', 'SAC');
      expect(wirePayload.expense).toHaveProperty('totalAmount', '120.00');
    });
  });

  describe('ConnectivityLinkResponseDto array (Cas C — list endpoint)', () => {
    const prismaList = [
      {
        id: 'lnk-1',
        tenantId: 'tnt-1',
        siteId: 'site-1',
        role: ConnectivityRole.PRIMARY,
        provider: 'Orange',
        type: 'FIBER',
        bandwidthDown: 1000,
        bandwidthUp: 500,
        publicIp: null,
        monthlyPrice: null,
        currency: 'EUR',
        startDate: null,
        endDate: null,
        contractRef: null,
        notes: null,
        assetId: null,
        expenseId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        site: null,
        asset: null,
        expense: null,
      },
      {
        id: 'lnk-2',
        tenantId: 'tnt-1',
        siteId: 'site-1',
        role: ConnectivityRole.BACKUP,
        provider: 'Bouygues',
        type: '4G',
        bandwidthDown: 100,
        bandwidthUp: 50,
        publicIp: null,
        monthlyPrice: '40.00',
        currency: 'EUR',
        startDate: new Date(),
        endDate: null,
        contractRef: null,
        notes: null,
        assetId: null,
        expenseId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        site: null,
        asset: null,
        expense: null,
      },
    ];

    it('maps an array of links via toResponseArray', () => {
      const dtos = toResponseArray(ConnectivityLinkResponseDto, prismaList);
      expect(dtos).toHaveLength(2);
      expect(dtos[0]).toHaveProperty('role', ConnectivityRole.PRIMARY);
      expect(dtos[1]).toHaveProperty('role', ConnectivityRole.BACKUP);
      expect(dtos[1]).toHaveProperty('provider', 'Bouygues');
    });
  });

  describe('ConnectivityResyncExpenseResponseDto (Cas C — composite shape)', () => {
    const composite = {
      expense: {
        id: 'exp-1',
        label: 'Connectivité Orange',
        totalAmount: '125.00',
        frequency: ExpenseFrequency.MONTHLY,
        // Extraneous from EXPENSE_INCLUDE.
        _innerCounter: 7,
      },
      before: 120,
      after: 125,
      // Extraneous internal field.
      _resyncTimestamp: new Date(),
    };

    it('exposes before / after / expense ref', () => {
      const dto = toResponse(ConnectivityResyncExpenseResponseDto, composite);
      expect(dto).toHaveProperty('before', 120);
      expect(dto).toHaveProperty('after', 125);
      expect(dto.expense).toHaveProperty('id', 'exp-1');
      expect(dto.expense).toHaveProperty('totalAmount', '125.00');
      expect(dto.expense).toHaveProperty('frequency', ExpenseFrequency.MONTHLY);
    });

    it('strips extraneous internal-only fields (top-level + embedded)', () => {
      const dto = toResponse(ConnectivityResyncExpenseResponseDto, composite);
      expect(dto).not.toHaveProperty('_resyncTimestamp');
      expect(dto.expense).not.toHaveProperty('_innerCounter');
    });

    it('runtime serialization does not leak any extraneous field', () => {
      const dto = toResponse(ConnectivityResyncExpenseResponseDto, composite);
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/_resyncTimestamp/);
      expect(wireJson).not.toMatch(/_innerCounter/);
    });
  });
});
