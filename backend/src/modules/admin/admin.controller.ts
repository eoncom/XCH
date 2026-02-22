import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateEnumLabelDto } from './dto/update-enum-label.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('enum-labels')
  @Resource('tenants')
  @Action('read')
  @ApiOperation({ summary: 'Get enum labels (custom + defaults)' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by enum type (AssetType, AssetStatus, PinType)' })
  async getEnumLabels(
    @Request() req: AuthRequest,
    @Query('type') enumType?: string,
  ) {
    return this.adminService.getEnumLabels(req.user.tenantId, enumType);
  }

  @Put('enum-labels')
  @Resource('tenants')
  @Action('update')
  @ApiOperation({ summary: 'Update or create a custom enum label (ADMIN only)' })
  async updateEnumLabel(
    @Request() req: AuthRequest,
    @Body() dto: UpdateEnumLabelDto,
  ) {
    return this.adminService.updateEnumLabel(req.user.tenantId, dto);
  }

  @Post('enum-labels/reset')
  @Resource('tenants')
  @Action('update')
  @ApiOperation({ summary: 'Reset enum labels to defaults (ADMIN only)' })
  @ApiQuery({ name: 'type', required: false, description: 'Reset only this enum type' })
  async resetEnumLabels(
    @Request() req: AuthRequest,
    @Query('type') enumType?: string,
  ) {
    return this.adminService.resetEnumLabels(req.user.tenantId, enumType);
  }

  @Get('enum-labels/defaults')
  @Resource('tenants')
  @Action('read')
  @ApiOperation({ summary: 'Get default enum labels (no customization)' })
  @ApiQuery({ name: 'type', required: false })
  async getDefaults(@Query('type') enumType?: string) {
    return this.adminService.getDefaults(enumType);
  }
}
