import { Readable } from 'stream';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as archiver from 'archiver';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');

import {
  BackupService,
  HashingStream,
  BackupMetadataV2,
  BackupFileEntryV2,
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
