import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { QRCodeService } from '../../common/services/qrcode.service';
import { StorageService } from '../../common/services/storage.service';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, QRCodeService, StorageService],
  exports: [AssetsService],
})
export class AssetsModule {}
