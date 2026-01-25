import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { FilterSiteDto } from './dto/filter-site.dto';

@Injectable()
export class SitesService {
  constructor(private prisma: PrismaClient) {}

  async create(tenantId: string, createSiteDto: CreateSiteDto) {
    const existing = await this.prisma.site.findFirst({
      where: {
        tenantId,
        code: createSiteDto.code,
      },
    });

    if (existing) {
      throw new ConflictException('Site with this code already exists');
    }

    let coordinates = null;
    if (createSiteDto.latitude && createSiteDto.longitude) {
      coordinates = `POINT(${createSiteDto.longitude} ${createSiteDto.latitude})`;
    }

    const { latitude, longitude, ...siteData } = createSiteDto;

    const result = await this.prisma.$queryRawUnsafe<{id: string}[]>(
      `INSERT INTO "sites" ("id", "tenantId", "code", "name", "status", "address", "city", "postalCode", "country", "coordinates", "healthStatus", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::"SiteStatus", $5, $6, $7, $8, ${coordinates ? `ST_GeomFromText($9, 4326)` : 'NULL'}, $10::"HealthStatus", NOW(), NOW())
       RETURNING id`,
      tenantId,
      siteData.code,
      siteData.name,
      siteData.status || 'ACTIVE',
      siteData.address,
      siteData.city,
      siteData.postalCode || null,
      siteData.country || 'France',
      ...(coordinates ? [coordinates] : []),
      siteData.healthStatus || 'UNKNOWN',
    );

    return this.findOne(result[0].id, tenantId);
  }

  async findAll(tenantId: string, filter?: FilterSiteDto) {
    // Build WHERE clause for raw query
    let whereClause = `s."tenantId" = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filter?.status) {
      whereClause += ` AND s.status = $${paramIndex}`;
      params.push(filter.status);
      paramIndex++;
    }

    if (filter?.healthStatus) {
      whereClause += ` AND s."healthStatus" = $${paramIndex}`;
      params.push(filter.healthStatus);
      paramIndex++;
    }

    if (filter?.search) {
      whereClause += ` AND (
        s.name ILIKE $${paramIndex} OR
        s.code ILIKE $${paramIndex} OR
        s.city ILIKE $${paramIndex} OR
        s.address ILIKE $${paramIndex}
      )`;
      params.push(`%${filter.search}%`);
      paramIndex++;
    }

    // Use raw query to extract latitude/longitude from PostGIS coordinates
    const sites = await this.prisma.$queryRawUnsafe(`
      SELECT
        s.id,
        s."tenantId",
        s.code,
        s.name,
        s.status,
        s.address,
        s.city,
        s."postalCode",
        s.country,
        s.contacts,
        s."accessNotes",
        s.connectivity,
        s."healthStatus",
        s."lastHealthCheck",
        s.notes,
        s."createdAt",
        s."updatedAt",
        ST_Y(s.coordinates::geometry) as latitude,
        ST_X(s.coordinates::geometry) as longitude
      FROM "sites" s
      WHERE ${whereClause}
      ORDER BY s."updatedAt" DESC
    `, ...params);

    return sites;
  }

  async findOne(id: string, tenantId: string) {
    // Use raw query to extract latitude/longitude from PostGIS coordinates
    const sites = await this.prisma.$queryRawUnsafe(`
      SELECT
        s.id,
        s."tenantId",
        s.code,
        s.name,
        s.status,
        s.address,
        s.city,
        s."postalCode",
        s.country,
        s.contacts,
        s."accessNotes",
        s.connectivity,
        s."healthStatus",
        s."lastHealthCheck",
        s.notes,
        s."createdAt",
        s."updatedAt",
        ST_Y(s.coordinates::geometry) as latitude,
        ST_X(s.coordinates::geometry) as longitude,
        (SELECT COUNT(*) FROM "assets" a WHERE a."siteId" = s.id) as "_count_assets",
        (SELECT COUNT(*) FROM "racks" r WHERE r."siteId" = s.id) as "_count_racks",
        (SELECT COUNT(*) FROM "tasks" t WHERE t."siteId" = s.id) as "_count_tasks"
      FROM "sites" s
      WHERE s.id = $1 AND s."tenantId" = $2
    `, id, tenantId);

    if (!sites || (sites as any[]).length === 0) {
      throw new NotFoundException('Site not found');
    }

    const site = (sites as any[])[0];

    // Transform counts to match Prisma include format
    return {
      ...site,
      _count: {
        assets: Number(site._count_assets) || 0,
        racks: Number(site._count_racks) || 0,
        tasks: Number(site._count_tasks) || 0,
      },
      _count_assets: undefined,
      _count_racks: undefined,
      _count_tasks: undefined,
    };
  }

  async update(id: string, tenantId: string, updateSiteDto: UpdateSiteDto) {
    await this.findOne(id, tenantId);

    const { latitude, longitude, ...siteData } = updateSiteDto;

    if (latitude !== undefined && longitude !== undefined) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "sites" SET coordinates = ST_GeomFromText('POINT(${longitude} ${latitude})', 4326) WHERE id = $1`,
        id,
      );
    }

    return this.prisma.site.update({
      where: { id },
      data: siteData,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.site.delete({
      where: { id },
    });

    return { message: 'Site deleted successfully' };
  }

  async findNearby(latitude: number, longitude: number, radiusKm: number, tenantId: string) {
    const sites = await this.prisma.$queryRawUnsafe(`
      SELECT s.*,
             ST_Distance(s.coordinates::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 as distance_km
      FROM "sites" s
      WHERE s."tenantId" = $3
        AND s.coordinates IS NOT NULL
        AND ST_DWithin(s.coordinates::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $4)
      ORDER BY distance_km ASC
    `, longitude, latitude, tenantId, radiusKm * 1000);

    return sites;
  }
}
