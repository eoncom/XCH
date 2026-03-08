import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { MonitoringWebhookController } from './controllers/monitoring-webhook.controller';
import { MonitoringWebhookService } from './services/monitoring-webhook.service';
import { DatabaseModule } from '../../config/database.module';
import { NetBoxProviderService } from './providers/netbox.provider';
import { UptimeKumaProviderService } from './providers/uptime-kuma.provider';
import { GatusProviderService } from './providers/gatus.provider';
import { MonitoringProviderFactory } from './providers/monitoring-provider.factory';
import { HealthAggregationService } from './health-aggregation.service';
import { HealthSyncScheduler } from './health-sync.scheduler';
import { IntegrationMappingModule } from './mapping/integration-mapping.module';

@Module({
  imports: [DatabaseModule, IntegrationMappingModule],
  controllers: [IntegrationsController, MonitoringWebhookController],
  providers: [
    IntegrationsService,
    MonitoringWebhookService,
    NetBoxProviderService,
    UptimeKumaProviderService,
    GatusProviderService,
    MonitoringProviderFactory,
    HealthAggregationService,
    HealthSyncScheduler,
  ],
  exports: [IntegrationsService, HealthAggregationService, MonitoringProviderFactory, IntegrationMappingModule],
})
export class IntegrationsModule {}
