import { Module } from '@nestjs/common';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { StorageService } from '../../common/services/storage.service';
import { AuditLogService } from '../../common/services/audit-log.service';

@Module({
  imports: [],
  controllers: [SitesController],
  providers: [SitesService, StorageService, AuditLogService],
  exports: [SitesService],
})
export class SitesModule {}
