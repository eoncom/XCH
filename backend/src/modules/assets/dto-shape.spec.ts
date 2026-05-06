import { instanceToPlain } from 'class-transformer';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { AssetResponseDto } from './dto/asset.response.dto';
import { AssetListResponseDto } from './dto/asset-list.response.dto';
import {
  AssetImportPreviewResponseDto,
  AssetImportResultResponseDto,
} from './dto/asset-import.response.dto';
import { AssetQRCodeResponseDto } from './dto/asset-qrcode.response.dto';
import { AssetAttachmentResponseDto } from './dto/asset-attachment.response.dto';
import { AssetMovementResponseDto } from './dto/asset-movement.response.dto';
import {
  AssetAttachmentDeletedResultResponseDto,
  AssetBatchUpdateResultResponseDto,
  AssetDeletedResultResponseDto,
} from './dto/asset-action-result.response.dto';

describe('Assets response DTO shapes (type A — Prisma raw leak protection)', () => {
  describe('AssetResponseDto — strict whitelist anti-leak', () => {
    const prismaLikeAsset = {
      id: 'ast-1',
      tenantId: 'tnt-1',
      delegationId: 'dlg-1',
      siteId: 'site-1',
      type: 'switch',
      name: 'Top-of-rack switch',
      model: 'C9300-24P',
      manufacturer: 'Cisco',
      serialNumber: 'CSW-001',
      inventoryTag: 'INV-100',
      status: 'IN_SERVICE',
      assetModelId: 'am-1',
      acquisitionPrice: '5000.00',
      monthlyPrice: null,
      priceCurrency: 'EUR',
      locationText: 'Rack A1, U41',
      ip: '192.168.1.10',
      mac: '00:11:22:33:44:55',
      hostname: 'switch-top',
      vlan: 'VLAN10',
      port: 'gi0/1',
      rackId: 'rack-1',
      rackPositionU: 41,
      rackHeightU: 1,
      rackNotes: null,
      qrCodeUrl: 'data:image/png;base64,iVBOR...',
      qrCodeToken: 'tok-abc',
      purchaseDate: new Date('2026-01-01'),
      warrantyEnd: new Date('2029-01-01'),
      weight: 5.2,
      powerConsumption: 350,
      dutyCyclePercent: 100,
      notes: null,
      wifiCoverageRadius: null,
      wifiFrequency: null,
      wifiAntennaType: null,
      wifiTxPowerDbm: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      site: { id: 'site-1', code: 'SAC', name: 'Saclay', _hidden: 'leak' },
      rack: { id: 'rack-1', name: 'Rack A1', _hidden: 'leak' },
      assetModel: { id: 'am-1', label: 'Cisco C9300' },
      pins: [{ id: 'p-1' }],
      // Extraneous Prisma columns / sensitive flags.
      _internalCounter: 99,
      passwordHash: 'never-leak',
      tenant: { id: 'tnt-1', name: 'Demo' },
      // Internal Prisma relations not exposed.
      photos: undefined,
    };

    const dto = toResponse(AssetResponseDto, prismaLikeAsset);

    it('exposes scalar columns whitelisted', () => {
      expect(dto).toHaveProperty('id', 'ast-1');
      expect(dto).toHaveProperty('type', 'switch');
      expect(dto).toHaveProperty('serialNumber', 'CSW-001');
      expect(dto).toHaveProperty('ip', '192.168.1.10');
      expect(dto).toHaveProperty('mac', '00:11:22:33:44:55');
      expect(dto).toHaveProperty('hostname', 'switch-top');
      expect(dto).toHaveProperty('priceCurrency', 'EUR');
      expect(dto).toHaveProperty('dutyCyclePercent', 100);
    });

    it('exposes typed relations site / rack with sub-DTO whitelist', () => {
      expect(dto.site).toEqual({ id: 'site-1', code: 'SAC', name: 'Saclay' });
      expect(dto.site).not.toHaveProperty('_hidden');
      expect(dto.rack).toEqual({ id: 'rack-1', name: 'Rack A1' });
      expect(dto.rack).not.toHaveProperty('_hidden');
    });

    it('passthrough for assetModel / pins / tasks / movements (typed in cascade PRs)', () => {
      expect(dto.assetModel).toEqual({ id: 'am-1', label: 'Cisco C9300' });
      expect(dto.pins).toEqual([{ id: 'p-1' }]);
    });

    it('does NOT expose extraneous Prisma columns or sensitive flags', () => {
      expect(dto).not.toHaveProperty('_internalCounter');
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('tenant'); // raw relation skipped
    });

    it('runtime serialization (instanceToPlain → JSON) is leak-free', () => {
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/passwordHash/);
      expect(wireJson).not.toMatch(/_internalCounter/);
      expect(wireJson).not.toMatch(/_hidden/);
    });

    it('handles null relations gracefully (asset without site/rack)', () => {
      const noRelations = toResponse(AssetResponseDto, {
        id: 'ast-2',
        tenantId: 'tnt-1',
        delegationId: null,
        siteId: null,
        type: 'router',
        status: 'IN_SERVICE',
        acquisitionPrice: null,
        monthlyPrice: null,
        priceCurrency: 'EUR',
        rackId: null,
        dutyCyclePercent: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        site: null,
        rack: null,
      });
      expect(noRelations.site).toBeNull();
      expect(noRelations.rack).toBeNull();
    });
  });

  describe('AssetListResponseDto', () => {
    it('maps data + meta', () => {
      const dto = toResponse(AssetListResponseDto, {
        data: [],
        meta: { total: 0, page: 1, pageSize: 25, totalPages: 0 },
      });
      expect(dto.meta).toEqual({ total: 0, page: 1, pageSize: 25, totalPages: 0 });
    });
  });

  describe('AssetImportResultResponseDto', () => {
    it('exposes counts + errors array', () => {
      const dto = toResponse(AssetImportResultResponseDto, {
        imported: 10,
        skipped: 2,
        errors: [{ row: 3, field: 'serialNumber', message: 'Required', value: null }],
        message: '10 assets imported',
        _internalDuration: 234,
      });
      expect(dto.imported).toBe(10);
      expect(dto.errors).toHaveLength(1);
      expect(dto.errors[0]).toHaveProperty('row', 3);
      expect(dto).not.toHaveProperty('_internalDuration');
    });
  });

  describe('AssetImportPreviewResponseDto', () => {
    it('exposes total/valid/invalid + errors', () => {
      const dto = toResponse(AssetImportPreviewResponseDto, {
        total: 12,
        valid: 10,
        invalid: 2,
        errors: [],
      });
      expect(dto).toEqual({ total: 12, valid: 10, invalid: 2, errors: [] });
    });
  });

  describe('AssetQRCodeResponseDto', () => {
    it('exposes assetId + qrCodeUrl + token', () => {
      const dto = toResponse(AssetQRCodeResponseDto, {
        assetId: 'ast-1',
        qrCodeUrl: 'data:image/png;base64,...',
        qrCodeToken: 'tok-abc',
      });
      expect(dto).toHaveProperty('assetId', 'ast-1');
      expect(dto).toHaveProperty('qrCodeUrl');
      expect(dto).toHaveProperty('qrCodeToken', 'tok-abc');
    });
  });

  describe('AssetAttachmentResponseDto', () => {
    it('strips polymorphic siblings', () => {
      const dto = toResponse(AssetAttachmentResponseDto, {
        id: 'a-1',
        tenantId: 't',
        assetId: 'ast-1',
        filename: 'spec.pdf',
        originalFilename: 'spec.pdf',
        size: 100,
        mimetype: 'application/pdf',
        path: 'p',
        uploadedBy: 'u',
        uploadedAt: new Date(),
        url: 'http://x',
        // Polymorphic siblings — must NOT leak on the asset scope.
        siteId: null,
        rackId: null,
        taskId: null,
      });
      expect(dto).toHaveProperty('assetId', 'ast-1');
      expect(dto).not.toHaveProperty('siteId');
      expect(dto).not.toHaveProperty('rackId');
      expect(dto).not.toHaveProperty('taskId');
    });

    it('toResponseArray maps a list', () => {
      const list = toResponseArray(AssetAttachmentResponseDto, [
        {
          id: 'a-1',
          tenantId: 't',
          assetId: 'ast-1',
          filename: 'f',
          originalFilename: 'f',
          size: 1,
          mimetype: 'application/pdf',
          path: 'p',
          uploadedBy: 'u',
          uploadedAt: new Date(),
          url: 'http://x',
        },
      ]);
      expect(list).toHaveLength(1);
    });
  });

  describe('AssetMovementResponseDto', () => {
    it('exposes movement scalars + passthrough refs', () => {
      const dto = toResponse(AssetMovementResponseDto, {
        id: 'mv-1',
        tenantId: 't',
        assetId: 'ast-1',
        fromSiteId: 'site-1',
        toSiteId: 'site-2',
        fromRackId: null,
        toRackId: 'rack-2',
        reason: 'Relocation',
        userId: 'u',
        createdAt: new Date(),
        fromSite: { id: 'site-1', name: 'Saclay' },
        toSite: { id: 'site-2', name: 'Vélizy' },
        user: { id: 'u', name: 'Admin' },
      });
      expect(dto).toHaveProperty('reason', 'Relocation');
      expect(dto.fromSite).toMatchObject({ name: 'Saclay' });
      expect(dto.user).toMatchObject({ name: 'Admin' });
    });
  });

  describe('Action result shapes', () => {
    it('AssetDeletedResultResponseDto', () => {
      expect(toResponse(AssetDeletedResultResponseDto, { message: 'Asset deleted' })).toEqual({
        message: 'Asset deleted',
      });
    });

    it('AssetAttachmentDeletedResultResponseDto', () => {
      expect(
        toResponse(AssetAttachmentDeletedResultResponseDto, { message: 'Attachment deleted' }),
      ).toEqual({ message: 'Attachment deleted' });
    });

    it('AssetBatchUpdateResultResponseDto', () => {
      expect(toResponse(AssetBatchUpdateResultResponseDto, { updated: 7 })).toEqual({ updated: 7 });
    });
  });
});
