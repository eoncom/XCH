import { Module } from '@nestjs/common';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { StorageService } from '../../common/services/storage.service';

@Module({
  controllers: [SitesController],
  providers: [SitesService, StorageService],
  exports: [SitesService],
})
export class SitesModule {}
