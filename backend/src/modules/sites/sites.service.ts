import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { FilterSiteDto } from './dto/filter-site.dto';

@Injectable()
export class SitesService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: PrismaClient) {}

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

    const site = await this.prisma.$executeRawUnsafe(
      `INSERT INTO "sites" ("id", "tenantId", "code", "name", "status", "address", "city", "postalCode", "country", "coordinates", "healthStatus", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, ${coordinates ? `ST_GeomFromText($9, 4326)` : 'NULL'}, $10, NOW(), NOW())
       RETURNING *`,
      tenantId,
      siteData.code,
      siteData.name,
      siteData.status || 'ACTIVE',
      siteData.address,
      siteData.city,
      siteData.postalCode || null,
      siteData.country || 'France',
      ...(coordinates ? [coordinates.replace('POINT(', '').replace(')', '')] : []),
      siteData.healthStatus || 'UNKNOWN',
    );

    return this.findOne(site[0].id, tenantId);
  }

  async findAll(tenantId: string, filter?: FilterSiteDto) {
    const where: any = { tenantId };

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.healthStatus) {
      where.healthStatus = filter.healthStatus;
    }

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { code: { contains: filter.search, mode: 'insensitive' } },
        { city: { contains: filter.search, mode: 'insensitive' } },
        { address: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const sites = await this.prisma.site.findMany({
      where,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return sites;
  }

  async findOne(id: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        _count: {
          select: {
            assets: true,
            racks: true,
            tasks: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    return site;
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
