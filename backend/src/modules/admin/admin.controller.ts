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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateEnumLabelDto } from './dto/update-enum-label.dto';
import { CreateEnumValueDto } from './dto/create-enum-value.dto';
import {
  EnumLabelMapResponseDto,
  EnumLabelRowResponseDto,
  EnumLabelDeletedResultResponseDto,
  EnumLabelResetResultResponseDto,
  toEnumLabelMapResponseDto,
  toEnumLabelDefaultsMapResponseDto,
} from './dto/enum-label.response.dto';
import { toResponse } from '../../common/utils/to-response.util';
import { AuthRequest } from '../../types/request.interface';
import { RequireRead, RequireWrite, RequireManage } from '../../common/decorators/require-right.decorator';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
/**
 * @SkipDelegation — Catégorie 1 (tenant-wide super-admin) :
 * gestion enum labels = scope organisation, pas une délégation spécifique.
 * Cf. ADR-028.
 */
@SkipDelegation()
@RequireManage()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('enum-labels')
  @RequireRead()
  @ApiOperation({ summary: 'Get enum labels (custom + defaults)' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by enum type (AssetType, AssetStatus, PinType)' })
  @ApiOkResponse({ type: EnumLabelMapResponseDto, description: 'Per-type arrays of label items (Record manually mapped — Cas B)' })
  async getEnumLabels(
    @Request() req: AuthRequest,
    @Query('type') enumType?: string,
  ): Promise<EnumLabelMapResponseDto> {
    const result = await this.adminService.getEnumLabels(req.user.tenantId, enumType);
    return toEnumLabelMapResponseDto(result as Record<string, unknown[]>);
  }

  @Put('enum-labels')
  @RequireWrite()
  @ApiOperation({ summary: 'Update or create a custom enum label' })
  @ApiOkResponse({ type: EnumLabelRowResponseDto, description: 'Updated/created EnumLabel row' })
  async updateEnumLabel(
    @Request() req: AuthRequest,
    @Body() dto: UpdateEnumLabelDto,
  ): Promise<EnumLabelRowResponseDto> {
    const row = await this.adminService.updateEnumLabel(req.user.tenantId, dto);
    return toResponse(EnumLabelRowResponseDto, row);
  }

  @Post('enum-labels')
  @RequireWrite()
  @ApiOperation({ summary: 'Create a new custom enum value (e.g., new asset type)' })
  @ApiCreatedResponse({ type: EnumLabelRowResponseDto, description: 'Created EnumLabel row' })
  async createEnumValue(
    @Request() req: AuthRequest,
    @Body() dto: CreateEnumValueDto,
  ): Promise<EnumLabelRowResponseDto> {
    const row = await this.adminService.createEnumValue(req.user.tenantId, dto);
    return toResponse(EnumLabelRowResponseDto, row);
  }

  @Delete('enum-labels/:id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete a custom enum value (refuses if built-in or in use)' })
  @ApiOkResponse({ type: EnumLabelDeletedResultResponseDto })
  async deleteEnumValue(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<EnumLabelDeletedResultResponseDto> {
    const result = await this.adminService.deleteEnumValue(req.user.tenantId, id);
    return toResponse(EnumLabelDeletedResultResponseDto, result);
  }

  @Post('enum-labels/reset')
  @RequireWrite()
  @ApiOperation({ summary: 'Reset enum labels to defaults' })
  @ApiQuery({ name: 'type', required: false, description: 'Reset only this enum type' })
  @ApiOkResponse({ type: EnumLabelResetResultResponseDto })
  async resetEnumLabels(
    @Request() req: AuthRequest,
    @Query('type') enumType?: string,
  ): Promise<EnumLabelResetResultResponseDto> {
    const result = await this.adminService.resetEnumLabels(req.user.tenantId, enumType);
    return toResponse(EnumLabelResetResultResponseDto, result);
  }

  @Get('enum-labels/defaults')
  @RequireRead()
  @ApiOperation({ summary: 'Get default enum labels (no customization)' })
  @ApiQuery({ name: 'type', required: false })
  @ApiOkResponse({ type: EnumLabelMapResponseDto })
  async getDefaults(@Query('type') enumType?: string): Promise<EnumLabelMapResponseDto> {
    const result = this.adminService.getDefaults(enumType);
    return toEnumLabelDefaultsMapResponseDto(result as Record<string, Record<string, unknown>>);
  }
}
