import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Validates coherence between delegationId and siteId (R1).
 *
 * Rules:
 * - If siteId is provided, site.delegationId must match delegationId
 * - If delegationId is null, siteId must be null
 * - If siteId is provided but delegationId is missing, error
 */
export async function validateDelegationSiteCoherence(
  prisma: PrismaClient,
  delegationId: string | null | undefined,
  siteId: string | null | undefined,
): Promise<void> {
  if (!siteId) return; // No site, nothing to validate

  if (!delegationId) {
    throw new BadRequestException(
      'siteId cannot be set when delegationId is null (global entities cannot be attached to a site)',
    );
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { delegationId: true },
  });

  if (!site) {
    throw new BadRequestException(`Site ${siteId} not found`);
  }

  if (site.delegationId !== delegationId) {
    throw new BadRequestException(
      `Site ${siteId} does not belong to delegation ${delegationId}`,
    );
  }
}
