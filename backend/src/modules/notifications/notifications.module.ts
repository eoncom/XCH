import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { NotificationService } from './notification.service';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationController } from './notification.controller';
import { NotificationProcessor, NOTIFICATIONS_QUEUE } from './notification.processor';
import { EmailChannel } from './channels/email.channel';
import { TeamsChannel } from './channels/teams.channel';
import { NotificationEmitter } from './notification-emitter';
import { UserNotificationService } from './user-notification.service';
import { UserNotificationController } from './user-notification.controller';

/**
 * Global module — NotificationService + NotificationEmitter can be injected
 * anywhere without re-importing. Owns the BullMQ queue `notifications` (ADR-020)
 * and the processor that drains it.
 *
 * Imports CryptoModule explicitly even though it is `@Global()`: this guarantees
 * the global activation in any root module that imports NotificationsModule
 * (api / worker / isolated test), independent of import order in AppModule.
 * Cf XCH_NESTJS_GLOBAL_MODULE_TRAP — relying on the root to import @Global
 * modules is fragile across modes.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    CryptoModule,
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  controllers: [NotificationController, UserNotificationController],
  providers: [
    NotificationService,
    NotificationSettingsService,
    NotificationProcessor,
    NotificationEmitter,
    EmailChannel,
    TeamsChannel,
    UserNotificationService,
  ],
  exports: [
    NotificationService,
    NotificationSettingsService,
    NotificationEmitter,
    UserNotificationService,
  ],
})
export class NotificationsModule {}
