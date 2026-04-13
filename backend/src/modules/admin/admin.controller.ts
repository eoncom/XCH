import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateEnumLabelDto } from './dto/update-enum-label.dto';
import { AuthRequest } from '../../types/request.interface';
import { RequireRead, RequireWrite } from '../../common/decorators/require-right.decorator';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { RequireManage } from '../../common/decorators/require-right.decorator';

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
  @ApiOperation({ summary: 'Update or create a custom enum label (ADMIN only)' })
  async updateEnumLabel(
    @Request() req: AuthRequest,
    @Body() dto: UpdateEnumLabelDto,
  ) {
    return this.adminService.updateEnumLabel(req.user.tenantId, dto);
  }

  @Post('enum-labels/reset')
  @RequireWrite()
  @ApiOperation({ summary: 'Reset enum labels to defaults (ADMIN only)' })
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
