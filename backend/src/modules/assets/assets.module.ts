import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { QRCodeService } from '../../common/services/qrcode.service';
import { StorageService } from '../../common/services/storage.service';
import { SiteAccessModule } from '../site-access/site-access.module';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
    SiteAccessModule,
  ],
  controllers: [AssetsController],
  providers: [AssetsService, QRCodeService, StorageService],
  exports: [AssetsService],
})
export class AssetsModule {}
