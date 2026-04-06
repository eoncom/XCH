import { PrismaClient } from '@prisma/client';

interface ScopeCondition {
  scopeType: string | null;
  scopeId: string | null;
}

/**
 * Resolves the hierarchical scope chain for a given scope.
 * Returns an array of Prisma OR conditions that include:
 * - Global (scopeType IS NULL) — always included
 * - All ancestor scopes in the hierarchy
 * - The exact scope itself
 *
 * Example for SITE: returns [global, division, delegation, site]
 * Example for DELEGATION: returns [global, division, delegation]
 * Example for DIVISION: returns [global, division]
 */
export async function resolveHierarchicalScopes(
  prisma: PrismaClient,
  scopeType: string,
  scopeId: string,
): Promise<Array<Record<string, unknown>>> {
  const conditions: Array<Record<string, unknown>> = [
    // Always include global (tenant-wide) entities
    { scopeType: null },
  ];

  switch (scopeType) {
    case 'DIVISION': {
      conditions.push({ scopeType: 'DIVISION', scopeId });
      break;
    }
    case 'DELEGATION': {
      // Load delegation to find parent division
      const delegation = await prisma.delegation.findUnique({
        where: { id: scopeId },
        select: { id: true, divisionId: true },
      });
      if (delegation) {
        if (delegation.divisionId) {
          conditions.push({ scopeType: 'DIVISION', scopeId: delegation.divisionId });
        }
        conditions.push({ scopeType: 'DELEGATION', scopeId });
      }
      break;
    }
    case 'SITE': {
      // Load site to find parent delegation, then delegation's parent division
      const site = await prisma.site.findUnique({
        where: { id: scopeId },
        select: { id: true, delegationId: true },
      });
      if (site) {
        if (site.delegationId) {
          const delegation = await prisma.delegation.findUnique({
            where: { id: site.delegationId },
            select: { id: true, divisionId: true },
          });
          if (delegation) {
            if (delegation.divisionId) {
              conditions.push({ scopeType: 'DIVISION', scopeId: delegation.divisionId });
            }
            conditions.push({ scopeType: 'DELEGATION', scopeId: delegation.id });
          }
        }
        conditions.push({ scopeType: 'SITE', scopeId });
      }
      break;
    }
  }

  return conditions;
}

/**
 * Resolves all descendant scope IDs for a given scope.
 * Used to filter entities "within" a scope (e.g., all expenses in a division includes its delegations and sites).
 *
 * Returns an array of { scopeType, scopeId } pairs, OR null if the scope covers everything.
 */
export async function resolveDescendantScopes(
  prisma: PrismaClient,
  scopeType: string,
  scopeId: string,
): Promise<ScopeCondition[]> {
  const conditions: ScopeCondition[] = [
    { scopeType, scopeId },
  ];

  switch (scopeType) {
    case 'DIVISION': {
      // Include all delegations of this division
      const delegations = await prisma.delegation.findMany({
        where: { divisionId: scopeId },
        select: { id: true },
      });
      for (const d of delegations) {
        conditions.push({ scopeType: 'DELEGATION', scopeId: d.id });
      }
      // Include all sites of those delegations
      const sites = await prisma.site.findMany({
        where: { delegation: { divisionId: scopeId } },
        select: { id: true },
      });
      for (const s of sites) {
        conditions.push({ scopeType: 'SITE', scopeId: s.id });
      }
      break;
    }
    case 'DELEGATION': {
      // Include all sites of this delegation
      const sites = await prisma.site.findMany({
        where: { delegationId: scopeId },
        select: { id: true },
      });
      for (const s of sites) {
        conditions.push({ scopeType: 'SITE', scopeId: s.id });
      }
      break;
    }
    // SITE has no descendants
  }

  return conditions;
}
