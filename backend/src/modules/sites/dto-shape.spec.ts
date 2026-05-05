import { instanceToPlain } from 'class-transformer';
import { HealthStatus, SiteStatus } from '@prisma/client';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { SiteResponseDto } from './dto/site.response.dto';
import { SiteListResponseDto } from './dto/site-list.response.dto';
import { SiteAttachmentResponseDto } from './dto/site-attachment.response.dto';
import { SiteDocumentResponseDto } from './dto/site-document.response.dto';
import { SiteAuditLogResponseDto } from './dto/site-audit-log.response.dto';
import {
  SiteAttachmentDeletedResultResponseDto,
  SiteDeletedResultResponseDto,
} from './dto/site-action-result.response.dto';

describe('Sites response DTO shapes', () => {
  describe('SiteResponseDto (Cas C — large composite)', () => {
    const prismaLikeSite = {
      id: 'site-1',
      tenantId: 'tnt-1',
      delegationId: 'dlg-1',
      code: 'SAC',
      name: 'Saclay',
      status: SiteStatus.ACTIVE,
      address: '12 rue Test',
      city: 'Saclay',
      postalCode: '91400',
      country: 'FR',
      latitude: 48.71,
      longitude: 2.17,
      accessSchedules: '8h-18h',
      accessBadges: 'Badge A',
      accessProcedures: null,
      accessSafety: null,
      cutProcedure: 'Cut at noon',
      governanceDocsRef: null,
      smbPath: null,
      sharepointUrl: null,
      gedUrl: null,
      accessRightsUrl: null,
      healthStatus: HealthStatus.HEALTHY,
      lastHealthCheck: new Date('2026-05-05T12:00:00Z'),
      notes: 'Notes test',
      monitoringEnabled: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-04-15T00:00:00Z'),
      delegation: {
        id: 'dlg-1',
        name: 'Demo',
        code: 'DEM',
        groupLabel: null,
        groupColor: null,
        // Extraneous on the embedded relation.
        _internalFlag: 'leak',
      },
      _count: { assets: 47, racks: 5, tasks: 12 },
      // Complex passthrough sub-shapes (typed by their own cascade PRs).
      connectivityLinks: [{ id: 'lnk-1', role: 'PRIMARY' }],
      connectivity: {
        primary: { type: 'FIBER', provider: 'Orange', ref: 'CT-1' },
        backup: null,
        links: [],
        cutProcedure: 'Cut at noon',
      },
      healthSnapshot: { siteId: 'site-1', overall: 'HEALTHY' },
      contactsOnSite: [],
      emplacements: [],
      // Extraneous Prisma columns / sensitive flags.
      _internalCounter: 99,
      passwordHash: 'should-never-leak',
    };

    const dto = toResponse(SiteResponseDto, prismaLikeSite);

    it('exposes scalar columns + computed lat/lng', () => {
      expect(dto).toHaveProperty('id', 'site-1');
      expect(dto).toHaveProperty('code', 'SAC');
      expect(dto).toHaveProperty('status', SiteStatus.ACTIVE);
      expect(dto).toHaveProperty('healthStatus', HealthStatus.HEALTHY);
      expect(dto).toHaveProperty('latitude', 48.71);
      expect(dto).toHaveProperty('longitude', 2.17);
      expect(dto).toHaveProperty('monitoringEnabled', true);
    });

    it('embeds delegation ref (typed) + _count', () => {
      expect(dto.delegation).toHaveProperty('code', 'DEM');
      expect(dto._count).toEqual({ assets: 47, racks: 5, tasks: 12 });
    });

    it('preserves complex sub-shapes via @Transform({obj}) passthrough', () => {
      expect(dto.connectivityLinks).toEqual([{ id: 'lnk-1', role: 'PRIMARY' }]);
      expect(dto.connectivity).toMatchObject({
        primary: { type: 'FIBER', provider: 'Orange', ref: 'CT-1' },
      });
      expect(dto.healthSnapshot).toMatchObject({ overall: 'HEALTHY' });
      expect(dto.contactsOnSite).toEqual([]);
      expect(dto.emplacements).toEqual([]);
    });

    it('strips extraneous fields top-level + on embedded delegation', () => {
      expect(dto).not.toHaveProperty('_internalCounter');
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('tenant');
      expect(dto.delegation).not.toHaveProperty('_internalFlag');
    });

    it('runtime serialization (instanceToPlain → JSON) is leak-free', () => {
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/passwordHash/);
      expect(wireJson).not.toMatch(/_internalCounter/);
      expect(wireJson).not.toMatch(/_internalFlag/);
    });
  });

  describe('SiteListResponseDto (paginated)', () => {
    it('maps data + meta and strips meta extras', () => {
      const dto = toResponse(SiteListResponseDto, {
        data: [
          {
            id: 'site-1',
            tenantId: 'tnt-1',
            delegationId: null,
            code: 'SAC',
            name: 'Saclay',
            status: SiteStatus.ACTIVE,
            address: null,
            city: null,
            postalCode: null,
            country: null,
            healthStatus: HealthStatus.HEALTHY,
            lastHealthCheck: null,
            monitoringEnabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { assets: 0, racks: 0, tasks: 0 },
          },
        ],
        meta: { total: 1, page: 1, pageSize: 25, totalPages: 1, _hidden: 'leak' },
      });
      expect(dto.data).toHaveLength(1);
      expect(dto.meta).toEqual({ total: 1, page: 1, pageSize: 25, totalPages: 1 });
    });
  });

  describe('SiteAttachmentResponseDto', () => {
    it('exposes file metadata + url, strips polymorphic siblings', () => {
      const dto = toResponse(SiteAttachmentResponseDto, {
        id: 'att-1',
        tenantId: 'tnt-1',
        siteId: 'site-1',
        filename: 'plan.pdf',
        originalFilename: 'plan.pdf',
        size: 12345,
        mimetype: 'application/pdf',
        path: 'attachments/tnt-1/sites/site-1/abc.pdf',
        description: 'Floor plan',
        category: 'spec',
        uploadedBy: 'usr-1',
        uploadedAt: new Date(),
        url: 'https://storage/plan.pdf',
        // Polymorphic siblings — must NOT leak on the site scope.
        assetId: null,
        rackId: null,
        taskId: null,
      });
      expect(dto).toHaveProperty('siteId', 'site-1');
      expect(dto).toHaveProperty('url');
      expect(dto).not.toHaveProperty('assetId');
      expect(dto).not.toHaveProperty('rackId');
      expect(dto).not.toHaveProperty('taskId');
    });

    it('toResponseArray maps a list', () => {
      const list = toResponseArray(SiteAttachmentResponseDto, [
        {
          id: 'a-1',
          tenantId: 't',
          siteId: 's',
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

  describe('SiteDocumentResponseDto', () => {
    it('exposes attachment fields + entity context', () => {
      const dto = toResponse(SiteDocumentResponseDto, {
        id: 'att-1',
        filename: 'doc.pdf',
        originalFilename: 'doc.pdf',
        size: 100,
        mimetype: 'application/pdf',
        path: 'p',
        uploadedBy: 'u',
        uploadedAt: new Date(),
        url: 'http://x',
        entityType: 'asset',
        entityId: 'ast-1',
        entityName: 'Switch-Top',
      });
      expect(dto).toHaveProperty('entityType', 'asset');
      expect(dto).toHaveProperty('entityId', 'ast-1');
      expect(dto).toHaveProperty('entityName', 'Switch-Top');
    });
  });

  describe('SiteAuditLogResponseDto', () => {
    it('exposes audit log + JSON changes via @Transform({obj})', () => {
      const dto = toResponse(SiteAuditLogResponseDto, {
        id: 'log-1',
        tenantId: 'tnt-1',
        userId: 'usr-1',
        action: 'UPDATE',
        entityType: 'site',
        entityId: 'site-1',
        changes: { before: { name: 'Old' }, after: { name: 'New' } },
        timestamp: new Date(),
      });
      expect(dto).toHaveProperty('action', 'UPDATE');
      expect(dto.changes).toEqual({ before: { name: 'Old' }, after: { name: 'New' } });
    });
  });

  describe('Action result shapes', () => {
    it('SiteDeletedResultResponseDto', () => {
      expect(toResponse(SiteDeletedResultResponseDto, { message: 'Site deleted successfully' })).toEqual({
        message: 'Site deleted successfully',
      });
    });
    it('SiteAttachmentDeletedResultResponseDto', () => {
      expect(
        toResponse(SiteAttachmentDeletedResultResponseDto, { message: 'Attachment deleted successfully' }),
      ).toEqual({ message: 'Attachment deleted successfully' });
    });
  });
});
