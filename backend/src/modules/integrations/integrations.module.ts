import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { DatabaseModule } from '../../config/database.module';
import { NetBoxProviderService } from './providers/netbox.provider';
import { UptimeKumaProviderService } from './providers/uptime-kuma.provider';
import { HealthAggregationService } from './health-aggregation.service';
import { IntegrationMappingModule } from './mapping/integration-mapping.module';

@Module({
  imports: [DatabaseModule, IntegrationMappingModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, NetBoxProviderService, UptimeKumaProviderService, HealthAggregationService],
  exports: [IntegrationsService, HealthAggregationService, IntegrationMappingModule],
})
export class IntegrationsModule {}
