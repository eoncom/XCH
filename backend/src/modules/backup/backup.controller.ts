import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';
import { BackupService } from './backup.service';

@ApiTags('backup')
@ApiBearerAuth()
@Controller('backup')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  // ===== Full Backup =====

  @Post('full')
  @Resource('backup')
  @Action('create')
  @SkipThrottle()
  @ApiOperation({ summary: '[ADMIN] Create full database + files backup' })
  async createFullBackup(@Request() req: AuthRequest) {
    const result = await this.backupService.createFullBackup(req.user.tenantId, req.user.id);
    return result;
  }

  // ===== Site Backup =====

  @Post('site/:siteId')
  @Resource('backup')
  @Action('create')
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

  // ===== Site Restore =====

  @Post('site/restore')
  @Resource('backup')
  @Action('create')
  @SkipThrottle()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
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

  // ===== Backup Management =====

  @Get('list')
  @Resource('backup')
  @Action('read')
  @ApiOperation({ summary: '[ADMIN] List available backups' })
  async listBackups(@Request() req: AuthRequest) {
    return this.backupService.listBackups(req.user.tenantId);
  }

  @Get(':id/download')
  @Resource('backup')
  @Action('read')
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
  @Resource('backup')
  @Action('delete')
  @ApiOperation({ summary: '[ADMIN] Delete a backup' })
  async deleteBackup(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ) {
    return this.backupService.deleteBackup(req.user.tenantId, id);
  }
}
