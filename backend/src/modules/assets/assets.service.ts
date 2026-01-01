import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { FilterAssetDto } from './dto/filter-asset.dto';
import { QRCodeService } from '../../common/services/qrcode.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AssetsService {
  private readonly SERIAL_REQUIRED_TYPES = ['PRINTER', 'IPAD', 'TABLET', 'SWITCH', 'FIREWALL', 'TEAMS_ROOM'];

  constructor(
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    private qrCodeService: QRCodeService,
    private configService: ConfigService,
  ) {}

  async create(tenantId: string, createAssetDto: CreateAssetDto) {
    // Validate serial number for critical types
    if (this.SERIAL_REQUIRED_TYPES.includes(createAssetDto.type) && !createAssetDto.serialNumber) {
      throw new BadRequestException(
        `Serial number is required for asset type: ${createAssetDto.type}`,
      );
    }

    // Check unique serial number if provided
    if (createAssetDto.serialNumber) {
      const existing = await this.prisma.asset.findFirst({
        where: {
          tenantId,
          serialNumber: createAssetDto.serialNumber,
        },
      });

      if (existing) {
        throw new ConflictException('Asset with this serial number already exists');
      }
    }

    const asset = await this.prisma.asset.create({
      data: {
        ...createAssetDto,
        tenantId,
      },
      include: {
        site: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        rack: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return asset;
  }

  async findAll(tenantId: string, filter?: FilterAssetDto) {
    const where: any = { tenantId };

    if (filter?.type) {
      where.type = filter.type;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.siteId) {
      where.siteId = filter.siteId;
    }

    if (filter?.rackId) {
      where.rackId = filter.rackId;
    }

    if (filter?.withoutSerialNumber === 'true') {
      where.serialNumber = null;
    }

    if (filter?.withoutLocation === 'true') {
      where.AND = [
        { locationText: null },
        { rackId: null },
      ];
    }

    if (filter?.search) {
      where.OR = [
        { model: { contains: filter.search, mode: 'insensitive' } },
        { serialNumber: { contains: filter.search, mode: 'insensitive' } },
        { manufacturer: { contains: filter.search, mode: 'insensitive' } },
        { inventoryTag: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const assets = await this.prisma.asset.findMany({
      where,
      include: {
        site: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        rack: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return assets;
  }

  async findOne(id: string, tenantId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        site: true,
        rack: true,
        pins: {
          include: {
            floorPlan: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        photos: true,
        externalRefs: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async update(id: string, tenantId: string, updateAssetDto: UpdateAssetDto) {
    await this.findOne(id, tenantId);

    // Validate serial number if type is being changed to critical type
    if (updateAssetDto.type && this.SERIAL_REQUIRED_TYPES.includes(updateAssetDto.type)) {
      const asset = await this.prisma.asset.findUnique({ where: { id } });
      if (!asset.serialNumber && !updateAssetDto.serialNumber) {
        throw new BadRequestException(
          `Serial number is required for asset type: ${updateAssetDto.type}`,
        );
      }
    }

    const asset = await this.prisma.asset.update({
      where: { id },
      data: updateAssetDto,
      include: {
        site: true,
        rack: true,
      },
    });

    return asset;
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.asset.delete({
      where: { id },
    });

    return { message: 'Asset deleted successfully' };
  }

  async generateQRCode(id: string, tenantId: string) {
    const asset = await this.findOne(id, tenantId);

    const token = this.qrCodeService.generateSecureToken();
    const baseUrl = this.configService.get('APP_URL', 'http://localhost:3000');
    const qrUrl = this.qrCodeService.generateAssetQRUrl(baseUrl, asset.id, token);

    const qrCodeDataUrl = await this.qrCodeService.generateQRCode(qrUrl);

    // TODO: Store token in database for validation on scan
    // For now, return QR code directly

    return {
      assetId: asset.id,
      qrCodeDataUrl,
      qrUrl,
      token,
    };
  }

  async bulkGenerateQRCodes(assetIds: string[], tenantId: string) {
    const qrCodes = [];

    for (const assetId of assetIds) {
      try {
        const qrCode = await this.generateQRCode(assetId, tenantId);
        qrCodes.push(qrCode);
      } catch (error) {
        qrCodes.push({
          assetId,
          error: error.message,
        });
      }
    }

    return qrCodes;
  }

  async getStatsByType(tenantId: string) {
    const stats = await this.prisma.asset.groupBy({
      by: ['type'],
      where: { tenantId },
      _count: {
        type: true,
      },
    });

    return stats;
  }

  async getStatsBySite(tenantId: string) {
    const stats = await this.prisma.asset.groupBy({
      by: ['siteId'],
      where: { tenantId },
      _count: {
        siteId: true,
      },
    });

    const sitesData = await this.prisma.site.findMany({
      where: {
        id: {
          in: stats.map(s => s.siteId),
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    return stats.map(stat => ({
      siteId: stat.siteId,
      count: stat._count.siteId,
      site: sitesData.find(s => s.id === stat.siteId),
    }));
  }
}
