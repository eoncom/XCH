import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { DatabaseModule } from '../../config/database.module';
import { NetBoxProviderService } from './providers/netbox.provider';
import { IntegrationMappingModule } from './mapping/integration-mapping.module';

/**
 * Integrations module — NetBox today (asset / site sync).
 * Native monitoring (ADR-016) owns its data end-to-end in modules/monitoring/.
 */
@Module({
  imports: [DatabaseModule, IntegrationMappingModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, NetBoxProviderService],
  exports: [IntegrationsService, IntegrationMappingModule],
})
export class IntegrationsModule {}
