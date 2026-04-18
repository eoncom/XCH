import { Module } from '@nestjs/common';
import { AssetModelsService } from './asset-models.service';
import { AssetModelsController } from './asset-models.controller';
import { VendorTemplatesService } from './vendor-templates.service';

@Module({
  controllers: [AssetModelsController],
  providers: [AssetModelsService, VendorTemplatesService],
  exports: [AssetModelsService],
})
export class AssetModelsModule {}
