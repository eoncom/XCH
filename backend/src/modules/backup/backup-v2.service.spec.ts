import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as archiver from 'archiver';
import { BadRequestException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');

import {
  BackupService,
  HashingStream,
  MagicByteValidator,
  BackupMetadataV2,
  BackupFileEntryV2,
  RestoreFullV2Result,
} from './backup.service';

/**
 * Track D.1 Phase 1 step 2 — unit tests for the streaming export v2
 * primitives + orchestrator.
 *
 * Coverage strategy :
 *  - HashingStream             : pure stream, no service needed
 *  - streamBucketIntoArchive   : mock MinIO client (listObjectsV2 + getObject)
 *  - buildArchiveV2ToTmp       : real fs + real archiver, no MinIO (empty buckets)
 *  - uploadTmpToBackupBucket   : mock MinIO client (bucketExists/makeBucket/fPutObject)
 *
 * Full round-trip with a real MinIO is Phase 1 step 8 integration test.
 */

/** Build a BackupService with stub deps + an injectable mock MinIO client. */
function buildServiceWithMockedMinio(
  mockClient: Record<string, unknown>,
  configValues: Record<string, string> = {},
): BackupService {
  const configService = {
    get: jest.fn((key: string, fallback?: string) => configValues[key] ?? fallback ?? ''),
  };
  const service = new BackupService(
    {} as never,
    {} as never,
    configService as never,
  );
  // Inject the mocked client so getMinioClient() returns it instead of
  // constructing a real one via `require('minio')`.
  (service as unknown as { _minioClient: unknown })._minioClient = mockClient;
  return service;
}

describe('HashingStream (Track D.1 step 2)', () => {
  it('computes sha256 + bytesProcessed for known fixture chunks', async () => {
    // SHA-256("hello world") = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
    const expected = createHash('sha256').update('hello world').digest('hex');

    const hashing = new HashingStream();
    const chunks: Buffer[] = [];
    hashing.on('data', (chunk: Buffer) => chunks.push(chunk));

    Readable.from([Buffer.from('hello'), Buffer.from(' '), Buffer.from('world')]).pipe(hashing);
    await new Promise<void>((resolve, reject) => {
      hashing.on('end', () => resolve());
      hashing.on('error', reject);
    });

    expect(Buffer.concat(chunks).toString('utf8')).toBe('hello world');
    expect(hashing.bytesProcessed).toBe(11);
    expect(hashing.digest()).toBe(expected);
  });

  it('matches sha256 of equivalent single-chunk buffer', async () => {
    const buf = Buffer.alloc(1024, 'X');
    const expected = createHash('sha256').update(buf).digest('hex');

    const hashing = new HashingStream();
    const sinkChunks: Buffer[] = [];
    hashing.on('data', (chunk: Buffer) => sinkChunks.push(chunk));

    Readable.from([buf]).pipe(hashing);
    await new Promise<void>((resolve) => hashing.on('end', resolve));

    expect(hashing.bytesProcessed).toBe(1024);
    expect(hashing.digest()).toBe(expected);
    expect(Buffer.concat(sinkChunks).equals(buf)).toBe(true);
  });

  it('forwards chunks unchanged (pass-through)', async () => {
    const hashing = new HashingStream();
    const sourceChunks = [Buffer.from('a'), Buffer.from('bb'), Buffer.from('ccc')];
    const sinkChunks: Buffer[] = [];
    hashing.on('data', (chunk: Buffer) => sinkChunks.push(chunk));

    Readable.from(sourceChunks).pipe(hashing);
    await new Promise<void>((resolve) => hashing.on('end', resolve));

    expect(Buffer.concat(sinkChunks).toString()).toBe('abbccc');
    expect(hashing.bytesProcessed).toBe(6);
  });
});

describe('BackupService.streamBucketIntoArchive (Track D.1 step 2)', () => {
  it('populates fileMap with sha256 + size for each MinIO object', async () => {
    const a = Buffer.from('content of object A');
    const b = Buffer.from('content of object B — bigger payload here');
    const aSha = createHash('sha256').update(a).digest('hex');
    const bSha = createHash('sha256').update(b).digest('hex');

    const mockClient = {
      listObjectsV2: jest.fn(() => {
        const stream = new Readable({ read() {} });
        process.nextTick(() => {
          stream.emit('data', { name: 'a.txt', size: a.length });
          stream.emit('data', { name: 'b.txt', size: b.length });
          stream.emit('end');
        });
        return stream;
      }),
      getObject: jest.fn(
        (
          _bucket: string,
          name: string,
          cb: (err: Error | null, s: Readable) => void,
        ) => {
          const content = name === 'a.txt' ? a : b;
          cb(null, Readable.from([content]));
        },
      ),
    };

    const service = buildServiceWithMockedMinio(mockClient);

    // Use a real archiver instance piped to a tmp file, so streaming actually
    // drains hashing → the 'end' event fires as expected.
    const tmpOut = path.join(os.tmpdir(), `test-stream-${Date.now()}.zip`);
    const archive = archiver('zip');
    const writeStream = createWriteStream(tmpOut);
    archive.pipe(writeStream);

    try {
      const fileMap: Record<string, BackupFileEntryV2> = {};
      // Call the private method via cast.
      await (
        service as unknown as {
          streamBucketIntoArchive: (
            archive: archiver.Archiver,
            bucket: string,
            fileMap: Record<string, BackupFileEntryV2>,
          ) => Promise<void>;
        }
      ).streamBucketIntoArchive(archive, 'src', fileMap);

      await archive.finalize();
      await new Promise<void>((resolve) => writeStream.on('close', resolve));

      // Assertions on fileMap (the primitive's deliverable)
      expect(Object.keys(fileMap).sort()).toEqual([
        'minio/src/a.txt',
        'minio/src/b.txt',
      ]);
      expect(fileMap['minio/src/a.txt']).toEqual({
        size: a.length,
        sha256: aSha,
        bucket: 'src',
        key: 'a.txt',
      });
      expect(fileMap['minio/src/b.txt']).toEqual({
        size: b.length,
        sha256: bSha,
        bucket: 'src',
        key: 'b.txt',
      });

      // Sanity : the entries actually made it into the ZIP
      const zip = new AdmZip(tmpOut);
      const entries = zip.getEntries().map((e: { entryName: string }) => e.entryName);
      expect(entries).toContain('minio/src/a.txt');
      expect(entries).toContain('minio/src/b.txt');
      // Content roundtrip
      expect(zip.getEntry('minio/src/a.txt').getData().toString('utf8')).toBe(a.toString('utf8'));
    } finally {
      await fs.rm(tmpOut, { force: true });
    }
  });

  it('is a no-op when the bucket is empty (fileMap untouched)', async () => {
    const mockClient = {
      listObjectsV2: jest.fn(() => {
        const stream = new Readable({ read() {} });
        process.nextTick(() => stream.emit('end'));
        return stream;
      }),
      getObject: jest.fn(),
    };

    const service = buildServiceWithMockedMinio(mockClient);
    const tmpOut = path.join(os.tmpdir(), `test-stream-empty-${Date.now()}.zip`);
    const archive = archiver('zip');
    const writeStream = createWriteStream(tmpOut);
    archive.pipe(writeStream);

    try {
      const fileMap: Record<string, BackupFileEntryV2> = {};
      await (service as never as {
        streamBucketIntoArchive: (
          archive: archiver.Archiver,
          bucket: string,
          fileMap: Record<string, BackupFileEntryV2>,
        ) => Promise<void>;
      }).streamBucketIntoArchive(archive, 'empty-bucket', fileMap);

      archive.append('placeholder', { name: 'placeholder.txt' });
      await archive.finalize();
      await new Promise<void>((resolve) => writeStream.on('close', resolve));

      expect(fileMap).toEqual({});
      expect(mockClient.getObject).not.toHaveBeenCalled();
    } finally {
      await fs.rm(tmpOut, { force: true });
    }
  });
});

describe('BackupService.buildArchiveV2ToTmp (Track D.1 step 2)', () => {
  it('builds a valid ZIP at tmpPath with data + metadata, return matches stat', async () => {
    const service = buildServiceWithMockedMinio({}, { APP_VERSION: '2.2.0' });
    const tmpPath = path.join(os.tmpdir(), `test-build-${Date.now()}-${Math.random()}.zip`);

    const data: Record<string, unknown[]> = {
      sites: [{ id: 's1', name: 'Site A', tenantId: 'tnt-test' }],
      assets: [
        { id: 'a1', name: 'Switch core', siteId: 's1' },
        { id: 'a2', name: 'AP', siteId: 's1' },
      ],
    };
    const metadata: BackupMetadataV2 = {
      version: 2,
      createdAt: '2026-05-13T10:00:00.000Z',
      tenantId: 'tnt-test',
      type: 'db-only',
      siteId: null,
      siteCode: null,
      appVersion: '2.2.0',
      buckets: [],
      counts: { sites: 1, assets: 2 },
      files: {},
    };

    try {
      const result = await (service as never as {
        buildArchiveV2ToTmp: (args: {
          tmpPath: string;
          data: Record<string, unknown[]>;
          buckets: string[];
          metadata: BackupMetadataV2;
        }) => Promise<{ size: number; sha256: string }>;
      }).buildArchiveV2ToTmp({
        tmpPath,
        data,
        buckets: [],
        metadata,
      });

      // Shape of returned object
      expect(result.size).toBeGreaterThan(0);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);

      // File exists at tmpPath with correct size
      const stat = await fs.stat(tmpPath);
      expect(stat.size).toBe(result.size);

      // ZIP structure : data/*.json + metadata.json (no minio/* — buckets empty)
      const zip = new AdmZip(tmpPath);
      const entries = zip.getEntries().map((e: { entryName: string }) => e.entryName).sort();
      expect(entries).toEqual([
        'data/assets.json',
        'data/sites.json',
        'metadata.json',
      ]);

      // metadata.json round-trips
      const parsed = JSON.parse(zip.getEntry('metadata.json').getData().toString('utf8'));
      expect(parsed.version).toBe(2);
      expect(typeof parsed.version).toBe('number'); // discriminant vs v1 string '1.0'
      expect(parsed.tenantId).toBe('tnt-test');
      expect(parsed.counts).toEqual({ sites: 1, assets: 2 });
      expect(parsed.files).toEqual({});

      // data/sites.json round-trips
      const parsedSites = JSON.parse(zip.getEntry('data/sites.json').getData().toString('utf8'));
      expect(parsedSites).toEqual(data.sites);
    } finally {
      await fs.rm(tmpPath, { force: true });
    }
  });

  it('archive sha256 is deterministic for identical input (sanity over hasher tee)', async () => {
    const service = buildServiceWithMockedMinio({});
    const tmpPath1 = path.join(os.tmpdir(), `test-determ-1-${Date.now()}.zip`);
    const tmpPath2 = path.join(os.tmpdir(), `test-determ-2-${Date.now()}.zip`);

    const args = {
      data: { foo: [{ id: 1 }] },
      buckets: [],
      metadata: {
        version: 2 as const,
        createdAt: '2026-05-13T10:00:00.000Z',
        tenantId: 'tnt-test',
        type: 'db-only' as const,
        siteId: null,
        siteCode: null,
        appVersion: '2.2.0',
        buckets: [],
        counts: { foo: 1 },
        files: {},
      },
    };

    try {
      const r1 = await (service as never as {
        buildArchiveV2ToTmp: (a: typeof args & { tmpPath: string }) => Promise<{
          size: number;
          sha256: string;
        }>;
      }).buildArchiveV2ToTmp({ tmpPath: tmpPath1, ...args });
      const r2 = await (service as never as {
        buildArchiveV2ToTmp: (a: typeof args & { tmpPath: string }) => Promise<{
          size: number;
          sha256: string;
        }>;
      }).buildArchiveV2ToTmp({ tmpPath: tmpPath2, ...args });

      // Same payload + same metadata → same archive bytes → same sha256.
      // (archiver is deterministic when given identical inputs without
      // timestamps inside the entries — we don't set the entry mtime.)
      expect(r1.sha256).toBe(r2.sha256);
      expect(r1.size).toBe(r2.size);
    } finally {
      await fs.rm(tmpPath1, { force: true });
      await fs.rm(tmpPath2, { force: true });
    }
  });
});

describe('BackupService.uploadTmpToBackupBucket (Track D.1 step 2)', () => {
  it('calls fPutObject with the tmp PATH (streaming), not a Buffer', async () => {
    const tmpPath = path.join(os.tmpdir(), `test-upload-${Date.now()}.zip`);
    await fs.writeFile(tmpPath, Buffer.from('fake zip content'));

    const mockClient = {
      bucketExists: jest.fn().mockResolvedValue(true),
      makeBucket: jest.fn(),
      fPutObject: jest.fn().mockResolvedValue(undefined),
    };

    const service = buildServiceWithMockedMinio(mockClient);

    try {
      await (service as never as {
        uploadTmpToBackupBucket: (tmpPath: string, filename: string) => Promise<void>;
      }).uploadTmpToBackupBucket(tmpPath, 'test-output.zip');

      expect(mockClient.bucketExists).toHaveBeenCalledWith('xch-backups');
      expect(mockClient.makeBucket).not.toHaveBeenCalled();
      expect(mockClient.fPutObject).toHaveBeenCalledTimes(1);

      // The 3rd argument MUST be the tmp file path (string), NOT a Buffer.
      // This is the proof of streaming upload (vs v1 putObject(buffer, length)).
      const [bucket, name, payload, headers] = mockClient.fPutObject.mock.calls[0];
      expect(bucket).toBe('xch-backups');
      expect(name).toBe('test-output.zip');
      expect(typeof payload).toBe('string');
      expect(payload).toBe(tmpPath);
      expect(Buffer.isBuffer(payload)).toBe(false);
      expect(headers).toEqual({ 'Content-Type': 'application/zip' });
    } finally {
      await fs.rm(tmpPath, { force: true });
    }
  });

  it('creates the backup bucket on the fly if missing (idempotent)', async () => {
    const tmpPath = path.join(os.tmpdir(), `test-upload-makebucket-${Date.now()}.zip`);
    await fs.writeFile(tmpPath, Buffer.from('fake zip content'));

    const mockClient = {
      bucketExists: jest.fn().mockResolvedValue(false),
      makeBucket: jest.fn().mockResolvedValue(undefined),
      fPutObject: jest.fn().mockResolvedValue(undefined),
    };

    const service = buildServiceWithMockedMinio(mockClient);

    try {
      await (service as never as {
        uploadTmpToBackupBucket: (tmpPath: string, filename: string) => Promise<void>;
      }).uploadTmpToBackupBucket(tmpPath, 'first.zip');

      expect(mockClient.bucketExists).toHaveBeenCalledWith('xch-backups');
      expect(mockClient.makeBucket).toHaveBeenCalledWith('xch-backups', 'us-east-1');
      expect(mockClient.fPutObject).toHaveBeenCalled();
    } finally {
      await fs.rm(tmpPath, { force: true });
    }
  });

  it('tolerates bucketExists throwing (warns, then proceeds with fPutObject)', async () => {
    const tmpPath = path.join(os.tmpdir(), `test-upload-toler-${Date.now()}.zip`);
    await fs.writeFile(tmpPath, Buffer.from('payload'));

    const mockClient = {
      bucketExists: jest.fn().mockRejectedValue(new Error('S3 transient')),
      makeBucket: jest.fn(),
      fPutObject: jest.fn().mockResolvedValue(undefined),
    };

    const service = buildServiceWithMockedMinio(mockClient);

    try {
      await (service as never as {
        uploadTmpToBackupBucket: (tmpPath: string, filename: string) => Promise<void>;
      }).uploadTmpToBackupBucket(tmpPath, 'tolerant.zip');

      // Did NOT throw + did attempt the upload despite the bucketExists error.
      expect(mockClient.fPutObject).toHaveBeenCalled();
    } finally {
      await fs.rm(tmpPath, { force: true });
    }
  });
});

// ============================================================================
// Track D.1 Phase 1 step 3 — streaming restore v2 + MagicByteValidator
// ============================================================================

describe('MagicByteValidator (Track D.1 step 3)', () => {
  /** Helper: drain validator + collect output, resolve/reject on end/error. */
  async function feedAndCollect(
    validator: MagicByteValidator,
    chunks: Buffer[],
  ): Promise<{ output: Buffer; error: Error | null }> {
    const sink: Buffer[] = [];
    let error: Error | null = null;
    validator.on('data', (chunk: Buffer) => sink.push(chunk));
    validator.on('error', (err: Error) => {
      error = err;
    });

    Readable.from(chunks).pipe(validator);
    await new Promise<void>((resolve) => {
      validator.on('end', resolve);
      validator.on('error', () => resolve());
    });
    return { output: Buffer.concat(sink), error };
  }

  it('passes ZIP magic bytes through unchanged (single chunk)', async () => {
    const validator = new MagicByteValidator();
    const payload = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rest of the zip file…'),
    ]);
    const { output, error } = await feedAndCollect(validator, [payload]);
    expect(error).toBeNull();
    expect(output.equals(payload)).toBe(true);
  });

  it('rejects non-ZIP bytes with BadRequestException', async () => {
    const validator = new MagicByteValidator();
    const txt = Buffer.from('Hello world — definitely not a zip archive');
    const { error } = await feedAndCollect(validator, [txt]);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toMatch(/ZIP magic bytes/i);
  });

  it('handles partial first chunk (<4 bytes) by buffering until 4 bytes', async () => {
    const validator = new MagicByteValidator();
    // 1 byte chunk then 3 bytes chunk — must reassemble before validating.
    const { output, error } = await feedAndCollect(validator, [
      Buffer.from([0x50]),
      Buffer.from([0x4b, 0x03, 0x04]),
      Buffer.from('payload'),
    ]);
    expect(error).toBeNull();
    expect(output.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    expect(output.subarray(4).toString()).toBe('payload');
  });

  it('rejects truncated stream (< 4 bytes total)', async () => {
    const validator = new MagicByteValidator();
    const { error } = await feedAndCollect(validator, [Buffer.from([0x50, 0x4b])]);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toMatch(/stream ended before/i);
  });
});

describe('BackupService.restoreFullBackupV2 (Track D.1 step 3)', () => {
  /**
   * Build a real v2 backup ZIP at `tmpPath` using buildArchiveV2ToTmp
   * (production code path). Returns the populated metadata.
   */
  async function buildV2BackupFixture(
    service: BackupService,
    tmpPath: string,
    args: {
      tenantId?: string;
      data?: Record<string, unknown[]>;
      buckets?: string[];
      metadataOverrides?: Partial<BackupMetadataV2>;
    } = {},
  ): Promise<BackupMetadataV2> {
    const tenantId = args.tenantId ?? 'tnt-test';
    const data = args.data ?? { sites: [{ id: 's1', name: 'Site A' }] };
    const buckets = args.buckets ?? [];
    const metadata: BackupMetadataV2 = {
      version: 2,
      createdAt: '2026-05-13T10:00:00.000Z',
      tenantId,
      type: 'db-only',
      siteId: null,
      siteCode: null,
      appVersion: '2.2.0',
      buckets,
      counts: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v.length]),
      ),
      files: {},
      ...args.metadataOverrides,
    };

    await (service as never as {
      buildArchiveV2ToTmp: (a: {
        tmpPath: string;
        data: Record<string, unknown[]>;
        buckets: string[];
        metadata: BackupMetadataV2;
      }) => Promise<{ size: number; sha256: string }>;
    }).buildArchiveV2ToTmp({ tmpPath, data, buckets, metadata });
    return metadata;
  }

  /**
   * Build a hand-crafted ZIP for the edge-case tests (raw archiver, bypass
   * the v2 builder so we can produce malformed / v1-shaped / version-3
   * archives that the production builder would refuse).
   */
  async function buildRawArchive(
    tmpPath: string,
    entries: Array<{ name: string; content: string | Buffer }>,
  ): Promise<void> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const writeStream = createWriteStream(tmpPath);
    const pipelinePromise = pipeline(archive, writeStream);
    for (const entry of entries) {
      archive.append(entry.content, { name: entry.name });
    }
    await archive.finalize();
    await pipelinePromise;
  }

  /**
   * Wire a BackupService with mocked deps : auditLog row resolves to the
   * fixture filename ; fGetObject copies the fixture to the requested
   * tmpPath (simulates streaming download).
   */
  function wireService(zipFixturePath: string): {
    service: BackupService;
    mockClient: Record<string, jest.Mock>;
    prismaStub: { auditLog: { findUnique: jest.Mock } };
  } {
    const filename = path.basename(zipFixturePath);
    const auditLog = { id: 'audit-1', changes: { filename } };
    const prismaStub = {
      auditLog: { findUnique: jest.fn().mockResolvedValue(auditLog), create: jest.fn() },
    };
    const mockClient = {
      fGetObject: jest.fn(async (_bucket: string, _name: string, target: string) => {
        await fs.copyFile(zipFixturePath, target);
      }),
    };
    const service = new BackupService(
      prismaStub as never,
      {} as never,
      {
        get: jest.fn((k: string, fb?: string) =>
          k === 'MINIO_BUCKET' ? 'xch-storage' : fb ?? '',
        ),
      } as never,
    );
    (service as unknown as { _minioClient: unknown })._minioClient = mockClient;
    return { service, mockClient, prismaStub };
  }

  // -- 10 tests per user's spec --------------------------------------------

  it('1. magic byte valide ZIP → pass-through (round-trip basique)', async () => {
    // Round-trip step 2 → step 3 dryRun. Counts identiques entre backup et report.
    const tmpDir = os.tmpdir();
    const tmpZip = path.join(tmpDir, `v2-rt-${randomBytes(4).toString('hex')}.zip`);
    const stubService = new BackupService(
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
    );
    const data = {
      sites: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }],
      assets: [{ id: 'a1', siteId: 's1', name: 'Switch' }],
    };
    const metadata = await buildV2BackupFixture(stubService, tmpZip, { data });

    try {
      const { service } = wireService(tmpZip);
      const result = await service.restoreFullBackupV2('tnt-test', 'audit-1', { dryRun: true });

      expect(result.kind).toBe('dry-run');
      if (result.kind !== 'dry-run') throw new Error('unreachable');

      // Counts from the dry-run report match the metadata.counts written at step 2.
      expect(result.report.wouldCreate).toEqual(metadata.counts);
      expect(result.report.invalidChecksums).toEqual([]);
      expect(result.report.missingFiles).toEqual([]);
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });

  it('2. magic byte invalide (.txt) → BadRequestException', async () => {
    const tmpZip = path.join(os.tmpdir(), `not-a-zip-${randomBytes(4).toString('hex')}.txt`);
    await fs.writeFile(tmpZip, Buffer.from('not a zip at all just text content'));
    try {
      const { service } = wireService(tmpZip);
      await expect(
        service.restoreFullBackupV2('tnt-test', 'audit-1', { dryRun: true }),
      ).rejects.toThrow(BadRequestException);
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });

  it('3. metadata.json absent → BadRequestException', async () => {
    const tmpZip = path.join(os.tmpdir(), `no-meta-${randomBytes(4).toString('hex')}.zip`);
    await buildRawArchive(tmpZip, [
      { name: 'data/sites.json', content: '[]' },
      // NO metadata.json
    ]);
    try {
      const { service } = wireService(tmpZip);
      await expect(
        service.restoreFullBackupV2('tnt-test', 'audit-1', { dryRun: true }),
      ).rejects.toThrow(/metadata\.json missing or corrupted/i);
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });

  it('4. metadata.json JSON.parse fail → BadRequestException', async () => {
    const tmpZip = path.join(os.tmpdir(), `bad-meta-${randomBytes(4).toString('hex')}.zip`);
    await buildRawArchive(tmpZip, [
      { name: 'data/sites.json', content: '[]' },
      { name: 'metadata.json', content: '{ not valid json :' },
    ]);
    try {
      const { service } = wireService(tmpZip);
      await expect(
        service.restoreFullBackupV2('tnt-test', 'audit-1', { dryRun: true }),
      ).rejects.toThrow(/JSON parse failed/i);
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });

  it('5. version string "1.0" → délégation legacy restoreFullBackup', async () => {
    // V1-version archive with TOP-LEVEL metadata (anomaly variant): typeof
    // metadata.version === 'string' triggers delegation regardless of
    // prefix layout.
    const tmpZip = path.join(os.tmpdir(), `v1-vers-${randomBytes(4).toString('hex')}.zip`);
    await buildRawArchive(tmpZip, [
      { name: 'data/sites.json', content: '[]' },
      {
        name: 'metadata.json',
        content: JSON.stringify({ version: '1.0', type: 'full', tenantId: 'tnt-test' }),
      },
    ]);
    try {
      const { service } = wireService(tmpZip);
      const restoreFullBackupSpy = jest
        .spyOn(service, 'restoreFullBackup')
        .mockResolvedValue({
          message: 'v1 restored',
          counts: { sites: 3, assets: 12 },
          siteIds: ['s1', 's2', 's3'],
        });

      const result = await service.restoreFullBackupV2('tnt-test', 'audit-1');
      expect(restoreFullBackupSpy).toHaveBeenCalledTimes(1);
      expect(result.kind).toBe('delegated-v1');
      if (result.kind !== 'delegated-v1') throw new Error('unreachable');
      expect(result.counts).toEqual({ sites: 3, assets: 12 });
      expect(result.siteIds).toEqual(['s1', 's2', 's3']);
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });

  it('5b. v1 archive by PREFIX (full-backup-<ts>/) → délégation legacy', async () => {
    const tmpZip = path.join(os.tmpdir(), `v1-pref-${randomBytes(4).toString('hex')}.zip`);
    await buildRawArchive(tmpZip, [
      {
        name: 'full-backup-2026-05-09-22-00-00/metadata.json',
        content: JSON.stringify({ version: '1.0', type: 'full' }),
      },
      {
        name: 'full-backup-2026-05-09-22-00-00/data/sites.json',
        content: '[]',
      },
    ]);
    try {
      const { service } = wireService(tmpZip);
      const restoreFullBackupSpy = jest
        .spyOn(service, 'restoreFullBackup')
        .mockResolvedValue({
          message: 'v1 restored',
          counts: { sites: 0 },
          siteIds: [],
        });

      const result = await service.restoreFullBackupV2('tnt-test', 'audit-1');
      expect(restoreFullBackupSpy).toHaveBeenCalled();
      expect(result.kind).toBe('delegated-v1');
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });

  it('6. version number 2 → streaming path (dryRun returns report)', async () => {
    // Already exercised by test 1 (round-trip). Reassert version=2 path explicitly.
    const tmpZip = path.join(os.tmpdir(), `v2-path-${randomBytes(4).toString('hex')}.zip`);
    const stub = new BackupService({} as never, {} as never, { get: jest.fn() } as never);
    await buildV2BackupFixture(stub, tmpZip, { data: { sites: [] } });
    try {
      const { service } = wireService(tmpZip);
      const result = await service.restoreFullBackupV2('tnt-test', 'audit-1', { dryRun: true });
      expect(result.kind).toBe('dry-run');
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });

  it('7. version number 3 → BadRequestException Unsupported', async () => {
    const tmpZip = path.join(os.tmpdir(), `v3-${randomBytes(4).toString('hex')}.zip`);
    await buildRawArchive(tmpZip, [
      { name: 'data/sites.json', content: '[]' },
      {
        name: 'metadata.json',
        content: JSON.stringify({
          version: 3,
          createdAt: '2026-05-13T10:00:00Z',
          tenantId: 'tnt-test',
          type: 'full',
          siteId: null,
          siteCode: null,
          appVersion: '3.0.0',
          buckets: [],
          counts: {},
          files: {},
        }),
      },
    ]);
    try {
      const { service } = wireService(tmpZip);
      await expect(
        service.restoreFullBackupV2('tnt-test', 'audit-1', { dryRun: true }),
      ).rejects.toThrow(/Unsupported backup version: 3/i);
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });

  it('8. sha256 mismatch on 1 file → reject entry + dryRunReport populates invalidChecksums', async () => {
    // Hand-craft a ZIP with one minio entry whose content does NOT match the
    // sha256 declared in metadata.files. The dry-run path captures the
    // mismatch without throwing.
    const tmpZip = path.join(os.tmpdir(), `mismatch-${randomBytes(4).toString('hex')}.zip`);
    const wrongSha = 'a'.repeat(64);
    await buildRawArchive(tmpZip, [
      { name: 'minio/test-bucket/file.txt', content: 'actual content here' },
      {
        name: 'metadata.json',
        content: JSON.stringify({
          version: 2,
          createdAt: '2026-05-13T10:00:00Z',
          tenantId: 'tnt-test',
          type: 'full',
          siteId: null,
          siteCode: null,
          appVersion: '2.2.0',
          buckets: ['test-bucket'],
          counts: {},
          files: {
            'minio/test-bucket/file.txt': {
              size: 999,
              sha256: wrongSha,
              bucket: 'test-bucket',
              key: 'file.txt',
            },
          },
        }),
      },
    ]);
    try {
      const { service } = wireService(tmpZip);
      const result = await service.restoreFullBackupV2('tnt-test', 'audit-1', { dryRun: true });
      expect(result.kind).toBe('dry-run');
      if (result.kind !== 'dry-run') throw new Error('unreachable');
      expect(result.report.invalidChecksums).toEqual(['minio/test-bucket/file.txt']);
      expect(result.report.missingFiles).toEqual([]);
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });

  it('9. sha256 mismatch + NOT dry-run → BadRequestException integrity check failed', async () => {
    const tmpZip = path.join(os.tmpdir(), `mismatch-fail-${randomBytes(4).toString('hex')}.zip`);
    await buildRawArchive(tmpZip, [
      { name: 'minio/test-bucket/file.txt', content: 'actual' },
      {
        name: 'metadata.json',
        content: JSON.stringify({
          version: 2,
          createdAt: '2026-05-13T10:00:00Z',
          tenantId: 'tnt-test',
          type: 'full',
          siteId: null,
          siteCode: null,
          appVersion: '2.2.0',
          buckets: ['test-bucket'],
          counts: {},
          files: {
            'minio/test-bucket/file.txt': {
              size: 6,
              sha256: 'b'.repeat(64),
              bucket: 'test-bucket',
              key: 'file.txt',
            },
          },
        }),
      },
    ]);
    try {
      const { service } = wireService(tmpZip);
      await expect(
        service.restoreFullBackupV2('tnt-test', 'audit-1', { dryRun: false }),
      ).rejects.toThrow(/integrity check failed/i);
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });

  it('10. real-run intact ZIP → reaches applyDataFilesToDb (step 4 lands DB writes)', async () => {
    // Track D.1 step 4 : the stub from step 3 is now replaced by the full
    // idempotent implementation. A non-dry-run reaches applyDataFilesToDb,
    // which calls `prisma.$transaction(...)`. With a plain `{}` prisma stub,
    // that throws "$transaction is not a function" — proof that the
    // orchestrator wires through to the real DB write path (vs the step 3
    // hard-coded BadRequestException). End-to-end DB integration test
    // lives in step 8 with a real Postgres.
    const tmpZip = path.join(os.tmpdir(), `step4-wire-${randomBytes(4).toString('hex')}.zip`);
    const stub = new BackupService({} as never, {} as never, { get: jest.fn() } as never);
    await buildV2BackupFixture(stub, tmpZip, { data: { sites: [{ id: 's1' }] } });
    try {
      const { service } = wireService(tmpZip);
      await expect(
        service.restoreFullBackupV2('tnt-test', 'audit-1', { dryRun: false }),
      ).rejects.toThrow(/\$transaction is not a function/);
    } finally {
      await fs.rm(tmpZip, { force: true });
    }
  });
});

// ============================================================================
// Track D.1 Phase 1 step 4 — upsertByNaturalKey + idempotent restore
// ============================================================================

describe('BackupService.upsertByNaturalKey (Track D.1 step 4)', () => {
  function buildService(): BackupService {
    return new BackupService(
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
    );
  }

  it('returns wasCreated:true when no row matches (create called)', async () => {
    const service = buildService();
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({ id: 'new-1', code: 'SITE-A' });
    const tx = { site: { findFirst, create } };

    const result = await (
      service as never as {
        upsertByNaturalKey: (
          tx: unknown,
          model: string,
          where: object,
          data: object,
        ) => Promise<{ row: { id: string }; wasCreated: boolean }>;
      }
    ).upsertByNaturalKey(
      tx,
      'site',
      { tenantId: 'tnt-1', code: 'SITE-A' },
      { tenantId: 'tnt-1', code: 'SITE-A', name: 'Site A' },
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tnt-1', code: 'SITE-A' },
    });
    expect(create).toHaveBeenCalledWith({
      data: { tenantId: 'tnt-1', code: 'SITE-A', name: 'Site A' },
    });
    expect(result.row.id).toBe('new-1');
    expect(result.wasCreated).toBe(true);
  });

  it('returns wasCreated:false when row exists (create NOT called — skip-if-exists)', async () => {
    const service = buildService();
    const existing = { id: 'existing-1', code: 'SITE-A' };
    const findFirst = jest.fn().mockResolvedValue(existing);
    const create = jest.fn();
    const tx = { site: { findFirst, create } };

    const result = await (
      service as never as {
        upsertByNaturalKey: (
          tx: unknown,
          model: string,
          where: object,
          data: object,
        ) => Promise<{ row: { id: string }; wasCreated: boolean }>;
      }
    ).upsertByNaturalKey(
      tx,
      'site',
      { tenantId: 'tnt-1', code: 'SITE-A' },
      { tenantId: 'tnt-1', code: 'SITE-A', name: 'Site A' },
    );

    expect(findFirst).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(result.row.id).toBe('existing-1');
    expect(result.wasCreated).toBe(false);
  });

  it('throws when modelName does not exist on tx', async () => {
    const service = buildService();
    const tx = { site: { findFirst: jest.fn() } };

    await expect(
      (
        service as never as {
          upsertByNaturalKey: (
            tx: unknown,
            model: string,
            where: object,
            data: object,
          ) => Promise<unknown>;
        }
      ).upsertByNaturalKey(tx, 'nonExistentModel', {}, {}),
    ).rejects.toThrow(/unknown Prisma model 'nonExistentModel'/);
  });
});

describe('BackupService.applyDataFilesToDb idempotence (Track D.1 step 4)', () => {
  /**
   * Build an in-memory Prisma stub that tracks created rows per model and
   * simulates findFirst/create idempotently.
   */
  function buildInMemoryPrismaStub(): {
    prisma: Record<string, unknown>;
    getAllCounts: () => Record<string, number>;
  } {
    const stores: Record<string, Array<Record<string, unknown>>> = {};
    let nextId = 0;

    const makeModel = (modelName: string): Record<string, unknown> => ({
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const store = stores[modelName] ?? [];
        const hit = store.find((row) =>
          Object.entries(where).every(([k, v]) => {
            const rowV = row[k];
            if (v instanceof Date && rowV instanceof Date) {
              return v.getTime() === rowV.getTime();
            }
            if (v && typeof v === 'object' && 'startsWith' in v) {
              return typeof rowV === 'string' &&
                rowV.startsWith((v as { startsWith: string }).startsWith);
            }
            return rowV === v;
          }),
        );
        return Promise.resolve(hit ?? null);
      }),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const id = data.id ?? `${modelName}-${++nextId}`;
        const row = { ...data, id };
        stores[modelName] ??= [];
        stores[modelName].push(row);
        return Promise.resolve(row);
      }),
      findUnique: jest.fn(() => Promise.resolve(null)),
      upsert: jest.fn(({ where, create, update }: { where: { siteId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const store = stores['siteHealthSnapshot'] ??= [];
        const hit = store.find((row) => row.siteId === where.siteId);
        if (hit) {
          Object.assign(hit, update);
          return Promise.resolve(hit);
        }
        const row = { ...create, id: `siteHealthSnapshot-${++nextId}` };
        store.push(row);
        return Promise.resolve(row);
      }),
    });

    const models = [
      'contactType', 'contact', 'user', 'site', 'rack', 'asset',
      'floorPlan', 'pin', 'assetMovement', 'task', 'taskComment',
      'attachment', 'photo', 'billingEntity', 'expense', 'costAllocation',
      'connectivityLink', 'budget', 'siteHealthSnapshot', 'auditLog',
      'delegation',
    ];

    const prisma: Record<string, unknown> = {};
    for (const m of models) prisma[m] = makeModel(m);
    (prisma.delegation as { findFirst: jest.Mock }).findFirst = jest.fn().mockResolvedValue({
      id: 'del-default',
    });
    prisma.$transaction = jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
    prisma.$executeRawUnsafe = jest.fn();

    return {
      prisma,
      getAllCounts: () => {
        const counts: Record<string, number> = {};
        for (const m of models) {
          const calls = (prisma[m] as { create?: jest.Mock }).create?.mock.calls.length ?? 0;
          if (calls > 0) counts[m] = calls;
        }
        return counts;
      },
    };
  }

  it('first call creates rows ; second call with same dataFiles creates 0 (idempotent)', async () => {
    const { prisma, getAllCounts } = buildInMemoryPrismaStub();
    const service = new BackupService(
      prisma as never,
      {} as never,
      { get: jest.fn((k: string, fb?: string) => fb ?? '') } as never,
    );

    const dataFiles: Record<string, unknown[]> = {
      'contact-types': [
        { id: 'ct1', slug: 'provider', name: 'Fournisseur', category: 'PROVIDER' },
      ],
      sites: [{ id: 's1', code: 'SITE-A', name: 'Site A' }],
      assets: [
        { id: 'a1', siteId: 's1', name: 'Switch core', serialNumber: 'SN-001', type: 'SWITCH' },
      ],
    };
    const stagedFiles = new Map<
      string,
      { tmpPath: string; sha256: string; size: number; bucket: string; key: string }
    >();

    const first = await (
      service as never as {
        applyDataFilesToDb: (
          tid: string,
          df: Record<string, unknown[]>,
          sf: Map<string, unknown>,
          uid?: string,
        ) => Promise<{ counts: Record<string, number>; siteIds: string[] }>;
      }
    ).applyDataFilesToDb('tnt-test', dataFiles, stagedFiles);

    expect(first.counts._created).toBeGreaterThan(0);
    expect(first.counts._skipped).toBe(0);
    const firstCreatedTotals = getAllCounts();

    const second = await (
      service as never as {
        applyDataFilesToDb: (
          tid: string,
          df: Record<string, unknown[]>,
          sf: Map<string, unknown>,
          uid?: string,
        ) => Promise<{ counts: Record<string, number>; siteIds: string[] }>;
      }
    ).applyDataFilesToDb('tnt-test', dataFiles, stagedFiles);

    // KEY assertion : second run creates ZERO new rows.
    expect(second.counts._created).toBe(0);
    expect(second.counts._skipped).toBeGreaterThan(0);
    const secondCreatedTotals = getAllCounts();
    expect(secondCreatedTotals).toEqual(firstCreatedTotals);
  });

  it('Expense fallback : receiptFile null path uses (tenantId, amount, date, label.trim().toLowerCase())', async () => {
    const { prisma } = buildInMemoryPrismaStub();
    const service = new BackupService(
      prisma as never,
      {} as never,
      { get: jest.fn((k: string, fb?: string) => fb ?? '') } as never,
    );

    const dataFiles: Record<string, unknown[]> = {
      'billing-entities': [
        { id: 'be1', code: 'BE-A', name: 'Bearer A', type: 'INTERNAL' },
      ],
      expenses: [
        {
          id: 'exp1',
          bearerId: 'be1',
          label: '  Subscription FOO  ',
          totalAmount: 100,
          dateIncurred: '2026-05-13T00:00:00Z',
          delegationId: 'del-default',
          type: 'OPEX',
        },
      ],
    };
    const stagedFiles = new Map<
      string,
      { tmpPath: string; sha256: string; size: number; bucket: string; key: string }
    >();

    await (
      service as never as {
        applyDataFilesToDb: (
          tid: string,
          df: Record<string, unknown[]>,
          sf: Map<string, unknown>,
          uid?: string,
        ) => Promise<unknown>;
      }
    ).applyDataFilesToDb('tnt-test', dataFiles, stagedFiles);

    const expenseFindFirst = (prisma.expense as { findFirst: jest.Mock }).findFirst;
    expect(expenseFindFirst).toHaveBeenCalled();
    const lastCall = expenseFindFirst.mock.calls[expenseFindFirst.mock.calls.length - 1][0];
    expect(lastCall.where.label).toBe('subscription foo');
    expect(lastCall.where.tenantId).toBe('tnt-test');
    expect(lastCall.where.totalAmount).toBe(100);
    expect(lastCall.where.dateIncurred).toBeInstanceOf(Date);
    expect(lastCall.where.receiptFile).toBeUndefined();
  });

  it('Budget 2-pass : children created only after their parent (parentId remapped via idMap)', async () => {
    const { prisma } = buildInMemoryPrismaStub();
    const service = new BackupService(
      prisma as never,
      {} as never,
      { get: jest.fn((k: string, fb?: string) => fb ?? '') } as never,
    );

    const dataFiles: Record<string, unknown[]> = {
      'billing-entities': [{ id: 'be1', code: 'BE-A', type: 'INTERNAL', name: 'BE' }],
      budgets: [
        {
          id: 'budget-child',
          parentId: 'budget-root',
          label: 'Child',
          period: 'MONTH',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          amount: 100,
          billingEntityId: 'be1',
        },
        {
          id: 'budget-root',
          parentId: null,
          label: 'Root',
          period: 'YEAR',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          amount: 1200,
          billingEntityId: 'be1',
        },
      ],
    };
    const stagedFiles = new Map<
      string,
      { tmpPath: string; sha256: string; size: number; bucket: string; key: string }
    >();

    await (
      service as never as {
        applyDataFilesToDb: (
          tid: string,
          df: Record<string, unknown[]>,
          sf: Map<string, unknown>,
          uid?: string,
        ) => Promise<unknown>;
      }
    ).applyDataFilesToDb('tnt-test', dataFiles, stagedFiles);

    const budgetCreate = (prisma.budget as { create: jest.Mock }).create;
    expect(budgetCreate).toHaveBeenCalledTimes(2);
    // Pass 1 : root first (parentId null)
    const firstCall = budgetCreate.mock.calls[0][0].data;
    expect(firstCall.label).toBe('Root');
    expect(firstCall.parentId).toBeNull();
    // Pass 2 : child with remapped parentId. The in-memory stub uses a
    // global nextId counter, so the root's generated id depends on how
    // many rows were created before it (here : 1 billingEntity then the
    // budget root → root gets `budget-2`).
    const secondCall = budgetCreate.mock.calls[1][0].data;
    expect(secondCall.label).toBe('Child');
    expect(secondCall.parentId).toBe('budget-2');
  });
});
