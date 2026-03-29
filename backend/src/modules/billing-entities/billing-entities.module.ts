import { Module } from '@nestjs/common';
import { BillingEntitiesService } from './billing-entities.service';
import { BillingEntitiesController } from './billing-entities.controller';

@Module({
  controllers: [BillingEntitiesController],
  providers: [BillingEntitiesService],
  exports: [BillingEntitiesService],
})
export class BillingEntitiesModule {}
