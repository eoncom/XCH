import {
  Controller,
  Post,
  Body,
  Query,
  Headers,
  HttpCode,
  Logger,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MonitoringWebhookService } from '../services/monitoring-webhook.service';
import { Public } from '../../../common/decorators/public.decorator';
import { SkipDelegation } from '../../../common/decorators/skip-delegation.decorator';

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
 *       Security is handled via the webhook secret (validated inside the service).
 *       @Public() bypasses JwtAuthGuard; @SkipDelegation() bypasses DelegationGuard/PermissionGuard.
 */
@ApiTags('monitoring-webhook')
@Public()
@SkipDelegation()
@Controller('integrations/monitoring')
export class MonitoringWebhookController {
  private readonly logger = new Logger(MonitoringWebhookController.name);

  constructor(private readonly webhookService: MonitoringWebhookService) {}

  @Post('webhook')
  @HttpCode(200)
  // Rate-limit per source IP : 30 webhooks/min suffit pour Kuma/Gatus
  // (intervalles standards 60-300s) et bloque le spam d'un secret dérobé.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
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
      // Re-throw les erreurs d'authentification ou de validation pour que
      // le client reçoive le bon code HTTP. Sinon un x-webhook-secret
      // invalide retournerait 200 (rotation du secret 2026-04-26 a révélé
      // le bug). On garde le status:error 200 uniquement pour les erreurs
      // métier non-critiques (parser ne reconnaît pas le payload, etc.).
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook processing failed: ${errorMessage}`);

      // Erreur 5xx interne : on retourne 200 pour éviter que Kuma/Gatus
      // boucle en retry (ils ne savent rien réparer côté XCH), mais on
      // expose l'erreur dans le body pour le debugging.
      return {
        status: 'error',
        provider: normalizedProvider,
        message: errorMessage,
      };
    }
  }
}
