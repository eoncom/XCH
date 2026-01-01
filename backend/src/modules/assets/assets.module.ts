import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { QRCodeService } from '../../common/services/qrcode.service';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, QRCodeService],
  exports: [AssetsService],
})
export class AssetsModule {}
