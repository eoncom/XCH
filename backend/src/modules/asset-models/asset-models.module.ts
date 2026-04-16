import { Module } from '@nestjs/common';
import { AssetModelsService } from './asset-models.service';
import { AssetModelsController } from './asset-models.controller';

@Module({
  controllers: [AssetModelsController],
  providers: [AssetModelsService],
  exports: [AssetModelsService],
})
export class AssetModelsModule {}
