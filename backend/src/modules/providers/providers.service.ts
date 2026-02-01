import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { QueryProviderDto } from './dto/query-provider.dto';

@Injectable()
export class ProvidersService {
  constructor(private prisma: PrismaClient) {}

  async create(tenantId: string, dto: CreateProviderDto) {
    return this.prisma.provider.create({
      data: {
        tenantId,
        ...dto,
      },
    });
  }

  async findAll(tenantId: string, query: QueryProviderDto) {
    const where: any = { tenantId };

    if (query.type) {
      where.type = query.type;
    }

    return this.prisma.provider.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const provider = await this.prisma.provider.findFirst({
      where: { id, tenantId },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    return provider;
  }

  async update(tenantId: string, id: string, dto: UpdateProviderDto) {
    await this.findOne(tenantId, id); // Vérifie existence

    return this.prisma.provider.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // Vérifie existence

    await this.prisma.provider.delete({
      where: { id },
    });

    return { message: 'Provider deleted successfully' };
  }
}
