import { Module } from '@nestjs/common';
import { IntegrationMappingService } from './integration-mapping.service';
import { IntegrationMappingController } from './integration-mapping.controller';

@Module({
  controllers: [IntegrationMappingController],
  providers: [IntegrationMappingService],
  exports: [IntegrationMappingService],
})
export class IntegrationMappingModule {}
