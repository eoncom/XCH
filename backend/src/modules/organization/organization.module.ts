import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { SiteAccessModule } from '../site-access/site-access.module';
import { AuditLogService } from '../../common/services/audit-log.service';

@Module({
  imports: [SiteAccessModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, AuditLogService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
