import { instanceToPlain } from 'class-transformer';
import { ExpenseFrequency, ExpenseType } from '@prisma/client';
import { toResponse } from '../../common/utils/to-response.util';
import { ExpenseResponseDto, ExpenseAllocationResponseDto, ExpenseBearerRefResponseDto } from './dto/expense.response.dto';
import { ExpenseListResponseDto } from './dto/expense-list.response.dto';

describe('Expenses response DTO shapes', () => {
  describe('ExpenseResponseDto', () => {
    const prismaLike = {
      id: 'exp-1',
      tenantId: 'tnt-1',
      label: 'Internet leased line',
      description: null,
      type: ExpenseType.SERVICE,
      totalAmount: 120,
      currency: 'EUR',
      frequency: ExpenseFrequency.MONTHLY,
      dateIncurred: new Date(),
      dateStart: new Date(),
      dateEnd: null,
      bearerId: 'be-1',
      delegationId: 'dlg-1',
      siteId: 'site-1',
      assetId: null,
      externalRef: null,
      vendorId: null,
      invoiceRef: null,
      poNumber: null,
      notes: null,
      createdBy: 'usr-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      bearer: { id: 'be-1', name: 'IT', code: 'IT-01', type: 'SERVICE', _hidden: 'leak' },
      allocations: [
        { id: 'a-1', expenseId: 'exp-1', targetId: 'be-2', percentage: 60, amount: 72, notes: null },
        { id: 'a-2', expenseId: 'exp-1', targetId: 'be-3', percentage: 40, amount: 48, notes: null },
      ],
      delegation: { id: 'dlg-1', name: 'Demo' },
      // Extraneous.
      _internal: 'leak',
      passwordHash: 'never',
    };

    it('exposes scalars + bearer ref + allocations', () => {
      const dto = toResponse(ExpenseResponseDto, prismaLike);
      expect(dto).toHaveProperty('label', 'Internet leased line');
      expect(dto).toHaveProperty('type', ExpenseType.SERVICE);
      expect(dto.bearer).toEqual({ id: 'be-1', name: 'IT', code: 'IT-01', type: 'SERVICE' });
      expect(dto.bearer).not.toHaveProperty('_hidden');
      expect(dto.allocations).toHaveLength(2);
      expect(dto.allocations?.[0]).toHaveProperty('percentage', 60);
    });

    it('runtime serialization is leak-free', () => {
      const dto = toResponse(ExpenseResponseDto, prismaLike);
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/passwordHash/);
      expect(wireJson).not.toMatch(/_internal/);
      expect(wireJson).not.toMatch(/_hidden/);
    });
  });

  describe('ExpenseListResponseDto', () => {
    it('maps data + meta', () => {
      const dto = toResponse(ExpenseListResponseDto, {
        data: [],
        meta: { total: 0, page: 1, pageSize: 25, totalPages: 0 },
      });
      expect(dto.meta).toEqual({ total: 0, page: 1, pageSize: 25, totalPages: 0 });
    });
  });

  describe('ExpenseBearerRefResponseDto + AllocationResponseDto', () => {
    it('bearer ref strips extras', () => {
      const dto = toResponse(ExpenseBearerRefResponseDto, {
        id: 'be-1',
        name: 'IT',
        code: 'IT-01',
        type: 'SERVICE',
        _hidden: 'leak',
      });
      expect(dto).toEqual({ id: 'be-1', name: 'IT', code: 'IT-01', type: 'SERVICE' });
    });

    it('allocation entry exposes scalars', () => {
      const dto = toResponse(ExpenseAllocationResponseDto, {
        id: 'a-1',
        expenseId: 'exp-1',
        targetId: 'be-2',
        percentage: 50,
        amount: 60,
        notes: null,
      });
      expect(dto).toHaveProperty('percentage', 50);
      expect(dto).toHaveProperty('amount', 60);
    });
  });
});
