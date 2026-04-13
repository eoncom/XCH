import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AccessOverridesService } from './access-overrides.service';
import { CreateAccessOverrideDto, UpdateAccessOverrideDto } from './dto/access-override.dto';
import { RequireManage } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('access-overrides')
@Controller('access-overrides')
@ApiBearerAuth()
export class AccessOverridesController {
  constructor(private readonly service: AccessOverridesService) {}

  @Post()
  @RequireManage()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an access override for a user on a site' })
  @ApiResponse({ status: 201, description: 'Override created' })
  @ApiResponse({ status: 409, description: 'Override already exists for this combination' })
  async create(@Body() dto: CreateAccessOverrideDto, @Request() req: AuthRequest) {
    return this.service.create(req.user.tenantId, dto, req.user.id);
  }

  @Get('by-user/:userId')
  @RequireManage()
  @ApiOperation({ summary: 'List all overrides for a user' })
  async findByUser(@Param('userId') userId: string, @Request() req: AuthRequest) {
    return this.service.findByUser(req.user.tenantId, userId);
  }

  @Get('by-site/:siteId')
  @RequireManage()
  @ApiOperation({ summary: 'List all overrides for a site' })
  async findBySite(@Param('siteId') siteId: string, @Request() req: AuthRequest) {
    return this.service.findBySite(req.user.tenantId, siteId);
  }

  @Get(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Get a specific override' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Update an access override' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccessOverrideDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequireManage()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an access override' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.remove(req.user.tenantId, id);
  }
}
