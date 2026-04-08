import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { UserDelegationsService } from './user-delegations.service';
import { CreateUserDelegationDto, UpdateUserDelegationRoleDto } from './dto/create-user-delegation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { UserRole } from '@prisma/client';

@Controller('user-delegations')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class UserDelegationsController {
  constructor(private readonly service: UserDelegationsService) {}

  /**
   * Add a user to a delegation with a role.
   * Used by delegation admin to add users to their delegation.
   */
  @Post()
  async create(@Body() dto: CreateUserDelegationDto, @Req() req: any) {
    return this.service.addUserToDelegation(
      req.user.tenantId,
      dto.userId,
      dto.delegationId,
      dto.role as UserRole,
      req.user.id,
    );
  }

  /**
   * Get all delegations for a specific user.
   */
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string, @Req() req: any) {
    return this.service.getUserDelegations(userId, req.user.tenantId);
  }

  /**
   * Get all users in a specific delegation.
   */
  @Get('delegation/:delegationId')
  async findByDelegation(@Param('delegationId') delegationId: string, @Req() req: any) {
    return this.service.findByDelegation(delegationId, req.user.tenantId);
  }

  /**
   * Get current user's accessible delegations (for delegation switcher).
   */
  @Get('mine')
  async getMyDelegations(@Req() req: any) {
    return this.service.getMyDelegations(req.user.id, req.user.tenantId);
  }

  /**
   * Change a user's role within a delegation.
   */
  @Patch(':userId/:delegationId')
  async setRole(
    @Param('userId') userId: string,
    @Param('delegationId') delegationId: string,
    @Body() dto: UpdateUserDelegationRoleDto,
  ) {
    return this.service.setRole(userId, delegationId, dto.role as UserRole);
  }

  /**
   * Remove a user from a delegation (R6 — local deletion only).
   */
  @Delete(':userId/:delegationId')
  async remove(
    @Param('userId') userId: string,
    @Param('delegationId') delegationId: string,
  ) {
    return this.service.removeUserFromDelegation(userId, delegationId);
  }
}
