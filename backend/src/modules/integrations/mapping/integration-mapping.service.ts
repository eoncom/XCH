import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class IntegrationMappingService {
  private readonly logger = new Logger(IntegrationMappingService.name);

  constructor(private readonly prisma: PrismaClient) {}

  async getMappings(tenantId: string, provider: string, entityType: string) {
    return this.prisma.integrationMapping.findMany({
      where: { tenantId, provider, entityType },
      orderBy: { externalLabel: 'asc' },
    });
  }

  async saveMappings(
    tenantId: string,
    provider: string,
    entityType: string,
    mappings: Array<{
      externalId: string;
      externalLabel: string;
      targetType: string;
      targetId: string;
    }>,
  ) {
    const results = [];

    for (const mapping of mappings) {
      const result = await this.prisma.integrationMapping.upsert({
        where: {
          tenantId_provider_entityType_externalId: {
            tenantId,
            provider,
            entityType,
            externalId: mapping.externalId,
          },
        },
        update: {
          externalLabel: mapping.externalLabel,
          targetType: mapping.targetType,
          targetId: mapping.targetId,
        },
        create: {
          tenantId,
          provider,
          entityType,
          externalId: mapping.externalId,
          externalLabel: mapping.externalLabel,
          targetType: mapping.targetType,
          targetId: mapping.targetId,
        },
      });
      results.push(result);
    }

    this.logger.log(`Saved ${results.length} mappings for ${provider}/${entityType}`);
    return results;
  }

  async deleteMapping(tenantId: string, id: string) {
    return this.prisma.integrationMapping.deleteMany({
      where: { id, tenantId },
    });
  }

  async deleteMappings(tenantId: string, provider: string, entityType: string) {
    return this.prisma.integrationMapping.deleteMany({
      where: { tenantId, provider, entityType },
    });
  }

  async getMappingByExternalId(
    tenantId: string,
    provider: string,
    entityType: string,
    externalId: string,
  ) {
    return this.prisma.integrationMapping.findUnique({
      where: {
        tenantId_provider_entityType_externalId: {
          tenantId,
          provider,
          entityType,
          externalId,
        },
      },
    });
  }
}
