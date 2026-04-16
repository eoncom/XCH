import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateAssetModelDto, UpdateAssetModelDto, FilterAssetModelDto } from './dto/create-asset-model.dto';
import { buildPaginatedResponse } from '../../common/interfaces/paginated.interface';

@Injectable()
export class AssetModelsService {
  constructor(private prisma: PrismaClient) {}

  async create(tenantId: string, dto: CreateAssetModelDto) {
    // Check unique name per tenant
    const existing = await this.prisma.assetModel.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`A model named "${dto.name}" already exists`);
    }

    return this.prisma.assetModel.create({
      data: {
        tenantId,
        name: dto.name,
        manufacturer: dto.manufacturer || null,
        type: dto.type,
        acquisitionPrice: dto.acquisitionPrice ?? null,
        monthlyPrice: dto.monthlyPrice ?? null,
        currency: dto.currency || 'EUR',
        pricingMode: dto.pricingMode || 'ONE_TIME',
        powerConsumption: dto.powerConsumption ?? null,
        weight: dto.weight ?? null,
        defaultUHeight: dto.defaultUHeight ?? null,
        notes: dto.notes || null,
      },
    });
  }

  async findAll(tenantId: string, filters: FilterAssetModelDto = {}) {
    const where: any = { tenantId };

    if (filters.type) where.type = filters.type;
    if (filters.manufacturer) where.manufacturer = { contains: filters.manufacturer, mode: 'insensitive' };
    if (filters.isActive !== undefined) {
      where.isActive = String(filters.isActive) === 'true';
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { manufacturer: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 50;

    const [data, total] = await Promise.all([
      this.prisma.assetModel.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { assets: true } } },
      }),
      this.prisma.assetModel.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async findOne(tenantId: string, id: string) {
    const model = await this.prisma.assetModel.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { assets: true } } },
    });
    if (!model) throw new NotFoundException('Asset model not found');
    return model;
  }

  async update(tenantId: string, id: string, dto: UpdateAssetModelDto) {
    const model = await this.prisma.assetModel.findFirst({
      where: { id, tenantId },
    });
    if (!model) throw new NotFoundException('Asset model not found');

    // Check name uniqueness if changing
    if (dto.name && dto.name !== model.name) {
      const existing = await this.prisma.assetModel.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException(`A model named "${dto.name}" already exists`);
      }
    }

    return this.prisma.assetModel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.manufacturer !== undefined && { manufacturer: dto.manufacturer }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.acquisitionPrice !== undefined && { acquisitionPrice: dto.acquisitionPrice }),
        ...(dto.monthlyPrice !== undefined && { monthlyPrice: dto.monthlyPrice }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.pricingMode !== undefined && { pricingMode: dto.pricingMode }),
        ...(dto.powerConsumption !== undefined && { powerConsumption: dto.powerConsumption }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.defaultUHeight !== undefined && { defaultUHeight: dto.defaultUHeight }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const model = await this.prisma.assetModel.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { assets: true } } },
    });
    if (!model) throw new NotFoundException('Asset model not found');

    if (model._count.assets > 0) {
      throw new ConflictException(
        `Cannot delete model "${model.name}": used by ${model._count.assets} asset(s). Unlink them first.`,
      );
    }

    await this.prisma.assetModel.delete({ where: { id } });
    return { deleted: true };
  }
}
