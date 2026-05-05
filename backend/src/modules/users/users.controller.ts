import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Put, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserAppearanceDto } from '../tenants/dto/appearance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { RequireManage, RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';
import { toResponse } from '../../common/utils/to-response.util';
import { UserResponseDto } from './dto/user.response.dto';
import { UserListResponseDto } from './dto/user-list.response.dto';
import { UserProfileResponseDto } from './dto/user-profile.response.dto';
import { UserAppearanceResponseDto } from './dto/user-appearance.response.dto';
import { UserEffectiveAppearanceResponseDto } from './dto/user-effective-appearance.response.dto';
import {
  UserDeletedResultResponseDto,
  UserPasswordChangedResultResponseDto,
  UserToggleSuperAdminResultResponseDto,
} from './dto/user-action-result.response.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @RequireManage()
  @ApiOperation({ summary: 'Create new user' })
  @ApiCreatedResponse({ type: UserResponseDto })
  async create(
    @Body() createUserDto: CreateUserDto,
    @Request() req: AuthRequest,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.create({
      ...createUserDto,
      tenantId: req.user.tenantId,
    });
    return toResponse(UserResponseDto, user);
  }

  @Get()
  @RequireManage()
  @ApiOperation({
    summary:
      "List users — scoped to caller's MANAGE delegations (union of all delegations where caller has MANAGE). Super admin sees everyone.",
  })
  @ApiOkResponse({ type: UserListResponseDto })
  async findAll(
    @Query() filters: FilterUserDto,
    @Request() req: AuthRequest,
  ): Promise<UserListResponseDto> {
    const page = await this.usersService.findAll(
      req.user.tenantId,
      filters,
      req.user.isSuperAdmin ? null : req.user.userId,
    );
    return toResponse(UserListResponseDto, page);
  }

  @Get(':id')
  @RequireManage()
  @ApiOperation({
    summary:
      "Get a user — must share at least one delegation where the caller has MANAGE (super admin bypass).",
  })
  @ApiOkResponse({ type: UserResponseDto })
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findOne(
      id,
      req.user.tenantId,
      req.user.isSuperAdmin ? null : req.user.userId,
    );
    return toResponse(UserResponseDto, user);
  }

  @Patch(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Update user' })
  @ApiOkResponse({ type: UserResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: AuthRequest,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(
      id,
      req.user.tenantId,
      updateUserDto,
      req.user.userId,
      req.user.isSuperAdmin ? null : req.delegationId,
      req.localRole,
    );
    return toResponse(UserResponseDto, user);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete user' })
  @ApiOkResponse({ type: UserDeletedResultResponseDto })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<UserDeletedResultResponseDto> {
    return this.usersService.remove(
      id,
      req.user.tenantId,
      req.user.userId,
      req.user.isSuperAdmin ? null : req.delegationId,
      req.localRole,
    );
  }

  @Post(':id/toggle-super-admin')
  @SkipDelegation()
  @RequireManage()
  @ApiOperation({ summary: 'Promote or demote a user as super admin' })
  @ApiOkResponse({ type: UserToggleSuperAdminResultResponseDto })
  async toggleSuperAdmin(
    @Param('id') id: string,
    @Body() body: { promote: boolean },
    @Request() req: AuthRequest,
  ): Promise<UserToggleSuperAdminResultResponseDto> {
    const result = await this.usersService.toggleSuperAdmin(id, req.user.tenantId, req.user.userId, body.promote);
    return toResponse(UserToggleSuperAdminResultResponseDto, result);
  }

  // Settings endpoints - accessible to all authenticated users (no delegation required)
  @Get('me/profile')
  @SkipDelegation()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: UserProfileResponseDto })
  async getProfile(@Request() req: AuthRequest): Promise<UserProfileResponseDto> {
    const profile = await this.usersService.getProfile(req.user.userId, req.user.tenantId);
    return toResponse(UserProfileResponseDto, profile);
  }

  @Put('me/profile')
  @SkipDelegation()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ type: UserProfileResponseDto })
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req: AuthRequest,
  ): Promise<UserProfileResponseDto> {
    const profile = await this.usersService.updateProfile(req.user.userId, req.user.tenantId, updateProfileDto);
    return toResponse(UserProfileResponseDto, profile);
  }

  @Post('me/change-password')
  @SkipDelegation()
  @ApiOperation({ summary: 'Change current user password' })
  @ApiOkResponse({ type: UserPasswordChangedResultResponseDto })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() req: AuthRequest,
  ): Promise<UserPasswordChangedResultResponseDto> {
    return this.usersService.changePassword(req.user.userId, req.user.tenantId, changePasswordDto);
  }

  // ============================================================================
  // APPEARANCE (v1.4 — ADR-010)
  // ============================================================================

  @Get('me/appearance')
  @SkipDelegation()
  @ApiOperation({ summary: 'Get current user raw appearance preference (inherit or custom)' })
  @ApiOkResponse({ type: UserAppearanceResponseDto })
  async getMyAppearance(@Request() req: AuthRequest): Promise<UserAppearanceResponseDto> {
    const app = await this.usersService.getMyAppearance(req.user.userId, req.user.tenantId);
    return toResponse(UserAppearanceResponseDto, app);
  }

  @Patch('me/appearance')
  @SkipDelegation()
  @ApiOperation({ summary: 'Update current user appearance preference' })
  @ApiOkResponse({ type: UserEffectiveAppearanceResponseDto })
  async updateMyAppearance(
    @Body() dto: UpdateUserAppearanceDto,
    @Request() req: AuthRequest,
  ): Promise<UserEffectiveAppearanceResponseDto> {
    const eff = await this.usersService.updateMyAppearance(req.user.userId, req.user.tenantId, dto);
    return toResponse(UserEffectiveAppearanceResponseDto, eff);
  }

  @Get('me/effective-appearance')
  @SkipDelegation()
  @ApiOperation({ summary: 'Get effective appearance (tenant defaults merged with user override)' })
  @ApiOkResponse({ type: UserEffectiveAppearanceResponseDto })
  async getEffectiveAppearance(@Request() req: AuthRequest): Promise<UserEffectiveAppearanceResponseDto> {
    const eff = await this.usersService.getEffectiveAppearance(req.user.userId, req.user.tenantId);
    return toResponse(UserEffectiveAppearanceResponseDto, eff);
  }
}
