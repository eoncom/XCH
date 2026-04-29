import { PrismaClient, DelegationRight } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * ADR-021 — RBAC test seed.
 *
 * Provisions a deterministic dataset for intrusion tests :
 *   - 1 tenant, 2 delegations (A, B).
 *   - 5 users :
 *       admin@rbac.test            — super admin (no UserDelegation rows).
 *       manager-a@rbac.test        — MANAGE on delegation A.
 *       tech-a@rbac.test           — WRITE on delegation A.
 *       viewer-a@rbac.test         — READ on delegation A.
 *       manager-b@rbac.test        — MANAGE on delegation B.
 *   - 1 site per delegation, 1 contact per delegation + 1 global contact.
 *   - 1 connectivity link per delegation.
 *
 * Specs may add their own rows on top (per-module seed) but the base
 * matrix is fixed. Common password = 'Rbac1234'.
 */

export const RBAC_SEED_PASSWORD = 'Rbac1234';

export interface RbacSeedResult {
  tenantId: string;
  delegations: { a: string; b: string };
  users: {
    admin: { id: string; email: string };
    managerA: { id: string; email: string };
    techA: { id: string; email: string };
    viewerA: { id: string; email: string };
    managerB: { id: string; email: string };
  };
  sites: { a: string; b: string };
  contacts: { aContactId: string; bContactId: string; globalContactId: string };
  links: { aLinkId: string; bLinkId: string };
}

const TENANT_ID = 'rbac-tenant';
const DEL_A = 'rbac-del-a';
const DEL_B = 'rbac-del-b';

export async function seedRbac(prisma: PrismaClient): Promise<RbacSeedResult> {
  await wipeRbac(prisma);

  const passwordHash = await bcrypt.hash(RBAC_SEED_PASSWORD, 10);

  // Tenant
  await prisma.tenant.create({
    data: { id: TENANT_ID, name: 'RBAC Test Tenant', subdomain: 'rbac-test', status: 'ACTIVE' },
  });

  // Delegations
  await prisma.delegation.create({
    data: { id: DEL_A, tenantId: TENANT_ID, code: 'DEL-A', name: 'Délégation A' },
  });
  await prisma.delegation.create({
    data: { id: DEL_B, tenantId: TENANT_ID, code: 'DEL-B', name: 'Délégation B' },
  });

  // Users
  const admin = await prisma.user.create({
    data: {
      id: 'rbac-user-admin',
      tenantId: TENANT_ID,
      email: 'admin@rbac.test',
      name: 'Admin Super',
      passwordHash,
      authProvider: 'local',
      isSuperAdmin: true,
      active: true,
    },
  });
  const managerA = await prisma.user.create({
    data: {
      id: 'rbac-user-manager-a',
      tenantId: TENANT_ID,
      email: 'manager-a@rbac.test',
      name: 'Manager A',
      passwordHash,
      authProvider: 'local',
      active: true,
    },
  });
  const techA = await prisma.user.create({
    data: {
      id: 'rbac-user-tech-a',
      tenantId: TENANT_ID,
      email: 'tech-a@rbac.test',
      name: 'Tech A',
      passwordHash,
      authProvider: 'local',
      active: true,
    },
  });
  const viewerA = await prisma.user.create({
    data: {
      id: 'rbac-user-viewer-a',
      tenantId: TENANT_ID,
      email: 'viewer-a@rbac.test',
      name: 'Viewer A',
      passwordHash,
      authProvider: 'local',
      active: true,
    },
  });
  const managerB = await prisma.user.create({
    data: {
      id: 'rbac-user-manager-b',
      tenantId: TENANT_ID,
      email: 'manager-b@rbac.test',
      name: 'Manager B',
      passwordHash,
      authProvider: 'local',
      active: true,
    },
  });

  // UserDelegations
  await prisma.userDelegation.createMany({
    data: [
      { tenantId: TENANT_ID, userId: managerA.id, delegationId: DEL_A, right: DelegationRight.MANAGE },
      { tenantId: TENANT_ID, userId: techA.id,    delegationId: DEL_A, right: DelegationRight.WRITE },
      { tenantId: TENANT_ID, userId: viewerA.id,  delegationId: DEL_A, right: DelegationRight.READ },
      { tenantId: TENANT_ID, userId: managerB.id, delegationId: DEL_B, right: DelegationRight.MANAGE },
    ],
  });

  // Sites
  const siteA = await prisma.site.create({
    data: {
      id: 'rbac-site-a',
      tenantId: TENANT_ID,
      delegationId: DEL_A,
      code: 'SITE-A',
      name: 'Site A',
      status: 'ACTIVE',
      healthStatus: 'UNKNOWN',
    },
  });
  const siteB = await prisma.site.create({
    data: {
      id: 'rbac-site-b',
      tenantId: TENANT_ID,
      delegationId: DEL_B,
      code: 'SITE-B',
      name: 'Site B',
      status: 'ACTIVE',
      healthStatus: 'UNKNOWN',
    },
  });

  // ContactType (required FK for Contact)
  const contactType = await prisma.contactType.create({
    data: {
      id: 'rbac-contact-type',
      tenantId: TENANT_ID,
      slug: 'rbac-default',
      name: 'Default',
      category: 'TECHNICAL',
      isActive: true,
    },
  });

  // Contacts : one per delegation + one global (delegationId=null)
  const aContact = await prisma.contact.create({
    data: {
      id: 'rbac-contact-a',
      tenantId: TENANT_ID,
      delegationId: DEL_A,
      typeId: contactType.id,
      name: 'Contact A',
      isActive: true,
    },
  });
  const bContact = await prisma.contact.create({
    data: {
      id: 'rbac-contact-b',
      tenantId: TENANT_ID,
      delegationId: DEL_B,
      typeId: contactType.id,
      name: 'Contact B',
      isActive: true,
    },
  });
  const globalContact = await prisma.contact.create({
    data: {
      id: 'rbac-contact-global',
      tenantId: TENANT_ID,
      delegationId: null,
      typeId: contactType.id,
      name: 'Contact Global',
      isActive: true,
    },
  });

  // ConnectivityLinks : one per site (provider + type required, role default PRIMARY)
  const aLink = await prisma.connectivityLink.create({
    data: {
      id: 'rbac-link-a',
      tenantId: TENANT_ID,
      siteId: siteA.id,
      provider: 'Test ISP A',
      type: 'FIBER',
    },
  });
  const bLink = await prisma.connectivityLink.create({
    data: {
      id: 'rbac-link-b',
      tenantId: TENANT_ID,
      siteId: siteB.id,
      provider: 'Test ISP B',
      type: 'FIBER',
    },
  });

  return {
    tenantId: TENANT_ID,
    delegations: { a: DEL_A, b: DEL_B },
    users: {
      admin: { id: admin.id, email: admin.email },
      managerA: { id: managerA.id, email: managerA.email },
      techA: { id: techA.id, email: techA.email },
      viewerA: { id: viewerA.id, email: viewerA.email },
      managerB: { id: managerB.id, email: managerB.email },
    },
    sites: { a: siteA.id, b: siteB.id },
    contacts: { aContactId: aContact.id, bContactId: bContact.id, globalContactId: globalContact.id },
    links: { aLinkId: aLink.id, bLinkId: bLink.id },
  };
}

/**
 * Cleanup. ON DELETE CASCADE on Tenant cascades to all child rows.
 */
export async function wipeRbac(prisma: PrismaClient): Promise<void> {
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}
