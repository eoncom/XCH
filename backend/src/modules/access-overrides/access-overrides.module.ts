import { Module } from '@nestjs/common';
import { AccessOverridesController } from './access-overrides.controller';
import { AccessOverridesService } from './access-overrides.service';

@Module({
  controllers: [AccessOverridesController],
  providers: [AccessOverridesService],
  exports: [AccessOverridesService],
})
export class AccessOverridesModule {}
