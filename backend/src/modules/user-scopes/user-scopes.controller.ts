import { Controller, Get, Post, Put, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserScopesService } from './user-scopes.service';
import { CreateUserScopeDto, BulkSetUserScopesDto } from './dto/create-user-scope.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('user-scopes')
@Controller('user-scopes')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class UserScopesController {
  constructor(private readonly userScopesService: UserScopesService) {}

  @Post()
  @Resource('users') @Action('update')
  @ApiOperation({ summary: 'Add a scope to a user' })
  create(@Body() dto: CreateUserScopeDto, @Request() req: AuthRequest) {
    return this.userScopesService.create(req.user.tenantId, dto, req.user.userId);
  }

  @Get('user/:userId')
  @Resource('users') @Action('read')
  @ApiOperation({ summary: 'List all scopes for a user' })
  findByUser(@Param('userId') userId: string, @Request() req: AuthRequest) {
    return this.userScopesService.findByUser(req.user.tenantId, userId);
  }

  @Put('user/:userId')
  @Resource('users') @Action('update')
  @ApiOperation({ summary: 'Replace all scopes for a user (bulk set)' })
  bulkSet(@Param('userId') userId: string, @Body() dto: BulkSetUserScopesDto, @Request() req: AuthRequest) {
    dto.userId = userId;
    return this.userScopesService.bulkSet(req.user.tenantId, dto, req.user.userId);
  }

  @Delete(':id')
  @Resource('users') @Action('update')
  @ApiOperation({ summary: 'Remove a specific scope' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.userScopesService.remove(req.user.tenantId, id);
  }
}
