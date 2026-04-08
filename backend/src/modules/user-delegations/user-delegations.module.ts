import { Module } from '@nestjs/common';
import { UserDelegationsController } from './user-delegations.controller';
import { UserDelegationsService } from './user-delegations.service';

@Module({
  controllers: [UserDelegationsController],
  providers: [UserDelegationsService],
  exports: [UserDelegationsService],
})
export class UserDelegationsModule {}
