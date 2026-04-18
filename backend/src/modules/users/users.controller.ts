import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Put, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  create(@Body() createUserDto: CreateUserDto, @Request() req: AuthRequest) {
    return this.usersService.create({
      ...createUserDto,
      tenantId: req.user.tenantId,
    });
  }

  @Get()
  @RequireManage()
  @ApiOperation({
    summary:
      "List users — scoped to caller's MANAGE delegations (union of all delegations where caller has MANAGE). Super admin sees everyone.",
  })
  async findAll(@Query() filters: FilterUserDto, @Request() req: AuthRequest) {
    return this.usersService.findAll(
      req.user.tenantId,
      filters,
      req.user.isSuperAdmin ? null : req.user.userId,
    );
  }

  @Get(':id')
  @RequireManage()
  @ApiOperation({
    summary:
      "Get a user — must share at least one delegation where the caller has MANAGE (super admin bypass).",
  })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.usersService.findOne(
      id,
      req.user.tenantId,
      req.user.isSuperAdmin ? null : req.user.userId,
    );
  }

  @Patch(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req: AuthRequest) {
    return this.usersService.update(
      id,
      req.user.tenantId,
      updateUserDto,
      req.user.userId,
      req.user.isSuperAdmin ? null : req.delegationId,
      req.localRole,
    );
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete user' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.usersService.remove(
      id,
      req.user.tenantId,
      req.user.userId,
      req.user.isSuperAdmin ? null : req.delegationId,
      req.localRole,
    );
  }

  // Super admin management — only super admins can promote/demote
  @Post(':id/toggle-super-admin')
  @SkipDelegation()
  @RequireManage()
  @ApiOperation({ summary: 'Promote or demote a user as super admin' })
  toggleSuperAdmin(
    @Param('id') id: string,
    @Body() body: { promote: boolean },
    @Request() req: AuthRequest,
  ) {
    return this.usersService.toggleSuperAdmin(id, req.user.tenantId, req.user.userId, body.promote);
  }

  // Settings endpoints - accessible to all authenticated users (no delegation required)
  @Get('me/profile')
  @SkipDelegation()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req: AuthRequest) {
    return this.usersService.getProfile(req.user.userId, req.user.tenantId);
  }

  @Put('me/profile')
  @SkipDelegation()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@Body() updateProfileDto: UpdateProfileDto, @Request() req: AuthRequest) {
    return this.usersService.updateProfile(req.user.userId, req.user.tenantId, updateProfileDto);
  }

  @Post('me/change-password')
  @SkipDelegation()
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(@Body() changePasswordDto: ChangePasswordDto, @Request() req: AuthRequest) {
    return this.usersService.changePassword(req.user.userId, req.user.tenantId, changePasswordDto);
  }

  // ============================================================================
  // APPEARANCE (v1.4 — ADR-010)
  // All three routes are user-scoped (@SkipDelegation) so any authenticated user,
  // regardless of delegation state, can load/save their own appearance preference.
  // ============================================================================

  @Get('me/appearance')
  @SkipDelegation()
  @ApiOperation({ summary: 'Get current user raw appearance preference (inherit or custom)' })
  getMyAppearance(@Request() req: AuthRequest) {
    return this.usersService.getMyAppearance(req.user.userId, req.user.tenantId);
  }

  @Patch('me/appearance')
  @SkipDelegation()
  @ApiOperation({ summary: 'Update current user appearance preference' })
  updateMyAppearance(
    @Body() dto: UpdateUserAppearanceDto,
    @Request() req: AuthRequest,
  ) {
    return this.usersService.updateMyAppearance(req.user.userId, req.user.tenantId, dto);
  }

  @Get('me/effective-appearance')
  @SkipDelegation()
  @ApiOperation({ summary: 'Get effective appearance (tenant defaults merged with user override)' })
  getEffectiveAppearance(@Request() req: AuthRequest) {
    return this.usersService.getEffectiveAppearance(req.user.userId, req.user.tenantId);
  }
}
