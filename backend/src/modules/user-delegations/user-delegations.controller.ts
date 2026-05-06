import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { UserDelegationsService } from './user-delegations.service';
import { CreateUserDelegationDto, UpdateUserDelegationRightDto } from './dto/create-user-delegation.dto';
import { UserDelegationResponseDto } from './dto/user-delegation.response.dto';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireManage, RequireRead } from '../../common/decorators/require-right.decorator';
import { DelegationRight } from '@prisma/client';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';

@ApiTags('user-delegations')
@ApiBearerAuth()
@Controller('user-delegations')
@UseGuards(JwtAuthGuard)
export class UserDelegationsController {
  constructor(private readonly service: UserDelegationsService) {}

  /**
   * Add a user to a delegation with a role.
   * Only ADMIN of the delegation (or super admin) can do this.
   */
  @Post()
  @RequireManage()
  @ApiOperation({ summary: 'Add a user to a delegation with a role' })
  @ApiCreatedResponse({ type: UserDelegationResponseDto })
  async create(@Body() dto: CreateUserDelegationDto, @Req() req: any): Promise<UserDelegationResponseDto> {
    const created = await this.service.addUserToDelegation(
      req.user.tenantId,
      dto.userId,
      dto.delegationId,
      dto.right as DelegationRight,
      req.user.userId,
      req.user.userId, // requestingUserId for authorization
    );
    return toResponse(UserDelegationResponseDto, created);
  }

  /**
   * Get all delegations for a specific user.
   */
  @Get('user/:userId')
  @RequireRead()
  @ApiOperation({ summary: 'Get all delegations for a specific user' })
  @ApiOkResponse({ type: [UserDelegationResponseDto] })
  async findByUser(@Param('userId') userId: string, @Req() req: any): Promise<UserDelegationResponseDto[]> {
    const rows = await this.service.getUserDelegations(userId, req.user.tenantId);
    return toResponseArray(UserDelegationResponseDto, rows);
  }

  /**
   * Get all users in a specific delegation.
   */
  @Get('delegation/:delegationId')
  @RequireRead()
  @ApiOperation({ summary: 'Get all users in a specific delegation' })
  @ApiOkResponse({ type: [UserDelegationResponseDto] })
  async findByDelegation(@Param('delegationId') delegationId: string, @Req() req: any): Promise<UserDelegationResponseDto[]> {
    const rows = await this.service.findByDelegation(delegationId, req.user.tenantId);
    return toResponseArray(UserDelegationResponseDto, rows);
  }

  /**
   * Get current user's accessible delegations (for delegation switcher).
   */
  @Get('mine')
  @SkipDelegation()
  @ApiOperation({ summary: "Get the current user's accessible delegations (for delegation switcher)" })
  @ApiOkResponse({ type: [UserDelegationResponseDto] })
  async getMyDelegations(@Req() req: any): Promise<UserDelegationResponseDto[]> {
    const rows = await this.service.getMyDelegations(req.user.userId, req.user.tenantId);
    return toResponseArray(UserDelegationResponseDto, rows);
  }

  /**
   * Change a user's role within a delegation.
   * Only ADMIN of the delegation (or super admin) can do this.
   * Cannot change own role. Cannot promote to ADMIN unless you are ADMIN/super admin.
   */
  @Patch(':userId/:delegationId')
  @RequireManage()
  @ApiOperation({ summary: "Change a user's role within a delegation" })
  @ApiOkResponse({ type: UserDelegationResponseDto })
  async setRole(
    @Param('userId') userId: string,
    @Param('delegationId') delegationId: string,
    @Body() dto: UpdateUserDelegationRightDto,
    @Req() req: any,
  ): Promise<UserDelegationResponseDto> {
    const updated = await this.service.setRole(
      userId,
      delegationId,
      dto.right as DelegationRight,
      req.user.userId,
      req.user.tenantId,
    );
    return toResponse(UserDelegationResponseDto, updated);
  }

  /**
   * Remove a user from a delegation (R6 — local deletion only).
   * Only ADMIN of the delegation (or super admin) can do this.
   */
  @Delete(':userId/:delegationId')
  @RequireManage()
  @ApiOperation({ summary: 'Remove a user from a delegation (local deletion only)' })
  @ApiOkResponse({ type: UserDelegationResponseDto, description: 'Returns the deleted UserDelegation row' })
  async remove(
    @Param('userId') userId: string,
    @Param('delegationId') delegationId: string,
    @Req() req: any,
  ): Promise<UserDelegationResponseDto> {
    const removed = await this.service.removeUserFromDelegation(
      userId,
      delegationId,
      req.user.userId,
      req.user.tenantId,
    );
    return toResponse(UserDelegationResponseDto, removed);
  }
}
