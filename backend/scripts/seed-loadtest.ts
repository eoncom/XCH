#!/usr/bin/env ts-node
/**
 * seed-loadtest.ts — Track E.4 PR2 Pass 3.1 — k6 load-test fixture seeder.
 *
 * Seeds a dedicated isolated tenant `loadtest-e4-pr2` with realistic volumes:
 *   1 tenant + 5 delegations + 5 sites + 50 users + 50 user-delegations
 *   + 10 000 assets + 100 000 AuditLog rows (90-day sliding window).
 *
 * Bulk AuditLog uses `prisma.$executeRawUnsafe` with `generate_series` (R3.1
 * mitigation — single SQL vs loop createMany 100k = >5min). Assets use
 * createMany() in 1k chunks (R3.1 vs raw SQL for type-safety on enum-like
 * fields).
 *
 * Idempotence : flag `--reset` purges loadtest tenant (FK CASCADE on Tenant
 * onDelete) and recreates. Without `--reset`, exits early if tenant exists.
 *
 * Run :
 *   cd backend
 *   npx ts-node scripts/seed-loadtest.ts [--reset]
 *
 * Pattern : ts-node shebang + PrismaClient direct (cf. check-bola.ts +
 * check-dto-coverage.ts conventions).
 */
import { PrismaClient, DelegationRight } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const TENANT_ID = 'loadtest-e4-pr2';
const TENANT_SUBDOMAIN = 'loadtest-e4-pr2';
const ADMIN_PASSWORD = 'Loadtest1234';
const BCRYPT_ROUNDS = 10;

const NB_DELEGATIONS = 5;
const NB_SITES = 5;
const NB_USERS = 50;
const NB_ASSETS = 10_000;
const NB_AUDIT_LOGS = 100_000;
const ASSETS_PER_CHUNK = 1_000;

const ASSET_TYPES = ['SERVER', 'SWITCH', 'UPS', 'AC_UNIT'];
const ASSET_STATUSES = ['IN_SERVICE', 'IN_STOCK', 'MAINTENANCE'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'READ'];
const ENTITY_TYPES = ['Asset', 'Site', 'Task', 'User', 'Expense'];

const prisma = new PrismaClient();

async function tenantExists(): Promise<boolean> {
  const t = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
  return !!t;
}

async function resetTenant(): Promise<void> {
  log(`[reset] Deleting tenant ${TENANT_ID} (FK CASCADE)…`);
  const t0 = Date.now();
  await prisma.tenant.delete({ where: { id: TENANT_ID } });
  log(`[reset] Done in ${ms(t0)}.`);
}

async function seedTenant(): Promise<void> {
  log(`[tenant] Creating tenant ${TENANT_ID}…`);
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: 'Load Test E.4 PR2',
      subdomain: TENANT_SUBDOMAIN,
      status: 'ACTIVE',
      allowInternalNetworkTargets: true,
    },
  });
}

async function seedDelegations(): Promise<string[]> {
  log(`[delegations] Creating ${NB_DELEGATIONS}…`);
  const ids: string[] = [];
  for (let i = 1; i <= NB_DELEGATIONS; i++) {
    const code = `D-LT-${String(i).padStart(2, '0')}`;
    const d = await prisma.delegation.create({
      data: {
        tenantId: TENANT_ID,
        name: `Delegation Load Test ${i}`,
        code,
        isActive: true,
      },
    });
    ids.push(d.id);
  }
  return ids;
}

async function seedSites(delegationIds: string[]): Promise<string[]> {
  log(`[sites] Creating ${NB_SITES}…`);
  const ids: string[] = [];
  for (let i = 1; i <= NB_SITES; i++) {
    const s = await prisma.site.create({
      data: {
        tenantId: TENANT_ID,
        delegationId: delegationIds[i - 1],
        code: `S-LT-${String(i).padStart(2, '0')}`,
        name: `Site Load Test ${i}`,
        status: 'ACTIVE',
        country: 'France',
        city: `City-${i}`,
      },
    });
    ids.push(s.id);
  }
  return ids;
}

async function seedUsers(delegationIds: string[]): Promise<string[]> {
  log(`[users] Creating ${NB_USERS} (+ admin) and ${NB_USERS} user-delegations…`);
  const hash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  // Admin loadtest user — super-admin AND MANAGE on every delegation.
  // isSuperAdmin alone is insufficient: AssetsController.findAll() calls
  // permissionService.getAccessibleSiteIds(tenantId, userId) which derives
  // accessible sites from UserDelegation rows. A super-admin with zero
  // UserDelegations triggers a 100% failure rate on /api/assets under k6
  // load (run 25988600189 finding). Grant MANAGE on all 5 loadtest
  // delegations to mirror a real "tenant admin" RBAC context.
  const admin = await prisma.user.create({
    data: {
      tenantId: TENANT_ID,
      email: 'admin-lt@loadtest.local',
      passwordHash: hash,
      name: 'Load Test Admin',
      isSuperAdmin: true,
      active: true,
    },
  });
  for (const delegationId of delegationIds) {
    await prisma.userDelegation.create({
      data: {
        tenantId: TENANT_ID,
        userId: admin.id,
        delegationId,
        right: 'MANAGE',
      },
    });
  }

  const userIds: string[] = [];
  for (let i = 1; i <= NB_USERS; i++) {
    const u = await prisma.user.create({
      data: {
        tenantId: TENANT_ID,
        email: `user-lt-${String(i).padStart(2, '0')}@loadtest.local`,
        passwordHash: hash,
        name: `Load Test User ${i}`,
        active: true,
      },
    });
    userIds.push(u.id);
    const right: DelegationRight =
      i % 3 === 0 ? 'MANAGE' : i % 3 === 1 ? 'WRITE' : 'READ';
    await prisma.userDelegation.create({
      data: {
        tenantId: TENANT_ID,
        userId: u.id,
        delegationId: delegationIds[(i - 1) % NB_DELEGATIONS],
        right,
      },
    });
  }
  return userIds;
}

async function seedAssets(siteIds: string[], delegationIds: string[]): Promise<void> {
  log(`[assets] Creating ${NB_ASSETS} via createMany in ${ASSETS_PER_CHUNK}-row chunks…`);
  const t0 = Date.now();
  const chunks = Math.ceil(NB_ASSETS / ASSETS_PER_CHUNK);
  let inserted = 0;
  for (let c = 0; c < chunks; c++) {
    const rows = [] as Array<{
      tenantId: string;
      delegationId: string;
      siteId: string;
      type: string;
      name: string;
      status: string;
      serialNumber: string;
    }>;
    const upper = Math.min((c + 1) * ASSETS_PER_CHUNK, NB_ASSETS);
    for (let i = c * ASSETS_PER_CHUNK; i < upper; i++) {
      const siteIdx = i % NB_SITES;
      rows.push({
        tenantId: TENANT_ID,
        delegationId: delegationIds[siteIdx],
        siteId: siteIds[siteIdx],
        type: ASSET_TYPES[i % ASSET_TYPES.length],
        name: `LT-Asset-${String(i).padStart(5, '0')}`,
        status: ASSET_STATUSES[i % ASSET_STATUSES.length],
        serialNumber: `LT-SN-${String(i).padStart(6, '0')}`,
      });
    }
    const res = await prisma.asset.createMany({ data: rows, skipDuplicates: true });
    inserted += res.count;
    if (c % 2 === 0) log(`[assets]   chunk ${c + 1}/${chunks} (${inserted} so far)`);
  }
  log(`[assets] Done: ${inserted} inserted in ${ms(t0)}.`);
}

async function seedAuditLogs(userIds: string[], delegationIds: string[]): Promise<void> {
  log(`[audit] Bulk-inserting ${NB_AUDIT_LOGS} via $executeRawUnsafe + generate_series…`);
  const t0 = Date.now();

  const userArrayLit = `ARRAY[${userIds.map((id) => `'${id}'`).join(',')}]::text[]`;
  const delegationArrayLit = `ARRAY[${delegationIds.map((id) => `'${id}'`).join(',')}, NULL]::text[]`;
  const actionArrayLit = `ARRAY[${ACTIONS.map((a) => `'${a}'`).join(',')}]::text[]`;
  const entityArrayLit = `ARRAY[${ENTITY_TYPES.map((e) => `'${e}'`).join(',')}]::text[]`;

  // gen_random_uuid()::text used for id (cuid-compatible storage); user/delegation
  // pulled from arrays. timestamp = NOW() - random() * 90 days.
  const sql = `
    INSERT INTO audit_logs (
      id, "tenantId", "delegationId", "userId",
      action, "entityType", "entityId",
      "ipAddress", "userAgent", "timestamp", changes
    )
    SELECT
      gen_random_uuid()::text,
      '${TENANT_ID}',
      (${delegationArrayLit})[1 + floor(random() * ${delegationIds.length + 1})::int],
      (${userArrayLit})[1 + floor(random() * ${userIds.length})::int],
      (${actionArrayLit})[1 + floor(random() * ${ACTIONS.length})::int],
      (${entityArrayLit})[1 + floor(random() * ${ENTITY_TYPES.length})::int],
      gen_random_uuid()::text,
      '10.0.0.' || (1 + floor(random() * 254)::int)::text,
      'k6/seed-loadtest',
      NOW() - (random() * INTERVAL '90 days'),
      '{}'::jsonb
    FROM generate_series(1, ${NB_AUDIT_LOGS});
  `;
  // Ensure pgcrypto extension for gen_random_uuid (PG 13+ has it builtin
  // but enabling is idempotent).
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await prisma.$executeRawUnsafe(sql);
  log(`[audit] Done in ${ms(t0)}.`);
}

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[seed-loadtest] ${msg}`);
}

function ms(t0: number): string {
  return `${((Date.now() - t0) / 1000).toFixed(2)}s`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const t0 = Date.now();

  log(`Starting seed (tenant=${TENANT_ID}, reset=${reset})…`);

  if (await tenantExists()) {
    if (!reset) {
      log(`Tenant ${TENANT_ID} already exists. Pass --reset to recreate. Exiting (0).`);
      process.exit(0);
    }
    await resetTenant();
  }

  await seedTenant();
  const delegationIds = await seedDelegations();
  const siteIds = await seedSites(delegationIds);
  const userIds = await seedUsers(delegationIds);
  await seedAssets(siteIds, delegationIds);
  await seedAuditLogs(userIds, delegationIds);

  log(`All done in ${ms(t0)}. Tenant ${TENANT_ID} ready for k6.`);
  log(`Admin: admin-lt@loadtest.local / ${ADMIN_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-loadtest] FAILED', err);
    await prisma.$disconnect();
    process.exit(1);
  });
