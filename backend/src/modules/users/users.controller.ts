import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Resource('users') @Action('create')
  @ApiOperation({ summary: 'Create new user' })
  create(@Body() createUserDto: CreateUserDto, @Request() req) {
    return this.usersService.create({
      ...createUserDto,
      tenantId: req.user.tenantId,
    });
  }

  @Get()
  @Resource('users') @Action('read')
  @ApiOperation({ summary: 'Get all users' })
  findAll(@Request() req) {
    return this.usersService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @Resource('users') @Action('read')
  @ApiOperation({ summary: 'Get user by id' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.usersService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Resource('users') @Action('update')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    return this.usersService.update(id, req.user.tenantId, updateUserDto);
  }

  @Delete(':id')
  @Resource('users') @Action('delete')
  @ApiOperation({ summary: 'Delete user' })
  remove(@Param('id') id: string, @Request() req) {
    return this.usersService.remove(id, req.user.tenantId);
  }
}
