import { instanceToPlain } from 'class-transformer';
import { RackStatus, RackType } from '@prisma/client';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { RackResponseDto } from './dto/rack.response.dto';
import { RackListResponseDto } from './dto/rack-list.response.dto';
import { RackMountResultResponseDto } from './dto/rack-mount-result.response.dto';
import { RackAvailableSpacesResponseDto } from './dto/rack-available-spaces.response.dto';
import { RackAttachmentResponseDto } from './dto/rack-attachment.response.dto';
import {
  RackAttachmentDeletedResultResponseDto,
  RackDeletedResultResponseDto,
} from './dto/rack-action-result.response.dto';

describe('Racks response DTO shapes', () => {
  describe('RackResponseDto (Cas C — entity + relations + computed)', () => {
    const prismaLikeRack = {
      id: 'rack-1',
      tenantId: 'tnt-1',
      siteId: 'site-1',
      name: 'Rack-A',
      serialNumber: 'SN-XYZ',
      model: 'Tripp-42U',
      manufacturer: 'Tripp Lite',
      heightU: 42,
      rackType: RackType.FLOOR_STANDING,
      status: RackStatus.IN_SERVICE,
      location: 'Zone A1',
      specs: { dimensions: '600x1000', maxLoad: 1500 },
      notes: 'Brassage OK',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-04-15T00:00:00Z'),
      // Extraneous Prisma columns.
      _internalCounter: 99,
      passwordHash: 'never-leak',
      site: {
        id: 'site-1',
        code: 'SAC',
        name: 'Saclay',
        // Extraneous on the embedded relation.
        _hiddenSiteFlag: 'leak',
      },
      assets: [
        {
          id: 'ast-1',
          name: 'Switch-Top',
          type: 'switch',
          manufacturer: 'Cisco',
          model: 'C9300',
          serialNumber: 'CSW-001',
          status: 'IN_SERVICE',
          rackPositionU: 41,
          rackHeightU: 1,
        },
      ],
      occupation: { totalU: 42, usedU: 1, freeU: 41, percent: 2 },
      _count: { assets: 1 },
    };

    const dto = toResponse(RackResponseDto, prismaLikeRack);

    it('exposes scalar columns', () => {
      expect(dto).toHaveProperty('id', 'rack-1');
      expect(dto).toHaveProperty('siteId', 'site-1');
      expect(dto).toHaveProperty('heightU', 42);
      expect(dto).toHaveProperty('rackType', RackType.FLOOR_STANDING);
      expect(dto).toHaveProperty('status', RackStatus.IN_SERVICE);
      expect(dto).toHaveProperty('location', 'Zone A1');
      expect(dto.specs).toEqual({ dimensions: '600x1000', maxLoad: 1500 });
    });

    it('embeds site / assets / occupation / _count', () => {
      expect(dto.site).toHaveProperty('code', 'SAC');
      expect(dto.assets).toHaveLength(1);
      expect(dto.assets?.[0]).toHaveProperty('serialNumber', 'CSW-001');
      expect(dto.occupation).toEqual({ totalU: 42, usedU: 1, freeU: 41, percent: 2 });
      expect(dto._count).toEqual({ assets: 1 });
    });

    it('strips extraneous fields top-level + embedded', () => {
      expect(dto).not.toHaveProperty('_internalCounter');
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('tenant');
      expect(dto.site).not.toHaveProperty('_hiddenSiteFlag');
    });

    it('runtime serialization is leak-free and preserves _count alias', () => {
      const wirePayload = JSON.parse(JSON.stringify(instanceToPlain(dto)));
      expect(wirePayload).not.toHaveProperty('_internalCounter');
      expect(wirePayload).not.toHaveProperty('passwordHash');
      expect(wirePayload.site).not.toHaveProperty('_hiddenSiteFlag');
      expect(wirePayload).toHaveProperty('_count');
      expect(wirePayload._count).toEqual({ assets: 1 });
    });
  });

  describe('RackListResponseDto (paginated)', () => {
    const page = {
      data: [
        {
          id: 'rack-1',
          tenantId: 'tnt-1',
          siteId: 'site-1',
          name: 'Rack-A',
          heightU: 42,
          rackType: RackType.FLOOR_STANDING,
          status: RackStatus.IN_SERVICE,
          location: null,
          specs: null,
          notes: null,
          serialNumber: null,
          model: null,
          manufacturer: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          site: { id: 'site-1', code: 'SAC', name: 'Saclay' },
          assets: [],
          occupation: { totalU: 42, usedU: 0, freeU: 42, percent: 0 },
          _count: { assets: 0 },
        },
      ],
      meta: { total: 1, page: 1, pageSize: 25, totalPages: 1, _hidden: 'leak' },
    };

    it('maps data + meta and strips extraneous on meta', () => {
      const dto = toResponse(RackListResponseDto, page);
      expect(dto.data).toHaveLength(1);
      expect(dto.data[0]).toHaveProperty('name', 'Rack-A');
      expect(dto.meta).toEqual({ total: 1, page: 1, pageSize: 25, totalPages: 1 });
    });
  });

  describe('RackMountResultResponseDto', () => {
    it('exposes message + asset ref', () => {
      const result = {
        message: 'Equipment mounted successfully',
        asset: {
          id: 'ast-1',
          tenantId: 'tnt-1',
          type: 'switch',
          status: 'IN_SERVICE',
          siteId: 'site-1',
          rackId: 'rack-1',
          rackPositionU: 5,
          rackHeightU: 1,
          // Extraneous Prisma columns.
          serialNumber: 'CSW-001',
          createdAt: new Date(),
          _internalRef: 'leak',
        },
      };
      const dto = toResponse(RackMountResultResponseDto, result);
      expect(dto).toHaveProperty('message', 'Equipment mounted successfully');
      expect(dto.asset).toHaveProperty('rackPositionU', 5);
      expect(dto.asset).not.toHaveProperty('_internalRef');
      expect(dto.asset).not.toHaveProperty('serialNumber'); // not in mount-result ref DTO
    });
  });

  describe('RackAvailableSpacesResponseDto', () => {
    it('exposes rack info + slots array', () => {
      const dto = toResponse(RackAvailableSpacesResponseDto, {
        rackId: 'rack-1',
        rackName: 'Rack-A',
        totalU: 42,
        requiredU: 1,
        availableSpaces: [
          { positionU: 1, endPositionU: 1, heightU: 1 },
          { positionU: 2, endPositionU: 2, heightU: 1 },
        ],
        // Extraneous.
        _internalScanTime: 12.3,
      });
      expect(dto).toHaveProperty('rackId', 'rack-1');
      expect(dto.availableSpaces).toHaveLength(2);
      expect(dto.availableSpaces[0]).toHaveProperty('positionU', 1);
      expect(dto).not.toHaveProperty('_internalScanTime');
    });
  });

  describe('RackAttachmentResponseDto', () => {
    const attachment = {
      id: 'att-1',
      tenantId: 'tnt-1',
      rackId: 'rack-1',
      filename: 'attachment_2026-05-01_invoice.pdf',
      originalFilename: 'invoice.pdf',
      size: 12345,
      mimetype: 'application/pdf',
      path: 'attachments/tnt-1/racks/rack-1/abc.pdf',
      description: 'Invoice rack 2026',
      category: 'invoice',
      uploadedBy: 'usr-1',
      uploadedAt: new Date('2026-05-01T00:00:00Z'),
      url: 'https://storage.example.com/attachments/tnt-1/racks/rack-1/abc.pdf',
      // Extraneous polymorphic fields.
      assetId: null,
      taskId: null,
      siteId: null,
    };

    it('exposes file metadata + computed url', () => {
      const dto = toResponse(RackAttachmentResponseDto, attachment);
      expect(dto).toHaveProperty('id', 'att-1');
      expect(dto).toHaveProperty('originalFilename', 'invoice.pdf');
      expect(dto).toHaveProperty('mimetype', 'application/pdf');
      expect(dto).toHaveProperty('url');
      expect(dto.url).toContain('https://');
    });

    it('strips extraneous polymorphic fields not relevant to rack scope', () => {
      const dto = toResponse(RackAttachmentResponseDto, attachment);
      expect(dto).not.toHaveProperty('assetId');
      expect(dto).not.toHaveProperty('taskId');
      expect(dto).not.toHaveProperty('siteId');
    });

    it('toResponseArray maps a list', () => {
      const list = toResponseArray(RackAttachmentResponseDto, [attachment, attachment]);
      expect(list).toHaveLength(2);
      expect(list[0]).toHaveProperty('id', 'att-1');
    });
  });

  describe('Action result shapes', () => {
    it('RackDeletedResultResponseDto exposes message only', () => {
      expect(
        toResponse(RackDeletedResultResponseDto, {
          message: 'Rack deleted successfully',
          _hidden: 'leak',
        }),
      ).toEqual({ message: 'Rack deleted successfully' });
    });

    it('RackAttachmentDeletedResultResponseDto exposes message only', () => {
      expect(
        toResponse(RackAttachmentDeletedResultResponseDto, {
          message: 'Attachment deleted successfully',
        }),
      ).toEqual({ message: 'Attachment deleted successfully' });
    });
  });
});
