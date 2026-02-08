import { Module, forwardRef } from '@nestjs/common';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { StorageService } from '../../common/services/storage.service';
import { SiteAccessModule } from '../site-access/site-access.module';

@Module({
  imports: [forwardRef(() => SiteAccessModule)],
  controllers: [SitesController],
  providers: [SitesService, StorageService],
  exports: [SitesService],
})
export class SitesModule {}
