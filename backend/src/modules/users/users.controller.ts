import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SiteAccessService } from '../site-access/site-access.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly siteAccessService: SiteAccessService,
  ) {}

  @Post()
  @Resource('users') @Action('create')
  @ApiOperation({ summary: 'Create new user' })
  create(@Body() createUserDto: CreateUserDto, @Request() req: AuthRequest) {
    return this.usersService.create({
      ...createUserDto,
      tenantId: req.user.tenantId,
    });
  }

  @Get()
  @Resource('users') @Action('read')
  @ApiOperation({ summary: 'Get all users (filtered by requesting user scope)' })
  async findAll(@Request() req: AuthRequest) {
    const visibleUserIds = await this.siteAccessService.getVisibleUserIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.usersService.findAll(req.user.tenantId, visibleUserIds);
  }

  @Get(':id')
  @Resource('users') @Action('read')
  @ApiOperation({ summary: 'Get user by id' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.usersService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Resource('users') @Action('update')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req: AuthRequest) {
    return this.usersService.update(id, req.user.tenantId, updateUserDto);
  }

  @Delete(':id')
  @Resource('users') @Action('delete')
  @ApiOperation({ summary: 'Delete user' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.usersService.remove(id, req.user.tenantId);
  }

  // Settings endpoints - accessible to all authenticated users
  @Get('me/profile')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req: AuthRequest) {
    return this.usersService.getProfile(req.user.userId, req.user.tenantId);
  }

  @Put('me/profile')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@Body() updateProfileDto: UpdateProfileDto, @Request() req: AuthRequest) {
    return this.usersService.updateProfile(req.user.userId, req.user.tenantId, updateProfileDto);
  }

  @Post('me/change-password')
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(@Body() changePasswordDto: ChangePasswordDto, @Request() req: AuthRequest) {
    return this.usersService.changePassword(req.user.userId, req.user.tenantId, changePasswordDto);
  }
}
