import { Controller, Get, Post, Patch, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccessGrantsService } from './access-grants.service';
import { CreateAccessGrantDto, UpdateAccessGrantDto } from './dto/create-access-grant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('access-grants')
@Controller('access-grants')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class AccessGrantsController {
  constructor(private readonly accessGrantsService: AccessGrantsService) {}

  @Post()
  @Resource('users') @Action('update')
  @ApiOperation({ summary: 'Create an access grant for a user' })
  create(@Body() dto: CreateAccessGrantDto, @Request() req: AuthRequest) {
    return this.accessGrantsService.create(req.user.tenantId, dto, req.user.userId);
  }

  @Get('user/:userId')
  @Resource('users') @Action('read')
  @ApiOperation({ summary: 'List all access grants for a user' })
  findByUser(@Param('userId') userId: string, @Request() req: AuthRequest) {
    return this.accessGrantsService.findByUser(req.user.tenantId, userId);
  }

  @Patch(':id')
  @Resource('users') @Action('update')
  @ApiOperation({ summary: 'Update an access grant' })
  update(@Param('id') id: string, @Body() dto: UpdateAccessGrantDto, @Request() req: AuthRequest) {
    return this.accessGrantsService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Resource('users') @Action('update')
  @ApiOperation({ summary: 'Delete an access grant' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.accessGrantsService.remove(req.user.tenantId, id);
  }
}
