import { instanceToPlain } from 'class-transformer';
import { toResponse } from '../../common/utils/to-response.util';
import { BillingEntityResponseDto } from './dto/billing-entity.response.dto';
import { BillingEntityDeletedResultResponseDto } from './dto/billing-entity-action-result.response.dto';

describe('Billing-entities response DTO shapes', () => {
  describe('BillingEntityResponseDto', () => {
    it('exposes scalars + passthrough delegation/site refs', () => {
      const dto = toResponse(BillingEntityResponseDto, {
        id: 'be-1',
        tenantId: 'tnt-1',
        name: 'IT Service',
        code: 'IT-01',
        type: 'SERVICE',
        description: 'IT central service',
        isActive: true,
        delegationId: 'dlg-1',
        siteId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        delegation: { id: 'dlg-1', name: 'Demo' },
        _count: { expensesBorne: 12, allocationsReceived: 3 },
        // Extraneous.
        _internal: 'leak',
      });
      expect(dto).toHaveProperty('name', 'IT Service');
      expect(dto).toHaveProperty('isActive', true);
      expect(dto.delegation).toMatchObject({ name: 'Demo' });
      expect(dto._count).toMatchObject({ expensesBorne: 12 });
      expect(dto).not.toHaveProperty('_internal');
    });

    it('runtime serialization is leak-free', () => {
      const dto = toResponse(BillingEntityResponseDto, {
        id: 'be-1',
        tenantId: 't',
        name: 'X',
        code: 'X',
        type: 'OTHER',
        description: null,
        isActive: true,
        delegationId: null,
        siteId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _hidden: 'leak',
      });
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/_hidden/);
    });
  });

  describe('BillingEntityDeletedResultResponseDto', () => {
    it('exposes message', () => {
      expect(toResponse(BillingEntityDeletedResultResponseDto, { message: 'BE deleted' })).toEqual({
        message: 'BE deleted',
      });
    });
  });
});
