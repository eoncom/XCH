import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ProvidersLegacyController } from './providers-legacy.controller';
import { ContactsService } from './contacts.service';

@Module({
  controllers: [ContactsController, ProvidersLegacyController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
