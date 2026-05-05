import { instanceToPlain } from 'class-transformer';
import { toResponse } from '../../common/utils/to-response.util';
import { FloorPlanResponseDto } from './dto/floor-plan.response.dto';
import { PinResponseDto } from './dto/pin.response.dto';
import { FloorPlanListResponseDto } from './dto/floor-plan-list.response.dto';
import { FloorPlanPdfInspectResponseDto } from './dto/floor-plan-pdf-inspect.response.dto';
import { FloorPlanHeatmapDataResponseDto } from './dto/floor-plan-heatmap-data.response.dto';
import { FloorPlanStatsResponseDto } from './dto/floor-plan-stats.response.dto';
import {
  FloorPlanDeletedResultResponseDto,
  FloorPlanPinDeletedResultResponseDto,
} from './dto/floor-plan-action-result.response.dto';

describe('Floor-plans response DTO shapes', () => {
  describe('FloorPlanResponseDto', () => {
    it('exposes scalars + scaleRefLine passthrough + pins[]', () => {
      const dto = toResponse(FloorPlanResponseDto, {
        id: 'fp-1',
        tenantId: 'tnt-1',
        siteId: 'site-1',
        name: 'RDC',
        floor: '0',
        building: 'A',
        notes: null,
        fileUrl: '/storage/fp-1.png',
        fileType: 'image/png',
        fileSize: 12345,
        width: 1920,
        height: 1080,
        scaleMetersPerPixel: 0.05,
        scaleRefLine: { x1: 0, y1: 0, x2: 100, y2: 0, lengthMeters: 5 },
        version: 2,
        parentId: 'fp-0',
        createdAt: new Date(),
        updatedAt: new Date(),
        pins: [
          {
            id: 'p-1',
            tenantId: 'tnt-1',
            floorPlanId: 'fp-1',
            pinType: 'WIFI_AP',
            x: 10,
            y: 20,
            label: 'AP Salon',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        // Extraneous.
        _internalCounter: 99,
      });
      expect(dto).toHaveProperty('id', 'fp-1');
      expect(dto).toHaveProperty('version', 2);
      expect(dto.scaleRefLine).toMatchObject({ lengthMeters: 5 });
      expect(dto.pins).toHaveLength(1);
      expect(dto.pins?.[0]).toHaveProperty('pinType', 'WIFI_AP');
      expect(dto).not.toHaveProperty('_internalCounter');
    });
  });

  describe('PinResponseDto', () => {
    it('exposes pin scalars + asset/rack/link passthrough', () => {
      const dto = toResponse(PinResponseDto, {
        id: 'p-1',
        tenantId: 'tnt-1',
        floorPlanId: 'fp-1',
        pinType: 'ASSET',
        x: 10,
        y: 20,
        label: 'Switch top',
        notes: null,
        assetId: 'ast-1',
        rackId: null,
        linkId: null,
        asset: { id: 'ast-1', name: 'Switch-1' },
        rack: null,
        link: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(dto).toHaveProperty('pinType', 'ASSET');
      expect(dto.asset).toMatchObject({ name: 'Switch-1' });
      expect(dto.rack).toBeNull();
    });
  });

  describe('FloorPlanListResponseDto', () => {
    it('maps data + meta', () => {
      const dto = toResponse(FloorPlanListResponseDto, {
        data: [],
        meta: { total: 0, page: 1, pageSize: 25, totalPages: 0 },
      });
      expect(dto.meta).toEqual({ total: 0, page: 1, pageSize: 25, totalPages: 0 });
    });
  });

  describe('FloorPlanPdfInspectResponseDto', () => {
    it('exposes pageCount + pages thumbnails', () => {
      const dto = toResponse(FloorPlanPdfInspectResponseDto, {
        pageCount: 3,
        pages: [
          { page: 1, thumbnail: 'data:image/png;base64,abc' },
          { page: 2, thumbnail: 'data:image/png;base64,def' },
          { page: 3, thumbnail: 'data:image/png;base64,ghi' },
        ],
      });
      expect(dto.pageCount).toBe(3);
      expect(dto.pages).toHaveLength(3);
      expect(dto.pages[0]).toHaveProperty('page', 1);
    });
  });

  describe('FloorPlanHeatmapDataResponseDto', () => {
    it('exposes scale info + accessPoints array', () => {
      const dto = toResponse(FloorPlanHeatmapDataResponseDto, {
        floorPlanId: 'fp-1',
        scaleMetersPerPixel: 0.05,
        scaleRefLine: null,
        accessPoints: [{ pinId: 'p-1', x: 10, y: 20, label: 'AP-1', asset: { id: 'ast-1' } }],
      });
      expect(dto).toHaveProperty('floorPlanId', 'fp-1');
      expect(dto.accessPoints).toHaveLength(1);
    });
  });

  describe('FloorPlanStatsResponseDto', () => {
    it('exposes totalPins + byType passthrough Record', () => {
      const dto = toResponse(FloorPlanStatsResponseDto, {
        totalPins: 10,
        byType: { NRO: 1, SDB: 2, WIFI_AP: 7 },
      });
      expect(dto.totalPins).toBe(10);
      expect(dto.byType).toEqual({ NRO: 1, SDB: 2, WIFI_AP: 7 });
    });

    it('runtime serialization preserves byType keys', () => {
      const dto = toResponse(FloorPlanStatsResponseDto, {
        totalPins: 3,
        byType: { ASSET: 1, RACK: 2 },
      });
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).toContain('"ASSET":1');
      expect(wireJson).toContain('"RACK":2');
    });
  });

  describe('Action result shapes', () => {
    it('FloorPlanDeletedResultResponseDto', () => {
      expect(toResponse(FloorPlanDeletedResultResponseDto, { message: 'Floor plan deleted successfully' })).toEqual({
        message: 'Floor plan deleted successfully',
      });
    });
    it('FloorPlanPinDeletedResultResponseDto', () => {
      expect(toResponse(FloorPlanPinDeletedResultResponseDto, { message: 'Pin deleted successfully' })).toEqual({
        message: 'Pin deleted successfully',
      });
    });
  });
});
