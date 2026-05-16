import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService, HealthSnapshot } from './health.service';
import { Public } from '../../common/decorators/public.decorator';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';

/**
 * @SkipDelegation — Catégorie 1 (tenant-wide super-admin operations) per ADR-028 :
 * sonde liveness/readiness à la maille infrastructure (DB/Redis/MinIO), pas une
 * délégation spécifique. Public (pas d'auth) pour Kubernetes probes + smoke-prod.
 */
@ApiTags('health')
@Public()
@SkipDelegation()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness/readiness probe — aggregate DB+Redis+MinIO status' })
  @ApiOkResponse({ description: 'All dependencies reachable' })
  @ApiServiceUnavailableResponse({ description: 'One or more dependencies down (degraded)' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthSnapshot> {
    const snapshot = await this.health.checkAll();
    if (snapshot.status === 'degraded') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return snapshot;
  }
}
