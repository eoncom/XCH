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
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthRequest } from '../../types/request.interface';
import { BackupService } from './backup.service';
import { backupFileFilter } from '../../common/utils/upload-security';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { RequireManage, RequireRead, RequireWrite } from '../../common/decorators/require-right.decorator';

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
  async createFullBackup(@Request() req: AuthRequest) {
    const result = await this.backupService.createFullBackup(req.user.tenantId, req.user.id);
    return result;
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
  async restoreFullBackup(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthRequest,
  ) {
    return this.backupService.restoreFullBackup(
      req.user.tenantId,
      file.buffer,
      req.user.id,
    );
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
  async restoreSiteBackup(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthRequest,
  ) {
    return this.backupService.restoreSiteBackup(
      req.user.tenantId,
      file.buffer,
      req.user.id,
    );
  }

  // ===== Site Backup =====

  @Post('site/:siteId')
  @RequireWrite()
  @SkipThrottle()
  @ApiOperation({ summary: '[ADMIN] Create site-specific backup (ZIP)' })
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
  async cleanupStorage(@Request() req: AuthRequest) {
    return this.backupService.cleanupOrphanedStorage(
      req.user.tenantId,
      req.user.id,
      0, // No grace period when triggered manually — user wants cleanup now
    );
  }

  // ===== Backup Management =====

  @Get('list')
  @RequireRead()
  @ApiOperation({ summary: '[ADMIN] List available backups' })
  async listBackups(@Request() req: AuthRequest) {
    const backups = await this.backupService.listBackups(req.user.tenantId);
    return { backups, total: backups.length };
  }

  @Get(':id/download')
  @RequireRead()
  @SkipThrottle()
  @ApiOperation({ summary: '[ADMIN] Download a backup file' })
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
  async deleteBackup(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ) {
    return this.backupService.deleteBackup(req.user.tenantId, id);
  }
}
