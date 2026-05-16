import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { SetupService } from './setup.service';
import { SetupDto } from './dto/setup.dto';
import {
  SetupStatusResponseDto,
  SetupInitializeResponseDto,
  SetupSecretsResponseDto,
} from './dto/setup.response.dto';
import { toResponse } from '../../common/utils/to-response.util';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Setup controller — public endpoints (no auth required).
 * Only accessible when no tenant exists (first launch).
 */
@ApiTags('setup')
@Public()
/**
 * @SkipDelegation — Catégorie 2 (pre-delegation flows) :
 * wizard installation initiale, accessible avant tout user / délégation.
 * Cf. ADR-028.
 */
@SkipDelegation()
@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check if initial setup is needed' })
  @ApiOkResponse({ type: SetupStatusResponseDto, description: 'Setup status with service health checks' })
  async getStatus(): Promise<SetupStatusResponseDto> {
    const result = await this.setupService.getStatus();
    return toResponse(SetupStatusResponseDto, result);
  }

  @Post('initialize')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize the application (first launch only)' })
  @ApiCreatedResponse({ type: SetupInitializeResponseDto, description: 'Application initialized successfully' })
  async initialize(@Body() dto: SetupDto): Promise<SetupInitializeResponseDto> {
    // Double-check that setup is needed
    const status = await this.setupService.getStatus();
    if (!status.needsSetup) {
      throw new ForbiddenException('Application is already configured. Setup cannot be run again.');
    }
    const result = await this.setupService.initialize(dto);
    return toResponse(SetupInitializeResponseDto, result);
  }

  @Get('generate-secrets')
  @ApiOperation({ summary: 'Generate random secrets for .env configuration' })
  @ApiOkResponse({ type: SetupSecretsResponseDto, description: 'Plaintext secrets — copy to .env then never call again' })
  async generateSecrets(): Promise<SetupSecretsResponseDto> {
    // Only allow if setup is needed
    const status = await this.setupService.getStatus();
    if (!status.needsSetup) {
      throw new ForbiddenException('Application is already configured.');
    }
    const result = await this.setupService.generateSecrets();
    return toResponse(SetupSecretsResponseDto, result);
  }
}
