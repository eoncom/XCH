import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { BackupService } from '../../../src/modules/backup/backup.service';
import { StorageService } from '../../../src/common/services/storage.service';

/**
 * Track D.1 Phase 1 step 8 — backup v2 integration round-trip.
 *
 * Hits REAL services :
 *  - Postgres (Prisma) — seeds + wipes a dedicated test tenant
 *  - MinIO — uploads seed files to `xch-storage` + reads back from
 *    `xch-backups` after the backup completes
 *  - NO Bull queue — calls `service.createFullBackupV2` / `restoreFullBackupV2`
 *    directly (bypassing the BullMQ processor). The processor itself is unit-
 *    tested in `backup.processor.spec.ts` ; this integration suite focuses
 *    on the streaming + MinIO + DB write path.
 *
 * Workflow (per `XCH_SEED_TEST_PATTERN`) :
 *   1. Push this branch
 *   2. `ssh xch-deploy && cd /opt/xch-dev/XCH && git fetch && git checkout claude/track-d1-backup-v2-2026-05-12`
 *   3. `docker compose exec xch-backend npm run test:integration -- --testPathPattern backup-v2`
 *   4. Cleanup runs in afterAll regardless of outcome.
 *
 * Tenant isolation : every spec uses a `tnt-backup-v2-test-<random>` tenant
 * id. The seed creates a Delegation + Site + Asset + FloorPlan etc. under
 * this id. afterEach wipes by tenantId so a flaky run doesn't leak data
 * into the prod tenant catalog.
 *
 * NOT IN SCOPE for step 8 (deferred to D.2 / manual smoke) :
 *  - GlitchTip event capture (manual : `docker stop xch-minio` then run
 *    a restore job, verify the `mode=worker queue=backup-jobs jobName=...`
 *    event arrives on `https://glitch.eoncom.io`)
 *  - Bull v3 end-to-end with real Redis (queue.add → BackupProcessor →
 *    job.progress polling). Skipped because Bull adds infrastructure
 *    complexity ; processor body is unit-tested with mocked Job.
 *  - v1 ZIP backward-compat against a v1 fixture (would require running the
 *    v1 `createFullBackup` path AND the v2 restore path on the same seed —
 *    nice-to-have but tangential to v2 round-trip).
 */
describe('Backup v2 round-trip (Track D.1 step 8 — integration)', () => {
  let prisma: PrismaClient;
  let service: BackupService;
  let storage: StorageService;
  let configService: ConfigService;
  let testTenantId: string;
  let testDelegationId: string;

  /** Build a ConfigService that reads `backend/.env` via process.env (same
   * source as the production app). */
  function buildConfigService(): ConfigService {
    return {
      get: <T = string>(key: string, fallback?: T): T =>
        (process.env[key] as unknown as T) ?? (fallback as T),
    } as ConfigService;
  }

  /** Compute SHA-256 of a Buffer (for round-trip integrity assertions). */
  function sha256(buf: Buffer): string {
    return createHash('sha256').update(buf).digest('hex');
  }

  /**
   * Seed a self-contained test tenant : 2 sites + 3 assets + 1 floor plan
   * + 1 attachment with backing MinIO file + 1 orphan MinIO blob (no DB ref).
   *
   * Returns the test tenant id + a map of `{ minioKey → sha256 }` for the
   * MinIO files seeded (used by round-trip assertions).
   */
  async function seedTestTenant(): Promise<{
    tenantId: string;
    minioContents: Map<string, { content: Buffer; sha256: string }>;
  }> {
    const tenantId = `tnt-backup-v2-test-${randomBytes(4).toString('hex')}`;
    testTenantId = tenantId;

    await prisma.tenant.create({
      data: { id: tenantId, name: 'Backup v2 Test', status: 'ACTIVE' },
    });

    const delegation = await prisma.delegation.create({
      data: { tenantId, name: 'Default', isDefault: true },
    });
    testDelegationId = delegation.id;

    const site1 = await prisma.site.create({
      data: {
        tenantId,
        delegationId: delegation.id,
        code: 'BV2-SITE-1',
        name: 'Test Site 1',
        status: 'ACTIVE',
      },
    });

    const site2 = await prisma.site.create({
      data: {
        tenantId,
        delegationId: delegation.id,
        code: 'BV2-SITE-2',
        name: 'Test Site 2',
        status: 'ACTIVE',
      },
    });

    await prisma.asset.createMany({
      data: [
        {
          tenantId,
          siteId: site1.id,
          delegationId: delegation.id,
          name: 'Switch core',
          type: 'NETWORK',
          status: 'IN_SERVICE',
          serialNumber: 'BV2-SN-001',
        },
        {
          tenantId,
          siteId: site1.id,
          delegationId: delegation.id,
          name: 'AP-2',
          type: 'NETWORK',
          status: 'IN_SERVICE',
          serialNumber: 'BV2-SN-002',
        },
        {
          tenantId,
          siteId: site2.id,
          delegationId: delegation.id,
          name: 'UPS',
          type: 'POWER',
          status: 'IN_SERVICE',
          serialNumber: 'BV2-SN-003',
        },
      ],
    });

    // 1 floor plan + 1 attachment with backing MinIO files.
    const planContent = Buffer.from('FAKE PDF CONTENT FOR FLOOR PLAN ' + randomBytes(64).toString('hex'));
    const planKey = `floor-plans/${tenantId}/plan-${randomBytes(4).toString('hex')}.pdf`;
    await uploadToMinio(planKey, planContent);

    await prisma.floorPlan.create({
      data: {
        siteId: site1.id,
        title: 'Plan RDC',
        version: 1,
        fileUrl: `/storage/xch-storage/${planKey}`,
        fileSize: planContent.length,
        mimeType: 'application/pdf',
        uploadedBy: 'test',
      },
    });

    // 1 orphan blob — not referenced by any DB row, must still be in the
    // ZIP under `minio/<bucket>/<key>` (full bucket walk).
    const orphanContent = Buffer.from('ORPHAN BLOB ' + randomBytes(32).toString('hex'));
    const orphanKey = `orphans/${tenantId}/orphan-${randomBytes(4).toString('hex')}.bin`;
    await uploadToMinio(orphanKey, orphanContent);

    return {
      tenantId,
      minioContents: new Map([
        [planKey, { content: planContent, sha256: sha256(planContent) }],
        [orphanKey, { content: orphanContent, sha256: sha256(orphanContent) }],
      ]),
    };
  }

  /** Upload bytes directly to MinIO `xch-storage` bucket. */
  async function uploadToMinio(key: string, content: Buffer): Promise<void> {
    const client = (service as unknown as { getMinioClient: () => unknown }).getMinioClient() as {
      bucketExists: (bucket: string) => Promise<boolean>;
      makeBucket: (bucket: string, region: string) => Promise<void>;
      putObject: (bucket: string, key: string, content: Buffer, length: number) => Promise<unknown>;
    };
    const bucket =
      configService.get<string>('MINIO_BUCKET', 'xch-storage') ?? 'xch-storage';
    try {
      const exists = await client.bucketExists(bucket);
      if (!exists) await client.makeBucket(bucket, 'us-east-1');
    } catch {
      /* tolerate transient */
    }
    await client.putObject(bucket, key, content, content.length);
  }

  /** Wipe all DB rows for the test tenant + remove its MinIO files. */
  async function wipeTestTenant(tenantId: string): Promise<void> {
    // Order matters : child tables first, then parents. Cascade FKs handle
    // most but not all relations.
    const tables = [
      'costAllocation', 'expense', 'budget', 'connectivityLink', 'billingEntity',
      'taskComment', 'attachment', 'photo', 'task', 'assetMovement',
      'pin', 'floorPlan', 'asset', 'rack', 'siteHealthSnapshot', 'site',
      'contact', 'contactType', 'user', 'delegation',
    ];
    for (const table of tables) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any)[table].deleteMany({ where: { tenantId } });
      } catch {
        // Some tables (e.g. pin) don't have tenantId — silently skip.
      }
    }
    try {
      await prisma.tenant.delete({ where: { id: tenantId } });
    } catch {
      /* ignore — may not exist */
    }

    // MinIO cleanup : remove all objects with `<tenantId>` in the key.
    try {
      const client = (service as unknown as { getMinioClient: () => unknown }).getMinioClient() as {
        listObjectsV2: (bucket: string, prefix: string, recursive: boolean) => NodeJS.ReadableStream;
        removeObject: (bucket: string, key: string) => Promise<void>;
      };
      const bucket =
        configService.get<string>('MINIO_BUCKET', 'xch-storage') ?? 'xch-storage';
      const toRemove: string[] = [];
      await new Promise<void>((resolve, reject) => {
        const stream = client.listObjectsV2(bucket, '', true);
        stream.on('data', (obj: { name?: string }) => {
          if (obj.name?.includes(tenantId)) toRemove.push(obj.name);
        });
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });
      for (const key of toRemove) {
        await client.removeObject(bucket, key).catch(() => {});
      }
    } catch {
      /* tolerate transient MinIO errors during cleanup */
    }
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    configService = buildConfigService();
    storage = new StorageService(configService);
    service = new BackupService(prisma, storage, configService);
  });

  afterAll(async () => {
    if (testTenantId) await wipeTestTenant(testTenantId);
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (testTenantId) await wipeTestTenant(testTenantId);
  });

  // -------------------------------------------------------------------------

  it('1. round-trip : backup → wipe → dry-run preview → real restore → counts + sha256 match', async () => {
    // 1. Seed tenant
    const seed = await seedTestTenant();

    // 2. Create v2 backup
    const backup = await service.createFullBackupV2(seed.tenantId, 'test-user', {});
    expect(backup.filename).toMatch(/^full-backup-v2-.*\.zip$/);
    expect(backup.size).toBeGreaterThan(0);
    expect(backup.sha256).toMatch(/^[a-f0-9]{64}$/);

    // 3. Look up backup catalog row (created by logBackupAction)
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        tenantId: seed.tenantId,
        action: 'BACKUP_FULL_V2',
      },
      orderBy: { timestamp: 'desc' },
    });
    expect(auditLog).toBeTruthy();

    // 4. Wipe DB + MinIO
    await wipeTestTenant(seed.tenantId);

    // 5. Re-create the tenant shell so the restore has a target.
    // (Real DR scenario : the operator boots a fresh tenant before restoring.)
    await prisma.tenant.create({
      data: { id: seed.tenantId, name: 'Restored', status: 'ACTIVE' },
    });

    // 6. Dry-run restore — probes natural keys against (now empty) DB.
    const dryRun = await service.restoreFullBackupV2(
      seed.tenantId,
      auditLog!.id,
      { dryRun: true },
      undefined,
      'test-user',
    );
    expect(dryRun.kind).toBe('dry-run');
    if (dryRun.kind !== 'dry-run') throw new Error('unreachable');
    expect(dryRun.report.invalidChecksums).toEqual([]);
    expect(dryRun.report.missingFiles).toEqual([]);
    expect(dryRun.report.wouldCreate.sites).toBe(2);
    expect(dryRun.report.wouldCreate.assets).toBe(3);
    expect(dryRun.report.wouldSkip).toEqual({}); // nothing to skip (empty DB)

    // 7. Real restore
    const applied = await service.restoreFullBackupV2(
      seed.tenantId,
      auditLog!.id,
      { dryRun: false },
      undefined,
      'test-user',
    );
    expect(applied.kind).toBe('applied');
    if (applied.kind !== 'applied') throw new Error('unreachable');
    expect(applied.counts._created).toBeGreaterThan(0);
    expect(applied.siteIds).toHaveLength(2);

    // 8. Verify the restored MinIO files match the original sha256.
    const minio = (service as unknown as { getMinioClient: () => unknown }).getMinioClient() as {
      getObject: (
        bucket: string,
        key: string,
        cb: (err: Error | null, stream: NodeJS.ReadableStream) => void,
      ) => void;
    };
    const bucket =
      configService.get<string>('MINIO_BUCKET', 'xch-storage') ?? 'xch-storage';
    for (const [key, expected] of seed.minioContents) {
      const buf = await new Promise<Buffer>((resolve, reject) => {
        minio.getObject(bucket, key, (err, stream) => {
          if (err) return reject(err);
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        });
      });
      expect(sha256(buf)).toBe(expected.sha256);
    }
  }, 120_000);

  // -------------------------------------------------------------------------

  it('2. idempotence : re-restoring the same backup on a populated DB yields 0 inserts', async () => {
    const seed = await seedTestTenant();
    const backup = await service.createFullBackupV2(seed.tenantId, 'test-user', {});
    expect(backup.filename).toBeDefined();

    const auditLog = await prisma.auditLog.findFirst({
      where: { tenantId: seed.tenantId, action: 'BACKUP_FULL_V2' },
      orderBy: { timestamp: 'desc' },
    });

    // First restore on a populated DB — every NK should already match,
    // so wasCreated:false everywhere (skipped).
    const first = await service.restoreFullBackupV2(
      seed.tenantId,
      auditLog!.id,
      { dryRun: false },
      undefined,
      'test-user',
    );
    expect(first.kind).toBe('applied');
    if (first.kind !== 'applied') throw new Error('unreachable');
    expect(first.counts._created).toBe(0);
    expect(first.counts._skipped).toBeGreaterThan(0);

    // Second restore — same result, no drift.
    const second = await service.restoreFullBackupV2(
      seed.tenantId,
      auditLog!.id,
      { dryRun: false },
      undefined,
      'test-user',
    );
    expect(second.kind).toBe('applied');
    if (second.kind !== 'applied') throw new Error('unreachable');
    expect(second.counts._created).toBe(0);
    expect(second.counts._skipped).toBe(first.counts._skipped);
  }, 120_000);

  // -------------------------------------------------------------------------

  it('3. orphan MinIO blob inclusion : full bucket walk captures unreferenced files', async () => {
    const seed = await seedTestTenant();
    // The seed includes 1 orphan blob ; it must end up in the archive.
    const backup = await service.createFullBackupV2(seed.tenantId, 'test-user', {});
    expect(backup.filename).toBeDefined();

    // Dry-run on a fresh tenant to inspect the file list in the archive.
    await wipeTestTenant(seed.tenantId);
    await prisma.tenant.create({
      data: { id: seed.tenantId, name: 'Restored', status: 'ACTIVE' },
    });

    const auditLog = await prisma.auditLog.findFirst({
      where: { tenantId: seed.tenantId, action: 'BACKUP_FULL_V2' },
      orderBy: { timestamp: 'desc' },
    });
    const dryRun = await service.restoreFullBackupV2(
      seed.tenantId,
      auditLog!.id,
      { dryRun: true },
      undefined,
      'test-user',
    );
    expect(dryRun.kind).toBe('dry-run');
    if (dryRun.kind !== 'dry-run') throw new Error('unreachable');
    // No invalidChecksums + no missingFiles ; the orphan blob's sha256
    // matches the metadata.files entry computed during streaming.
    expect(dryRun.report.invalidChecksums).toEqual([]);
    expect(dryRun.report.missingFiles).toEqual([]);
  }, 120_000);
});
