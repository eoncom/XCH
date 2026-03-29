import { Module } from '@nestjs/common';
import { UserScopesService } from './user-scopes.service';
import { UserScopesController } from './user-scopes.controller';

@Module({
  controllers: [UserScopesController],
  providers: [UserScopesService],
  exports: [UserScopesService],
})
export class UserScopesModule {}
