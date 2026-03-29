import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { AuditLogService } from '../../common/services/audit-log.service';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, AuditLogService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
