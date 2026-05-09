import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireManage } from '../../common/decorators/require-right.decorator';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { AuthRequest } from '../../types/request.interface';
import { JOB_THROW, TEST_ERROR_QUEUE } from './test-error.processor';

/**
 * Endpoints `/api/_test-error/*` — synthèses d'erreurs pour valider la
 * chaîne observabilité GlitchTip (item 6 / critère acceptance v2.1.0).
 *
 * Gating :
 *   1. `ENABLE_TEST_ERROR_ENDPOINTS=true` — env flag explicite, désactivé
 *      par défaut. **Hors-prod ET prod** doivent set ce flag pour autoriser
 *      le test (xch-deploy = prod, donc on ne peut PAS gater sur NODE_ENV
 *      seul). En vraie prod entreprise multi-tenant, garder à `false`.
 *   2. `req.user.isSuperAdmin` — RBAC fail-closed. Sans flag ET sans
 *      super-admin, n'importe quel user authentifié pourrait spammer la
 *      UI GlitchTip avec des events bidons.
 *
 * Quand le flag est OFF : endpoints retournent 404 Not Found (mimique
 * d'une route absente, pas d'info-leak sur l'existence du endpoint).
 */
@ApiTags('test-error')
@Controller('_test-error')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TestErrorController {
  private readonly logger = new Logger(TestErrorController.name);

  constructor(
    @InjectQueue(TEST_ERROR_QUEUE) private readonly testErrorQueue: Queue,
  ) {}

  /**
   * `GET /api/_test-error/backend` — lève une erreur unhandled qui
   * traverse `AllExceptionsFilter` (branche `else`) et atterrit dans
   * GlitchTip projet `xch-backend` avec tag `mode=api`.
   *
   * Réponse : 500 Internal Server Error (mais c'est attendu — le but est
   * exactement de provoquer un unhandled).
   */
  @Get('backend')
  @SkipDelegation()
  @RequireManage()
  @ApiOperation({ summary: 'Synthèse erreur unhandled backend (super-admin + flag)' })
  @ApiOkResponse({ description: 'Ne retourne JAMAIS 200 — toujours 500 ou 403/404 selon gating' })
  triggerBackend(@Request() req: AuthRequest): never {
    this.assertEnabled();
    this.assertSuperAdmin(req);

    const triggeredBy = req.user.id;
    this.logger.warn(`Triggering synthetic backend error (user=${triggeredBy}, ts=${Date.now()})`);
    // L'erreur DOIT être unhandled pour atteindre la branche `else` du
    // AllExceptionsFilter (HttpException seraient skipped côté Sentry).
    throw new Error(
      `XCH_TEST_ERROR_BACKEND: synthetic unhandled exception (triggered by user=${triggeredBy})`,
    );
  }

  /**
   * `POST /api/_test-error/worker` — enqueue un job `throw` sur la queue
   * `test-error`. Le worker (mode `--worker`) consommera et lèvera, ce
   * qui passera par `WorkerEventLogger.jobFailed` → GlitchTip projet
   * `xch-backend` avec tag `mode=worker, queue=test-error, jobName=throw`.
   *
   * Réponse : 202 Accepted + jobId. Le job se déclenche async côté worker.
   */
  @Post('worker')
  @SkipDelegation()
  @RequireManage()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enqueue un test-error job (super-admin + flag)' })
  async triggerWorker(@Request() req: AuthRequest): Promise<{ status: string; jobId: string }> {
    this.assertEnabled();
    this.assertSuperAdmin(req);

    const job = await this.testErrorQueue.add(
      JOB_THROW,
      {
        message: `synthetic worker failure (triggered by user=${req.user.id})`,
        code: 'XCH_TEST_ERROR_WORKER',
      },
      { attempts: 1, removeOnComplete: true, removeOnFail: true },
    );

    this.logger.warn(`Enqueued synthetic worker error (jobId=${job.id}, user=${req.user.id})`);
    return { status: 'enqueued', jobId: String(job.id) };
  }

  // ── Gating helpers ───────────────────────────────────────────────────

  private assertEnabled(): void {
    if (process.env.ENABLE_TEST_ERROR_ENDPOINTS !== 'true') {
      // 404 plutôt que 403 : ne pas leaker l'existence du endpoint à un
      // attaquant. Pour un super-admin légitime qui s'attendait à le
      // trouver, le message d'erreur explique exactement le flag.
      throw new NotFoundException('Endpoint indisponible (ENABLE_TEST_ERROR_ENDPOINTS=false)');
    }
  }

  private assertSuperAdmin(req: AuthRequest): void {
    if (!req.user.isSuperAdmin) {
      throw new ForbiddenException('Réservé aux super administrateurs');
    }
  }
}
