import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateEnumLabelDto } from './dto/update-enum-label.dto';
import { CreateEnumValueDto } from './dto/create-enum-value.dto';
import { AuthRequest } from '../../types/request.interface';
import { RequireRead, RequireWrite, RequireManage } from '../../common/decorators/require-right.decorator';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@SkipDelegation()
@RequireManage()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('enum-labels')
  @RequireRead()
  @ApiOperation({ summary: 'Get enum labels (custom + defaults)' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by enum type (AssetType, AssetStatus, PinType)' })
  async getEnumLabels(
    @Request() req: AuthRequest,
    @Query('type') enumType?: string,
  ) {
    return this.adminService.getEnumLabels(req.user.tenantId, enumType);
  }

  @Put('enum-labels')
  @RequireWrite()
  @ApiOperation({ summary: 'Update or create a custom enum label' })
  async updateEnumLabel(
    @Request() req: AuthRequest,
    @Body() dto: UpdateEnumLabelDto,
  ) {
    return this.adminService.updateEnumLabel(req.user.tenantId, dto);
  }

  @Post('enum-labels')
  @RequireWrite()
  @ApiOperation({ summary: 'Create a new custom enum value (e.g., new asset type)' })
  async createEnumValue(
    @Request() req: AuthRequest,
    @Body() dto: CreateEnumValueDto,
  ) {
    return this.adminService.createEnumValue(req.user.tenantId, dto);
  }

  @Delete('enum-labels/:id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete a custom enum value (refuses if built-in or in use)' })
  async deleteEnumValue(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteEnumValue(req.user.tenantId, id);
  }

  @Post('enum-labels/reset')
  @RequireWrite()
  @ApiOperation({ summary: 'Reset enum labels to defaults' })
  @ApiQuery({ name: 'type', required: false, description: 'Reset only this enum type' })
  async resetEnumLabels(
    @Request() req: AuthRequest,
    @Query('type') enumType?: string,
  ) {
    return this.adminService.resetEnumLabels(req.user.tenantId, enumType);
  }

  @Get('enum-labels/defaults')
  @RequireRead()
  @ApiOperation({ summary: 'Get default enum labels (no customization)' })
  @ApiQuery({ name: 'type', required: false })
  async getDefaults(@Query('type') enumType?: string) {
    return this.adminService.getDefaults(enumType);
  }
}
