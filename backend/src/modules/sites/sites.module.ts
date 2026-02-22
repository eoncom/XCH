import { Module, forwardRef } from '@nestjs/common';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { StorageService } from '../../common/services/storage.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { SiteAccessModule } from '../site-access/site-access.module';

@Module({
  imports: [forwardRef(() => SiteAccessModule)],
  controllers: [SitesController],
  providers: [SitesService, StorageService, AuditLogService],
  exports: [SitesService],
})
export class SitesModule {}
