import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { DatabaseModule } from '../../config/database.module';
import { NetBoxProviderService } from './providers/netbox.provider';
import { UptimeKumaProviderService } from './providers/uptime-kuma.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, NetBoxProviderService, UptimeKumaProviderService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
