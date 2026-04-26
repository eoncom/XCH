import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { DatabaseModule } from '../../config/database.module';
import { NetBoxProviderService } from './providers/netbox.provider';
import { IntegrationMappingModule } from './mapping/integration-mapping.module';

/**
 * Integrations module — NetBox today (asset / site sync).
 * Monitoring providers (Gatus / Uptime Kuma) and the webhook controller
 * were removed in ADR-016. Native monitoring lives in modules/monitoring/
 * and owns its data end-to-end.
 */
@Module({
  imports: [DatabaseModule, IntegrationMappingModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, NetBoxProviderService],
  exports: [IntegrationsService, IntegrationMappingModule],
})
export class IntegrationsModule {}
