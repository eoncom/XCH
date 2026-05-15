import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Headers,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
  NotFoundException,
  BadRequestException,
  Param,
  Request,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { diskStorage, memoryStorage } from 'multer';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomBytes } from 'crypto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiAcceptedResponse,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthRequest } from '../../types/request.interface';
import { BackupService } from './backup.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { backupFileFilter } from '../../common/utils/upload-security';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { RequireManage, RequireRead, RequireWrite } from '../../common/decorators/require-right.decorator';
import { toResponse } from '../../common/utils/to-response.util';
import { BackupResultResponseDto } from './dto/backup-result.response.dto';
import {
  RestoreFullResultResponseDto,
  RestoreSiteResultResponseDto,
  toRestoreFullResultResponseDto,
  toRestoreSiteResultResponseDto,
} from './dto/restore-result.response.dto';
import { CleanupStorageResultResponseDto } from './dto/cleanup-storage-result.response.dto';
import { BackupListResponseDto } from './dto/backup-list.response.dto';
import { BackupCapabilitiesResponseDto } from './dto/backup-capabilities.response.dto';
import { DeleteBackupResultResponseDto } from './dto/delete-backup-result.response.dto';
import { BackupOptionsDto } from './dto/backup-options.dto';
import { RestoreOptionsDto } from './dto/restore-options.dto';
import { EstimateResponseDto } from './dto/estimate.response.dto';
import { BackupJobEnqueuedResponseDto } from './dto/backup-job-enqueued.response.dto';
import {
  JobStatusResponseDto,
  JobProgressResponseDto,
} from './dto/job-status.response.dto';
import {
  BACKUP_QUEUE,
  JOB_BACKUP_FULL,
  JOB_BACKUP_SITE,
  JOB_RESTORE_FULL,
  BACKUP_JOB_OPTIONS,
  BackupFullJobData,
  BackupSiteJobData,
  RestoreFullJobData,
} from './backup.queue';

@ApiTags('backup')
@ApiBearerAuth()
@Controller('backup')
@SkipDelegation()
@RequireManage()
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(
    private readonly backupService: BackupService,
    @InjectQueue(BACKUP_QUEUE) private readonly backupQueue: Queue,
    /** Track D.2 Step 2 — capability discovery + encrypt:true server gate. */
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Header that forces the legacy synchronous path on `/backup/full`,
   * `/backup/full/restore` JSON mode, and `/backup/site/:id`. Originally
   * added as an emergency escape hatch when Redis/Bull is unavailable.
   *
   * **DEPRECATED — Track D.2 Step 5 (v2.3.0)**. The async paths cover
   * every use case after Step 4.5 shipped (multipart upload restore
   * replaces the sync v1 multipart). Every request that still carries
   * `X-Backup-Sync: 1` is logged via {@link logSyncDeprecationWarn}
   * with the tenant + user context so we can grep prod logs to confirm
   * zero callers before the hard removal in **v2.4.0**.
   *
   * See ADR-026 §4.
   */
  private static readonly SYNC_HEADER = 'x-backup-sync';

  /**
   * Track D.2 Step 5 — single warn-log emit point for every sync-path
   * hit. Grep marker `XCH_LOG_MARKER X-Backup-Sync` allows ops to count
   * occurrences over a soak window before hard delete in v2.4.0.
   *
   * Format kept stable across the 3 endpoints so log aggregators can
   * group by it.
   */
  private logSyncDeprecationWarn(
    endpoint: string,
    tenantId: string,
    userId?: string,
  ): void {
    this.logger.warn(
      `XCH_LOG_MARKER X-Backup-Sync header used on ${endpoint} ` +
        `— DEPRECATED, will be removed in v2.4.0 ` +
        `(tenant=${tenantId} user=${userId ?? 'unknown'})`,
    );
  }

  // ===== Capability discovery (Track D.2) =====

  /**
   * Server-driven feature flags for the backup module. Frontend calls
   * this at dialog mount to grey out toggles whose backend prerequisites
   * are missing (e.g. encryption needs `XCH_MASTER_KEY` per ADR-019).
   *
   * Track D.2 Step 2 — see ADR-026 §1.
   */
  @Get('capabilities')
  @RequireRead()
  @SkipThrottle()
  @ApiOperation({
    summary: '[ADMIN] Backup capability flags (server-driven UI toggle gates)',
  })
  @ApiOkResponse({ type: BackupCapabilitiesResponseDto })
  async getCapabilities(): Promise<BackupCapabilitiesResponseDto> {
    return toResponse(BackupCapabilitiesResponseDto, {
      encryption: this.crypto.isEnabled(),
    });
  }

  // ===== Pre-flight (Track D.1) =====

  @Post('estimate')
  @RequireRead()
  @SkipThrottle()
  @ApiOperation({
    summary: '[ADMIN] Pre-flight backup size estimate + disk-space check',
  })
  @ApiOkResponse({ type: EstimateResponseDto })
  async estimate(
    @Body() options: BackupOptionsDto,
    @Request() req: AuthRequest,
  ): Promise<EstimateResponseDto> {
    const result = await this.backupService.estimateBackupSize(
      req.user.tenantId,
      options,
    );
    return toResponse(EstimateResponseDto, result);
  }

  // ===== Full Backup =====

  @Post('full')
  @RequireWrite()
  @SkipThrottle()
  @ApiOperation({
    summary: '[ADMIN] Create full backup (async via Bull v3 by default)',
    description:
      'Default: 202 + jobId — caller polls GET /backup/jobs/:jobId. ' +
      'Header X-Backup-Sync: 1 forces the legacy synchronous path — ' +
      '**DEPRECATED, will be removed in v2.4.0**.',
  })
  @ApiHeader({
    name: 'X-Backup-Sync',
    description:
      '**DEPRECATED — removed in v2.4.0.** Set to "1" to force the legacy ' +
      'synchronous path. The async path (default) is the only supported flow ' +
      'post-v2.3.0; this escape hatch will hard-fail once v2.4.0 ships. ' +
      'See ADR-026 §4.',
    required: false,
    deprecated: true,
  })
  @ApiAcceptedResponse({ type: BackupJobEnqueuedResponseDto })
  @ApiCreatedResponse({ type: BackupResultResponseDto, description: 'Sync mode only' })
  async createFullBackup(
    @Body() options: BackupOptionsDto,
    @Headers(BackupController.SYNC_HEADER) syncHeader: string | undefined,
    @Request() req: AuthRequest,
  ): Promise<BackupResultResponseDto | BackupJobEnqueuedResponseDto> {
    // Track D.2 Step 2 — server-side gate for the `encrypt` flag.
    // Reject with HTTP 412 Precondition Failed when the toggle is on
    // but XCH_MASTER_KEY is unset. The frontend toggle should already
    // be greyed out via GET /backup/capabilities, but defensive servers
    // never trust the client.
    if (options?.encrypt && !this.crypto.isEnabled()) {
      throw new HttpException(
        'Backup encryption requested but XCH_MASTER_KEY is not configured on the server. ' +
          'Verify via GET /backup/capabilities.',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    if (syncHeader === '1') {
      // Track D.2 Step 5 — deprecation warn log. Every sync-path hit is
      // logged so ops can grep prod logs for the marker before the v2.4.0
      // hard removal. Zero hits over 1 week = green to delete.
      this.logSyncDeprecationWarn('POST /backup/full', req.user.tenantId, req.user.id);

      // Legacy sync path — v1 createFullBackup body, kept for fallback.
      // v1 does NOT honor encryption (encryption is a v2 feature). If
      // encrypt:true was set and we still reach the sync path, the
      // operator has explicitly chosen the legacy path: log a warning
      // but proceed without encryption rather than failing the request.
      if (options?.encrypt) {
        this.logger.warn(
          `Backup encrypt:true ignored on legacy sync path (X-Backup-Sync: 1) — ` +
            `v1 has no streaming cipher. Tenant ${req.user.tenantId}`,
        );
      }
      const result = await this.backupService.createFullBackup(
        req.user.tenantId,
        req.user.id,
      );
      return toResponse(BackupResultResponseDto, result);
    }
    // Async path : enqueue + return 202 with jobId.
    const jobData: BackupFullJobData = {
      tenantId: req.user.tenantId,
      userId: req.user.id,
      options: {
        dbOnly: options?.dbOnly,
        encrypt: options?.encrypt,
      },
    };
    const job = await this.backupQueue.add(JOB_BACKUP_FULL, jobData, BACKUP_JOB_OPTIONS);
    return toResponse(BackupJobEnqueuedResponseDto, {
      enqueued: true,
      jobId: String(job.id),
    });
  }

  // ===== Job status polling (Track D.1 step 5) =====

  @Get('jobs/:jobId')
  @RequireRead()
  @SkipThrottle()
  @ApiOperation({
    summary: '[ADMIN] Poll backup-jobs queue status for a previously enqueued job',
  })
  @ApiOkResponse({ type: JobStatusResponseDto })
  async getJobStatus(@Param('jobId') jobId: string): Promise<JobStatusResponseDto> {
    const job = await this.backupQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Backup job ${jobId} not found`);
    }

    const rawState = await job.getState();
    // Bull v3 states : 'completed' | 'waiting' | 'active' | 'delayed' |
    // 'failed' | 'paused' | 'stuck' | 'unknown'. Map non-DTO states to
    // the closest equivalent so the frontend hook never sees an unexpected
    // value.
    const state: JobStatusResponseDto['state'] =
      rawState === 'completed' || rawState === 'failed' || rawState === 'active'
        ? rawState
        : 'waiting'; // 'delayed' | 'paused' | 'unknown' → treat as waiting

    // Bull `job.progress()` returns whatever was last set : number, object,
    // or 0 if never updated. Normalize to JobProgressResponseDto shape.
    const rawProgress = job.progress();
    const progress: JobProgressResponseDto =
      typeof rawProgress === 'object' && rawProgress !== null
        ? (rawProgress as JobProgressResponseDto)
        : {
            phase: rawState,
            percent: typeof rawProgress === 'number' ? rawProgress : 0,
            current: 0,
            total: 1,
            message: '',
          };

    // Cas B helper-style : we construct the DTO manually (rather than via
    // `toResponse(JobStatusResponseDto, ...)`) because the `result` field is
    // typed `unknown` and class-transformer's `excludeExtraneousValues: true`
    // would strip its nested keys. The orchestrator return values
    // (BackupResult, RestoreFullV2Result, DryRunReport, …) each have their
    // own DTO contract at the job level — what we surface here is opaque
    // pass-through that the frontend interprets per kind.
    const dto: JobStatusResponseDto = {
      state,
      progress,
      result: state === 'completed' ? (job.returnvalue as unknown) : undefined,
      error: state === 'failed' ? job.failedReason ?? undefined : undefined,
    };
    return dto;
  }

  // ===== Full Restore =====

  @Post('full/restore')
  @RequireWrite()
  @SkipThrottle()
  @ApiOperation({
    summary:
      '[ADMIN] Restore full backup — JSON async + dry-run (multipart sync v1 DEPRECATED, retrait v2.4.0)',
    description:
      'JSON `{ backupId, dryRun? }` enqueues an async restore from a catalog ' +
      'entry. The multipart `file` field is the legacy sync v1 path — ' +
      '**DEPRECATED, will be removed in v2.4.0**. Use `POST /backup/full/' +
      'restore-upload` (Track D.2 Step 4.5) for async restore from a local ZIP.',
  })
  @ApiOkResponse({ type: RestoreFullResultResponseDto })
  @ApiAcceptedResponse({ type: BackupJobEnqueuedResponseDto })
  @ApiHeader({
    name: 'X-Backup-Sync',
    description:
      '**DEPRECATED — removed in v2.4.0.** Forces the legacy sync path on ' +
      'the JSON-mode restore. See ADR-026 §4.',
    required: false,
    deprecated: true,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
      fileFilter: backupFileFilter,
    }),
  )
  async restoreFullBackup(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() restoreOptions: RestoreOptionsDto | undefined,
    @Headers(BackupController.SYNC_HEADER) syncHeader: string | undefined,
    @Request() req: AuthRequest,
  ): Promise<RestoreFullResultResponseDto | BackupJobEnqueuedResponseDto> {
    // Multipart upload → legacy sync v1 path. Track D.2 Step 5 emits a
    // deprecation warn log so ops can confirm zero callers before the
    // v2.4.0 hard delete. Async multipart upload via the new
    // `/backup/full/restore-upload` endpoint (Step 4.5) is the supported
    // replacement.
    if (file?.buffer) {
      this.logSyncDeprecationWarn(
        'POST /backup/full/restore (multipart file)',
        req.user.tenantId,
        req.user.id,
      );
      const result = await this.backupService.restoreFullBackup(
        req.user.tenantId,
        file.buffer,
        req.user.id,
      );
      return toRestoreFullResultResponseDto(result);
    }

    // JSON path : { backupId, dryRun? } against an existing catalog entry.
    const backupId = restoreOptions?.backupId;
    if (!backupId) {
      throw new BadRequestException(
        'Provide multipart `file` (sync v1) OR JSON body { backupId, dryRun? } (async v2)',
      );
    }

    // Track D.2 Step 4 — cross-tenant permission gate. The target delegation
    // MUST belong to the caller's tenant; the @RequireManage decorator above
    // already enforces manage on the SOURCE tenant. Together they form the
    // double-check specified in plan v3.
    if (restoreOptions?.targetDelegationId) {
      await this.backupService.assertTargetDelegationAccessible(
        restoreOptions.targetDelegationId,
        req.user.tenantId,
      );
    }

    if (syncHeader === '1') {
      // Track D.2 Step 5 — deprecation warn log on the JSON sync v2 path
      // (Redis-unhealthy escape hatch). Sentry telemetry via the global
      // request handler will pick this up too if needed.
      this.logSyncDeprecationWarn(
        'POST /backup/full/restore (JSON sync v2)',
        req.user.tenantId,
        req.user.id,
      );

      // Sync v2 fallback — bypass the queue, run in-process. Useful when
      // Redis is unhealthy.
      const result = await this.backupService.restoreFullBackupV2(
        req.user.tenantId,
        backupId,
        {
          dryRun: restoreOptions?.dryRun,
          targetDelegationId: restoreOptions?.targetDelegationId,
        },
        undefined,
        req.user.id,
      );
      // Coerce the v2 discriminated union back to the v1 wire shape for
      // legacy consumers. dry-run / delegated-v1 / applied all map to
      // {message, counts, siteIds}.
      const flat: { message: string; counts: Record<string, number>; siteIds: string[] } =
        result.kind === 'dry-run'
          ? {
              message: 'Dry-run report computed (no DB writes)',
              counts: {
                ...result.report.wouldCreate,
                _created: 0,
                _skipped: Object.values(result.report.wouldCreate).reduce((a, b) => a + b, 0),
              },
              siteIds: [],
            }
          : { message: result.message, counts: result.counts, siteIds: result.siteIds };
      return toRestoreFullResultResponseDto(flat);
    }

    // Async path : enqueue + return 202 with jobId.
    const jobData: RestoreFullJobData = {
      tenantId: req.user.tenantId,
      backupId,
      userId: req.user.id,
      options: {
        dryRun: restoreOptions?.dryRun,
        targetDelegationId: restoreOptions?.targetDelegationId,
      },
    };
    const job = await this.backupQueue.add(JOB_RESTORE_FULL, jobData, BACKUP_JOB_OPTIONS);
    return toResponse(BackupJobEnqueuedResponseDto, {
      enqueued: true,
      jobId: String(job.id),
    });
  }

  // ===== Async multipart upload restore (Track D.2 Step 4.5) =====

  /**
   * Restore a backup from a locally-uploaded ZIP file (no catalog entry
   * required). The ZIP streams to disk in `os.tmpdir()` via multer's
   * diskStorage, the controller enqueues a `restore-full` Bull job that
   * reads from the tmp path, and the processor cleans up via try/finally.
   *
   * Pre-requisite for v2.4.0's hard removal of `X-Backup-Sync: 1`: the
   * legacy sync path was the only way to restore from a local ZIP. After
   * Step 4.5 ships, async multipart upload becomes the only supported
   * DR path for "restore from local backup".
   *
   * Encrypted backups: the operator MUST upload BOTH the `.zip` AND its
   * sidecar `<filename>.enc.json`. Server pre-checks the ZIP's first 4
   * bytes and surfaces an explicit error if the sidecar is missing.
   *
   * Track D.2 Step 4.5 — see ADR-026 §6.
   */
  @Post('full/restore-upload')
  @RequireWrite()
  @SkipThrottle()
  @ApiOperation({
    summary:
      '[ADMIN] Restore full backup from multipart upload (async, no catalog entry)',
    description:
      'Upload a backup ZIP (`backup` field) + optional sidecar JSON ' +
      '(`sidecar` field) for encrypted archives. Server streams the upload ' +
      'to a tmp file, returns 202 + jobId, and the worker performs the ' +
      'restore asynchronously. Replaces the legacy sync v1 multipart path ' +
      'as `X-Backup-Sync` is deprecated.',
  })
  @ApiAcceptedResponse({ type: BackupJobEnqueuedResponseDto })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'backup', maxCount: 1 },
        { name: 'sidecar', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: os.tmpdir(),
          filename: (_req, file, cb) => {
            // xch-restore-upload-<uuid>-<field>.<ext>
            const uuid = randomBytes(8).toString('hex');
            const ext = file.fieldname === 'sidecar' ? '.enc.json' : '.zip';
            cb(null, `xch-restore-upload-${uuid}-${file.fieldname}${ext}`);
          },
        }),
        limits: { fileSize: 50 * 1024 * 1024 * 1024 }, // 50 GB
        fileFilter: (_req, file, cb) => {
          if (file.fieldname === 'backup') {
            // Only validate the backup file's mimetype loosely (operator may
            // upload a renamed .zip — we re-validate via MagicByteValidator
            // in the service pipeline anyway).
            const ok = file.mimetype === 'application/zip' ||
              file.mimetype === 'application/octet-stream' ||
              file.originalname.toLowerCase().endsWith('.zip');
            cb(ok ? null : new BadRequestException('backup field must be a .zip file'), ok);
          } else if (file.fieldname === 'sidecar') {
            const ok = file.mimetype === 'application/json' ||
              file.originalname.toLowerCase().endsWith('.json');
            cb(ok ? null : new BadRequestException('sidecar field must be a .json file'), ok);
          } else {
            cb(new BadRequestException(`Unknown field: ${file.fieldname}`), false);
          }
        },
      },
    ),
  )
  async restoreFullBackupFromUpload(
    @UploadedFiles()
    files: { backup?: Express.Multer.File[]; sidecar?: Express.Multer.File[] },
    @Body() body: RestoreOptionsDto | undefined,
    @Request() req: AuthRequest,
  ): Promise<BackupJobEnqueuedResponseDto> {
    const backupFile = files?.backup?.[0];
    if (!backupFile) {
      throw new BadRequestException(
        'Missing `backup` multipart field — upload a ZIP file under field name `backup`',
      );
    }
    const sidecarFile = files?.sidecar?.[0];

    // Defensive: if anything below throws BEFORE we hand ownership to the
    // worker queue, we MUST clean up the tmp files multer wrote to disk.
    // After enqueue succeeds, the worker's try/finally takes over.
    let enqueued = false;
    try {
      // Permission gate (Track D.2 Step 4 — cross-tenant restore). Identical
      // to the catalog path: if the operator targets another delegation,
      // it must belong to their tenant.
      if (body?.targetDelegationId) {
        await this.backupService.assertTargetDelegationAccessible(
          body.targetDelegationId,
          req.user.tenantId,
        );
      }

      // Parse boolean form fields. Multipart form values arrive as strings —
      // class-validator + class-transformer would do this for us if the
      // controller used a DTO directly, but body comes from multer raw.
      const dryRun = body?.dryRun === true ||
        (body?.dryRun as unknown as string) === 'true' ||
        (body?.dryRun as unknown as string) === '1';

      // Track D.2 Step 4.5 — basic disk-check pre-enqueue. The upload
      // already landed on disk (multer streamed it), so we can size it
      // here. We check that there's still ~1.2 × file size + 512 MB free
      // for the restore pipeline (tmp staging + Prisma logs + os jitter).
      // Mirrors the pattern from D.1 step 1 estimateBackupSize.
      const uploadedSize = backupFile.size;
      try {
        const stat = await fs.statfs(os.tmpdir());
        const freeBytes = Number(stat.bavail) * Number(stat.bsize);
        const needed = uploadedSize * 1.2 + 512 * 1024 * 1024;
        if (freeBytes < needed) {
          // RFC 4918 §11.5 (507 Insufficient Storage) — absent from
          // HttpStatus enum, literal 507 (same pattern as D.1 step 1).
          throw new HttpException(
            `Insufficient disk space for restore: need ~${Math.ceil(needed / 1024 / 1024)} MB, ` +
              `${Math.floor(freeBytes / 1024 / 1024)} MB free in ${os.tmpdir()}`,
            507,
          );
        }
      } catch (err: unknown) {
        // `fs.statfs` may not be available on every Node build (it's
        // Node 18.15+ stable). If the call itself fails, log and proceed —
        // the worker will still surface ENOSPC if disk truly runs out
        // mid-restore. Don't fail the request on the check itself failing.
        if (err instanceof HttpException) throw err;
        this.logger.warn(
          `Disk check skipped on tmpdir (${err instanceof Error ? err.message : 'unknown'})`,
        );
      }

      // Async path : enqueue + return 202 with jobId. The processor takes
      // ownership of the tmp paths via the try/finally in restoreFullBackupV2.
      const jobData: RestoreFullJobData = {
        tenantId: req.user.tenantId,
        userId: req.user.id,
        tmpUploadPath: backupFile.path,
        tmpSidecarPath: sidecarFile?.path,
        options: {
          dryRun,
          targetDelegationId: body?.targetDelegationId,
        },
      };
      const job = await this.backupQueue.add(JOB_RESTORE_FULL, jobData, BACKUP_JOB_OPTIONS);
      enqueued = true;
      this.logger.log(
        `Upload-restore enqueued for tenant ${req.user.tenantId}: job ${job.id}, ` +
          `backup=${backupFile.path} (${backupFile.size} bytes), ` +
          `sidecar=${sidecarFile?.path ?? 'none'}, dryRun=${dryRun}`,
      );
      return toResponse(BackupJobEnqueuedResponseDto, {
        enqueued: true,
        jobId: String(job.id),
      });
    } finally {
      if (!enqueued) {
        // Synchronous failure (permission gate, disk check, queue down) —
        // the worker never picked up the job, so we own the cleanup here.
        // Use sync rm to ensure files are gone before the response flushes.
        if (backupFile.path) {
          try { fsSync.rmSync(backupFile.path, { force: true }); } catch { /* ignore */ }
        }
        if (sidecarFile?.path) {
          try { fsSync.rmSync(sidecarFile.path, { force: true }); } catch { /* ignore */ }
        }
      }
    }
  }

  // ===== Site Restore (MUST be before :siteId to avoid route conflict) =====

  @Post('site/restore')
  @RequireWrite()
  @SkipThrottle()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
      fileFilter: backupFileFilter,
    }),
  )
  @ApiOperation({ summary: '[ADMIN] Restore site from backup ZIP' })
  @ApiOkResponse({ type: RestoreSiteResultResponseDto })
  async restoreSiteBackup(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthRequest,
  ): Promise<RestoreSiteResultResponseDto> {
    const result = await this.backupService.restoreSiteBackup(
      req.user.tenantId,
      file.buffer,
      req.user.id,
    );
    return toRestoreSiteResultResponseDto(result);
  }

  // ===== Site Backup =====

  @Post('site/:siteId')
  @RequireWrite()
  @SkipThrottle()
  @ApiOperation({
    summary:
      '[ADMIN] Create site-specific backup — async (default); X-Backup-Sync streamed ZIP DEPRECATED v2.4.0',
    description:
      'Default: 202 + jobId, the archive is uploaded to xch-backups by the worker. ' +
      'Header X-Backup-Sync: 1 keeps the legacy synchronous behaviour (streams ZIP ' +
      'inline) — **DEPRECATED, will be removed in v2.4.0**.',
  })
  @ApiHeader({
    name: 'X-Backup-Sync',
    description:
      '**DEPRECATED — removed in v2.4.0.** Set to "1" to stream the ZIP back ' +
      'inline (legacy v1 path). See ADR-026 §4.',
    required: false,
    deprecated: true,
  })
  @ApiAcceptedResponse({ type: BackupJobEnqueuedResponseDto })
  @ApiOkResponse({ description: 'Sync only — binary ZIP stream (application/zip)' })
  async createSiteBackup(
    @Param('siteId') siteId: string,
    @Headers(BackupController.SYNC_HEADER) syncHeader: string | undefined,
    @Request() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BackupJobEnqueuedResponseDto | void> {
    if (syncHeader === '1') {
      // Track D.2 Step 5 — deprecation warn log on the site-backup
      // inline-stream path. v2.4.0 will hard-remove this branch; until
      // then the marker is the trace ops use to confirm zero callers.
      this.logSyncDeprecationWarn(
        `POST /backup/site/${siteId}`,
        req.user.tenantId,
        req.user.id,
      );

      // Legacy sync path — stream the binary ZIP inline.
      const { buffer, filename } = await this.backupService.createSiteBackup(
        req.user.tenantId,
        siteId,
        req.user.id,
      );
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
      return;
    }

    // Async path : enqueue. The processor calls createSiteBackup which
    // ALREADY uploads to xch-backups (cf service line ~289), so the
    // caller polls GET /backup/jobs/:jobId then downloads via GET
    // /backup/:id/download once the job is `completed`.
    const jobData: BackupSiteJobData = {
      tenantId: req.user.tenantId,
      siteId,
      userId: req.user.id,
    };
    const job = await this.backupQueue.add(JOB_BACKUP_SITE, jobData, BACKUP_JOB_OPTIONS);
    return toResponse(BackupJobEnqueuedResponseDto, {
      enqueued: true,
      jobId: String(job.id),
    });
  }

  // ===== Storage Cleanup =====

  @Post('cleanup-storage')
  @RequireWrite()
  @SkipThrottle()
  @ApiOperation({ summary: '[ADMIN] Clean up orphaned files in storage' })
  @ApiOkResponse({ type: CleanupStorageResultResponseDto })
  async cleanupStorage(@Request() req: AuthRequest): Promise<CleanupStorageResultResponseDto> {
    const result = await this.backupService.cleanupOrphanedStorage(
      req.user.tenantId,
      req.user.id,
      0, // No grace period when triggered manually — user wants cleanup now
    );
    return toResponse(CleanupStorageResultResponseDto, result);
  }

  // ===== Backup Management =====

  @Get('list')
  @RequireRead()
  @ApiOperation({ summary: '[ADMIN] List available backups' })
  @ApiOkResponse({ type: BackupListResponseDto })
  async listBackups(@Request() req: AuthRequest): Promise<BackupListResponseDto> {
    const backups = await this.backupService.listBackups(req.user.tenantId);
    return toResponse(BackupListResponseDto, { backups, total: backups.length });
  }

  @Get(':id/download')
  @RequireRead()
  @SkipThrottle()
  @ApiOperation({ summary: '[ADMIN] Download a backup file' })
  @ApiOkResponse({ description: 'Binary backup archive stream (application/zip)' })
  async downloadBackup(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Res() res: Response,
  ) {
    const { buffer, filename, contentType } = await this.backupService.downloadBackup(
      req.user.tenantId,
      id,
    );

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: '[ADMIN] Delete a backup' })
  @ApiOkResponse({ type: DeleteBackupResultResponseDto })
  async deleteBackup(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<DeleteBackupResultResponseDto> {
    return this.backupService.deleteBackup(req.user.tenantId, id);
  }
}
