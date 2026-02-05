import { Module } from '@nestjs/common';
import { ContactTypesController } from './contact-types.controller';
import { ContactTypesService } from './contact-types.service';

@Module({
  controllers: [ContactTypesController],
  providers: [ContactTypesService],
  exports: [ContactTypesService],
})
export class ContactTypesModule {}
