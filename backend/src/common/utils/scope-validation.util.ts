import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const VALID_SCOPE_TYPES = ['DIVISION', 'DELEGATION', 'SITE'] as const;
export type ScopeType = (typeof VALID_SCOPE_TYPES)[number];

/**
 * Validates that a scopeType/scopeId pair references an existing entity in the tenant.
 * Throws NotFoundException if the entity doesn't exist, BadRequestException if scopeType is invalid.
 * Returns the resolved entity for further use.
 */
export async function validateScope(
  prisma: PrismaClient,
  tenantId: string,
  scopeType: string | null | undefined,
  scopeId: string | null | undefined,
): Promise<{ id: string; name: string } | null> {
  if (!scopeType && !scopeId) return null;

  if (!scopeType || !scopeId) {
    throw new BadRequestException(
      'scopeType and scopeId must both be provided or both be null',
    );
  }

  if (!VALID_SCOPE_TYPES.includes(scopeType as ScopeType)) {
    throw new BadRequestException(
      `Invalid scopeType "${scopeType}". Must be one of: ${VALID_SCOPE_TYPES.join(', ')}`,
    );
  }

  switch (scopeType) {
    case 'DIVISION': {
      const division = await prisma.division.findFirst({
        where: { id: scopeId, tenantId },
        select: { id: true, name: true },
      });
      if (!division) throw new NotFoundException(`Division "${scopeId}" not found`);
      return division;
    }
    case 'DELEGATION': {
      const delegation = await prisma.delegation.findFirst({
        where: { id: scopeId, tenantId },
        select: { id: true, name: true },
      });
      if (!delegation) throw new NotFoundException(`Delegation "${scopeId}" not found`);
      return delegation;
    }
    case 'SITE': {
      const site = await prisma.site.findFirst({
        where: { id: scopeId, tenantId },
        select: { id: true, name: true },
      });
      if (!site) throw new NotFoundException(`Site "${scopeId}" not found`);
      return site;
    }
    default:
      throw new BadRequestException(`Invalid scopeType "${scopeType}"`);
  }
}
