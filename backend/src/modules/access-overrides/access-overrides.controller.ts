import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { AccessOverridesService } from './access-overrides.service';
import { CreateAccessOverrideDto, UpdateAccessOverrideDto } from './dto/access-override.dto';
import {
  AccessOverrideResponseDto,
  AccessOverrideRemovedResultResponseDto,
} from './dto/access-override.response.dto';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
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
  @ApiCreatedResponse({ type: AccessOverrideResponseDto, description: 'Override created' })
  async create(@Body() dto: CreateAccessOverrideDto, @Request() req: AuthRequest): Promise<AccessOverrideResponseDto> {
    const created = await this.service.create(req.user.tenantId, dto, req.user.id);
    return toResponse(AccessOverrideResponseDto, created);
  }

  @Get('by-user/:userId')
  @RequireManage()
  @ApiOperation({ summary: 'List all overrides for a user' })
  @ApiOkResponse({ type: [AccessOverrideResponseDto], description: 'Overrides granted to the user' })
  async findByUser(@Param('userId') userId: string, @Request() req: AuthRequest): Promise<AccessOverrideResponseDto[]> {
    const rows = await this.service.findByUser(req.user.tenantId, userId);
    return toResponseArray(AccessOverrideResponseDto, rows);
  }

  @Get('by-site/:siteId')
  @RequireManage()
  @ApiOperation({ summary: 'List all overrides for a site' })
  @ApiOkResponse({ type: [AccessOverrideResponseDto], description: 'Overrides granted on the site' })
  async findBySite(@Param('siteId') siteId: string, @Request() req: AuthRequest): Promise<AccessOverrideResponseDto[]> {
    const rows = await this.service.findBySite(req.user.tenantId, siteId);
    return toResponseArray(AccessOverrideResponseDto, rows);
  }

  @Get(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Get a specific override' })
  @ApiOkResponse({ type: AccessOverrideResponseDto })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest): Promise<AccessOverrideResponseDto> {
    const row = await this.service.findOne(req.user.tenantId, id);
    return toResponse(AccessOverrideResponseDto, row);
  }

  @Patch(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Update an access override' })
  @ApiOkResponse({ type: AccessOverrideResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccessOverrideDto,
    @Request() req: AuthRequest,
  ): Promise<AccessOverrideResponseDto> {
    const updated = await this.service.update(req.user.tenantId, id, dto);
    return toResponse(AccessOverrideResponseDto, updated);
  }

  @Delete(':id')
  @RequireManage()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an access override' })
  @ApiOkResponse({ type: AccessOverrideRemovedResultResponseDto })
  async remove(@Param('id') id: string, @Request() req: AuthRequest): Promise<AccessOverrideRemovedResultResponseDto> {
    const result = await this.service.remove(req.user.tenantId, id);
    return toResponse(AccessOverrideRemovedResultResponseDto, result);
  }
}
