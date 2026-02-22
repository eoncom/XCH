import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SetupService } from './setup.service';
import { SetupDto } from './dto/setup.dto';

/**
 * Setup controller — public endpoints (no auth required).
 * Only accessible when no tenant exists (first launch).
 */
@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check if initial setup is needed' })
  @ApiResponse({ status: 200, description: 'Setup status with service health checks' })
  async getStatus() {
    return this.setupService.getStatus();
  }

  @Post('initialize')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize the application (first launch only)' })
  @ApiResponse({ status: 201, description: 'Application initialized successfully' })
  @ApiResponse({ status: 409, description: 'Application already configured' })
  async initialize(@Body() dto: SetupDto) {
    // Double-check that setup is needed
    const status = await this.setupService.getStatus();
    if (!status.needsSetup) {
      throw new ForbiddenException('Application is already configured. Setup cannot be run again.');
    }
    return this.setupService.initialize(dto);
  }

  @Get('generate-secrets')
  @ApiOperation({ summary: 'Generate random secrets for .env configuration' })
  @ApiResponse({ status: 200, description: 'Generated secrets' })
  async generateSecrets() {
    // Only allow if setup is needed
    const status = await this.setupService.getStatus();
    if (!status.needsSetup) {
      throw new ForbiddenException('Application is already configured.');
    }
    return this.setupService.generateSecrets();
  }
}
