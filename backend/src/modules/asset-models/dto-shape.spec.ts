import { instanceToPlain } from 'class-transformer';
import { toResponse } from '../../common/utils/to-response.util';
import { AssetModelResponseDto } from './dto/asset-model.response.dto';
import {
  AssetModelImportResultResponseDto,
  AssetModelVendorResponseDto,
} from './dto/asset-model-vendor.response.dto';
import { AssetModelCatalogResponseDto } from './dto/asset-model-catalog.response.dto';
import {
  AssetModelCatalogDeletedResultResponseDto,
  AssetModelDeletedResultResponseDto,
} from './dto/asset-model-action-result.response.dto';

describe('Asset-models response DTO shapes', () => {
  describe('AssetModelResponseDto', () => {
    it('exposes scalars + WiFi defaults', () => {
      const dto = toResponse(AssetModelResponseDto, {
        id: 'am-1',
        tenantId: 'tnt-1',
        name: 'Cisco C9300-24P',
        manufacturer: 'Cisco',
        type: 'switch',
        vendorCatalogId: 'vc-1',
        acquisitionPrice: '5000.00',
        monthlyPrice: null,
        currency: 'EUR',
        pricingMode: 'ONE_TIME',
        powerConsumption: 350,
        weight: 5.2,
        defaultUHeight: 1,
        wifiCoverageRadius: null,
        wifiFrequency: null,
        wifiAntennaType: null,
        wifiTxPowerDbm: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Extraneous Prisma columns.
        _internal: 'leak',
        passwordHash: 'never',
      });
      expect(dto).toHaveProperty('name', 'Cisco C9300-24P');
      expect(dto).toHaveProperty('pricingMode', 'ONE_TIME');
      expect(dto).toHaveProperty('defaultUHeight', 1);
      expect(dto).not.toHaveProperty('_internal');
      expect(dto).not.toHaveProperty('passwordHash');
    });

    it('runtime serialization is leak-free', () => {
      const dto = toResponse(AssetModelResponseDto, {
        id: 'am-1',
        tenantId: 't',
        name: 'X',
        type: 'router',
        currency: 'EUR',
        pricingMode: 'MONTHLY',
        acquisitionPrice: null,
        monthlyPrice: '50.00',
        createdAt: new Date(),
        updatedAt: new Date(),
        _hidden: 'leak',
      });
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/_hidden/);
    });
  });

  describe('AssetModelVendorResponseDto', () => {
    it('exposes vendor entry', () => {
      const dto = toResponse(AssetModelVendorResponseDto, {
        key: 'fortinet',
        label: 'Fortinet',
        version: '7.4',
        itemCount: 142,
      });
      expect(dto).toEqual({ key: 'fortinet', label: 'Fortinet', version: '7.4', itemCount: 142 });
    });
  });

  describe('AssetModelImportResultResponseDto', () => {
    it('exposes counts', () => {
      const dto = toResponse(AssetModelImportResultResponseDto, {
        created: 12,
        updated: 4,
        skipped: 0,
        catalogId: 'vc-1',
        message: '12 models created',
      });
      expect(dto.created).toBe(12);
      expect(dto.catalogId).toBe('vc-1');
    });
  });

  describe('AssetModelCatalogResponseDto', () => {
    it('exposes catalog scalars but NOT raw content JSON', () => {
      const dto = toResponse(AssetModelCatalogResponseDto, {
        id: 'vc-1',
        tenantId: 'tnt-1',
        vendor: 'Fortinet',
        version: '7.4',
        sources: ['fortinet-fortigate'],
        itemCount: 142,
        builtIn: true,
        importedAt: new Date(),
        importedBy: 'admin',
        // Raw content NOT exposed in list view.
        content: { vendor: 'Fortinet', items: ['huge', 'array', 'of', '142', 'models'] },
      });
      expect(dto).toHaveProperty('vendor', 'Fortinet');
      expect(dto).toHaveProperty('itemCount', 142);
      expect(dto).not.toHaveProperty('content');
    });
  });

  describe('Action result shapes', () => {
    it('AssetModelDeletedResultResponseDto', () => {
      expect(toResponse(AssetModelDeletedResultResponseDto, { deleted: true })).toEqual({
        deleted: true,
      });
    });
    it('AssetModelCatalogDeletedResultResponseDto', () => {
      const dto = toResponse(AssetModelCatalogDeletedResultResponseDto, {
        deleted: true,
        catalog: { id: 'vc-1', vendor: 'Fortinet', _hidden: 'leak' },
        deletedModelsCount: 12,
      });
      expect(dto.deleted).toBe(true);
      expect(dto.catalog).toEqual({ id: 'vc-1', vendor: 'Fortinet' });
      expect(dto.deletedModelsCount).toBe(12);
    });
  });
});
