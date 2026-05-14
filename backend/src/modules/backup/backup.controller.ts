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
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { memoryStorage } from 'multer';
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
   * Header that forces the legacy synchronous path on `/backup/full` (and
   * the JSON-mode `/backup/full/restore`). Useful when Redis is down or
   * for one-shot ops debugging. Sent by clients as `X-Backup-Sync: 1`.
   * Slated for removal in D.2 once async path is validated in prod.
   */
  private static readonly SYNC_HEADER = 'x-backup-sync';

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
      'Header X-Backup-Sync: 1 forces the legacy synchronous path (returns 201 + filename).',
  })
  @ApiHeader({
    name: 'X-Backup-Sync',
    description: 'Set to "1" to force the legacy synchronous path.',
    required: false,
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
  @ApiOperation({ summary: '[ADMIN] Restore full backup — multipart sync OR JSON async + dry-run' })
  @ApiOkResponse({ type: RestoreFullResultResponseDto })
  @ApiAcceptedResponse({ type: BackupJobEnqueuedResponseDto })
  @ApiHeader({ name: 'X-Backup-Sync', required: false })
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
    // Multipart upload → sync v1 path (kept as-is for step 5 scope ;
    // async multipart upload via tmp staging is deferred to D.2).
    if (file?.buffer) {
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

    if (syncHeader === '1') {
      // Sync v2 fallback — bypass the queue, run in-process. Useful when
      // Redis is unhealthy.
      const result = await this.backupService.restoreFullBackupV2(
        req.user.tenantId,
        backupId,
        { dryRun: restoreOptions?.dryRun },
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
      options: { dryRun: restoreOptions?.dryRun },
    };
    const job = await this.backupQueue.add(JOB_RESTORE_FULL, jobData, BACKUP_JOB_OPTIONS);
    return toResponse(BackupJobEnqueuedResponseDto, {
      enqueued: true,
      jobId: String(job.id),
    });
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
      '[ADMIN] Create site-specific backup — async (default) OR streamed ZIP (X-Backup-Sync: 1)',
    description:
      'Default: 202 + jobId, the archive is uploaded to xch-backups by the worker. ' +
      'Header X-Backup-Sync: 1 keeps the legacy synchronous behaviour (streams ZIP inline).',
  })
  @ApiHeader({
    name: 'X-Backup-Sync',
    description: 'Set to "1" to stream the ZIP back inline (legacy v1 path).',
    required: false,
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
