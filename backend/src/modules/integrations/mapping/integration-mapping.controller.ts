import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationMappingService } from './integration-mapping.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../../common/guards/casbin.guard';
import { Resource, Action } from '../../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../../types/request.interface';

@ApiTags('integration-mapping')
@ApiBearerAuth()
@Controller('integrations/mapping')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class IntegrationMappingController {
  constructor(private readonly mappingService: IntegrationMappingService) {}

  @Get(':provider/:entityType')
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: 'Get mappings for a provider and entity type' })
  getMappings(
    @Request() req: AuthRequest,
    @Param('provider') provider: string,
    @Param('entityType') entityType: string,
  ) {
    return this.mappingService.getMappings(req.user.tenantId, provider, entityType);
  }

  @Post(':provider/:entityType')
  @Resource('integrations')
  @Action('update')
  @ApiOperation({ summary: 'Save mappings for a provider and entity type' })
  saveMappings(
    @Request() req: AuthRequest,
    @Param('provider') provider: string,
    @Param('entityType') entityType: string,
    @Body()
    body: {
      mappings: Array<{
        externalId: string;
        externalLabel: string;
        targetType: string;
        targetId: string;
      }>;
    },
  ) {
    return this.mappingService.saveMappings(
      req.user.tenantId,
      provider,
      entityType,
      body.mappings,
    );
  }

  @Delete(':provider/:entityType')
  @Resource('integrations')
  @Action('delete')
  @ApiOperation({ summary: 'Delete all mappings for a provider and entity type' })
  deleteMappings(
    @Request() req: AuthRequest,
    @Param('provider') provider: string,
    @Param('entityType') entityType: string,
  ) {
    return this.mappingService.deleteMappings(req.user.tenantId, provider, entityType);
  }

  @Delete('single/:id')
  @Resource('integrations')
  @Action('delete')
  @ApiOperation({ summary: 'Delete a single mapping' })
  deleteMapping(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.mappingService.deleteMapping(req.user.tenantId, id);
  }
}
