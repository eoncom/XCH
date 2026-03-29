import { Module } from '@nestjs/common';
import { AccessGrantsService } from './access-grants.service';
import { AccessGrantsController } from './access-grants.controller';

@Module({
  controllers: [AccessGrantsController],
  providers: [AccessGrantsService],
  exports: [AccessGrantsService],
})
export class AccessGrantsModule {}
