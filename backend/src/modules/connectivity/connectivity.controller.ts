import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConnectivityService } from './connectivity.service';
import {
  CreateConnectivityLinkDto,
  UpdateConnectivityLinkDto,
  FilterConnectivityLinkDto,
} from './dto/create-connectivity-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead, RequireManage } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('connectivity')
@Controller('connectivity')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConnectivityController {
  constructor(private readonly service: ConnectivityService) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create a connectivity link' })
  create(@Body() dto: CreateConnectivityLinkDto, @Request() req: AuthRequest) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'List connectivity links (filter by siteId/role/type)' })
  findAll(@Query() filters: FilterConnectivityLinkDto, @Request() req: AuthRequest) {
    return this.service.findAll(req.user.tenantId, filters);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a connectivity link' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a connectivity link' })
  update(@Param('id') id: string, @Body() dto: UpdateConnectivityLinkDto, @Request() req: AuthRequest) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete a connectivity link' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.remove(req.user.tenantId, id);
  }

  @Post(':id/generate-expense')
  @RequireWrite()
  @ApiOperation({ summary: 'Generate a recurring MONTHLY expense from this connectivity link' })
  generateExpense(
    @Param('id') id: string,
    @Body() body: { bearerId: string; label?: string },
    @Request() req: AuthRequest,
  ) {
    return this.service.generateExpense(req.user.tenantId, id, body, req.user.id);
  }
}
