import { Module } from '@nestjs/common';
import { RacksService } from './racks.service';
import { RacksController } from './racks.controller';
import { StorageService } from '../../common/services/storage.service';

@Module({
  controllers: [RacksController],
  providers: [RacksService, StorageService],
  exports: [RacksService],
})
export class RacksModule {}
