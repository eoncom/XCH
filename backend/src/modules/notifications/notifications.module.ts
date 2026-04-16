import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationConfigService } from './notification-config.service';
import { NotificationController } from './notification.controller';
import { EmailChannel } from './channels/email.channel';
import { TeamsChannel } from './channels/teams.channel';
import { NotificationEmitter } from './notification-emitter';
import { UserNotificationService } from './user-notification.service';
import { UserNotificationController } from './user-notification.controller';

/**
 * Global module — NotificationService can be injected anywhere
 * without importing NotificationsModule explicitly.
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [NotificationController, UserNotificationController],
  providers: [
    NotificationService,
    NotificationConfigService,
    NotificationEmitter,
    EmailChannel,
    TeamsChannel,
    UserNotificationService,
  ],
  exports: [
    NotificationService,
    NotificationConfigService,
    NotificationEmitter,
    UserNotificationService,
  ],
})
export class NotificationsModule {}
