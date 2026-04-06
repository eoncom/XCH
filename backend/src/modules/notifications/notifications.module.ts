import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationConfigService } from './notification-config.service';
import { NotificationController } from './notification.controller';
import { EmailChannel } from './channels/email.channel';
import { TeamsChannel } from './channels/teams.channel';
import { NotificationEmitter } from './notification-emitter';

/**
 * Global module — NotificationService can be injected anywhere
 * without importing NotificationsModule explicitly.
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationConfigService,
    NotificationEmitter,
    EmailChannel,
    TeamsChannel,
  ],
  exports: [NotificationService, NotificationConfigService, NotificationEmitter],
})
export class NotificationsModule {}
