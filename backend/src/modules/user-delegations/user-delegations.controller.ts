import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { UserDelegationsService } from './user-delegations.service';
import { CreateUserDelegationDto, UpdateUserDelegationRightDto } from './dto/create-user-delegation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { DelegationRight } from '@prisma/client';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';

@Controller('user-delegations')
@UseGuards(JwtAuthGuard)
export class UserDelegationsController {
  constructor(private readonly service: UserDelegationsService) {}

  /**
   * Add a user to a delegation with a role.
   * Only ADMIN of the delegation (or super admin) can do this.
   */
  @Post()
  @RequireWrite()
  async create(@Body() dto: CreateUserDelegationDto, @Req() req: any) {
    return this.service.addUserToDelegation(
      req.user.tenantId,
      dto.userId,
      dto.delegationId,
      dto.right as DelegationRight,
      req.user.userId,
      req.user.userId, // requestingUserId for authorization
    );
  }

  /**
   * Get all delegations for a specific user.
   */
  @Get('user/:userId')
  @RequireRead()
  async findByUser(@Param('userId') userId: string, @Req() req: any) {
    return this.service.getUserDelegations(userId, req.user.tenantId);
  }

  /**
   * Get all users in a specific delegation.
   */
  @Get('delegation/:delegationId')
  @RequireRead()
  async findByDelegation(@Param('delegationId') delegationId: string, @Req() req: any) {
    return this.service.findByDelegation(delegationId, req.user.tenantId);
  }

  /**
   * Get current user's accessible delegations (for delegation switcher).
   */
  @Get('mine')
  @SkipDelegation()
  async getMyDelegations(@Req() req: any) {
    return this.service.getMyDelegations(req.user.userId, req.user.tenantId);
  }

  /**
   * Change a user's role within a delegation.
   * Only ADMIN of the delegation (or super admin) can do this.
   * Cannot change own role. Cannot promote to ADMIN unless you are ADMIN/super admin.
   */
  @Patch(':userId/:delegationId')
  @RequireWrite()
  async setRole(
    @Param('userId') userId: string,
    @Param('delegationId') delegationId: string,
    @Body() dto: UpdateUserDelegationRightDto,
    @Req() req: any,
  ) {
    return this.service.setRole(
      userId,
      delegationId,
      dto.right as DelegationRight,
      req.user.userId,
      req.user.tenantId,
    );
  }

  /**
   * Remove a user from a delegation (R6 — local deletion only).
   * Only ADMIN of the delegation (or super admin) can do this.
   */
  @Delete(':userId/:delegationId')
  @RequireWrite()
  async remove(
    @Param('userId') userId: string,
    @Param('delegationId') delegationId: string,
    @Req() req: any,
  ) {
    return this.service.removeUserFromDelegation(
      userId,
      delegationId,
      req.user.userId,
      req.user.tenantId,
    );
  }
}
