import {
  Controller,
  Post,
  Body,
  Query,
  Headers,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MonitoringWebhookService } from '../services/monitoring-webhook.service';

/**
 * Generic webhook endpoint for monitoring providers (Uptime Kuma, Gatus, etc.).
 *
 * Usage:
 *   Kuma:  POST /api/integrations/monitoring/webhook?provider=kuma
 *   Gatus: POST /api/integrations/monitoring/webhook?provider=gatus
 *
 * The provider query param selects the payload normalizer.
 * Authentication is via x-webhook-secret header (shared secret).
 *
 * NOTE: This endpoint is NOT protected by JWT/RBAC guards —
 *       it's called by external monitoring systems.
 *       Security is handled via the webhook secret.
 */
@ApiTags('monitoring-webhook')
@Controller('integrations/monitoring')
export class MonitoringWebhookController {
  private readonly logger = new Logger(MonitoringWebhookController.name);

  constructor(private readonly webhookService: MonitoringWebhookService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive webhook from monitoring provider (Kuma/Gatus)' })
  async handleWebhook(
    @Query('provider') provider: string,
    @Headers() headers: Record<string, string>,
    @Body() payload: any,
  ) {
    if (!provider) {
      throw new BadRequestException('Missing ?provider= query parameter (kuma or gatus)');
    }

    const normalizedProvider = provider.toLowerCase();
    if (!['kuma', 'gatus'].includes(normalizedProvider)) {
      throw new BadRequestException(`Unknown provider: ${provider}. Use "kuma" or "gatus".`);
    }

    this.logger.log(`Received webhook from provider=${normalizedProvider}`);

    try {
      await this.webhookService.processWebhook(normalizedProvider, headers, payload);
      return { status: 'ok', provider: normalizedProvider };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook processing failed: ${errorMessage}`);

      // Return 200 to avoid retries from the monitoring tool,
      // but include error info for debugging
      return {
        status: 'error',
        provider: normalizedProvider,
        message: errorMessage,
      };
    }
  }
}
