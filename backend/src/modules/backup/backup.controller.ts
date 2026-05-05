import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Request,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthRequest } from '../../types/request.interface';
import { BackupService } from './backup.service';
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
import { DeleteBackupResultResponseDto } from './dto/delete-backup-result.response.dto';

@ApiTags('backup')
@ApiBearerAuth()
@Controller('backup')
@SkipDelegation()
@RequireManage()
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  // ===== Full Backup =====

  @Post('full')
  @RequireWrite()
  @SkipThrottle()
  @ApiOperation({ summary: '[ADMIN] Create full database + files backup' })
  @ApiCreatedResponse({ type: BackupResultResponseDto })
  async createFullBackup(@Request() req: AuthRequest): Promise<BackupResultResponseDto> {
    const result = await this.backupService.createFullBackup(req.user.tenantId, req.user.id);
    return toResponse(BackupResultResponseDto, result);
  }

  // ===== Full Restore =====

  @Post('full/restore')
  @RequireWrite()
  @SkipThrottle()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
      fileFilter: backupFileFilter,
    }),
  )
  @ApiOperation({ summary: '[ADMIN] Restore full backup from ZIP' })
  @ApiOkResponse({ type: RestoreFullResultResponseDto })
  async restoreFullBackup(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthRequest,
  ): Promise<RestoreFullResultResponseDto> {
    const result = await this.backupService.restoreFullBackup(
      req.user.tenantId,
      file.buffer,
      req.user.id,
    );
    return toRestoreFullResultResponseDto(result);
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
  @ApiOperation({ summary: '[ADMIN] Create site-specific backup (ZIP)' })
  @ApiOkResponse({ description: 'Binary ZIP file stream (application/zip)' })
  async createSiteBackup(
    @Param('siteId') siteId: string,
    @Request() req: AuthRequest,
    @Res() res: Response,
  ) {
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
