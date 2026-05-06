import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { IntegrationMappingService } from './integration-mapping.service';
import { AuthRequest } from '../../../types/request.interface';
import { RequireRead, RequireWrite } from '../../../common/decorators/require-right.decorator';
import {
  IntegrationMappingDeleteResultResponseDto,
  IntegrationMappingItemResponseDto,
  IntegrationMappingSaveResultResponseDto,
} from '../dto/integration-passthrough.response.dto';

@ApiTags('integration-mapping')
@ApiBearerAuth()
@Controller('integrations/mapping')
export class IntegrationMappingController {
  constructor(private readonly mappingService: IntegrationMappingService) {}

  @Get(':provider/:entityType')
  @RequireRead()
  @ApiOperation({ summary: 'Get mappings for a provider and entity type' })
  @ApiOkResponse({ type: IntegrationMappingItemResponseDto, isArray: true })
  getMappings(
    @Request() req: AuthRequest,
    @Param('provider') provider: string,
    @Param('entityType') entityType: string,
  ) {
    return this.mappingService.getMappings(req.user.tenantId, provider, entityType);
  }

  @Post(':provider/:entityType')
  @RequireWrite()
  @ApiOperation({ summary: 'Save mappings for a provider and entity type' })
  @ApiOkResponse({ type: IntegrationMappingSaveResultResponseDto })
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
  @RequireWrite()
  @ApiOperation({ summary: 'Delete all mappings for a provider and entity type' })
  @ApiOkResponse({ type: IntegrationMappingDeleteResultResponseDto })
  deleteMappings(
    @Request() req: AuthRequest,
    @Param('provider') provider: string,
    @Param('entityType') entityType: string,
  ) {
    return this.mappingService.deleteMappings(req.user.tenantId, provider, entityType);
  }

  @Delete('single/:id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete a single mapping' })
  @ApiOkResponse({ type: IntegrationMappingDeleteResultResponseDto })
  deleteMapping(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.mappingService.deleteMapping(req.user.tenantId, id);
  }
}
