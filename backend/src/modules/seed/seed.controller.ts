import { Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { AuthRequest } from '../../types/request.interface';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { RequireManage } from '../../common/decorators/require-right.decorator';
import { TestEnvOnlyGuard } from '../../common/guards/test-env-only.guard';

type ResetDomain = 'sites' | 'assets' | 'racks' | 'expenses' | 'monitors' | 'notifications';

const RESET_DOMAINS: readonly ResetDomain[] = [
  'sites',
  'assets',
  'racks',
  'expenses',
  'monitors',
  'notifications',
] as const;

@ApiTags('seed')
@ApiBearerAuth()
@Controller('seed')
@SkipDelegation()
@RequireManage()
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('demo')
  @ApiOperation({
    summary: '[ADMIN ONLY] Load demo data',
    description: 'Loads comprehensive demo data (sites, assets, racks, tasks). Idempotent - can be run multiple times safely.',
  })
  async loadDemo(@Request() req: AuthRequest) {
    return this.seedService.loadDemo(req.user.tenantId);
  }

  @Post('reset')
  @ApiOperation({
    summary: '[ADMIN ONLY] Reset all data',
    description: 'Deletes all data EXCEPT admin user and tenant. Use with caution!',
  })
  async reset(@Request() req: AuthRequest) {
    return this.seedService.resetData(req.user.tenantId, req.user.id);
  }

  /**
   * S7 PR0 — Reset scoped par domaine, réservé aux environnements de test.
   * TestEnvOnlyGuard refuse l'appel si NODE_ENV === 'production'. Les specs
   * E2E des PR1-PR4 utilisent ces endpoints en `beforeEach` pour isoler
   * leur domaine (CRUD destructif) sans subir le coût d'un reset global.
   */
  @Post('reset/:domain')
  @UseGuards(TestEnvOnlyGuard)
  @ApiOperation({
    summary: '[TEST ONLY] Reset a single domain (DELETE-only)',
    description:
      'Domains: assets, racks, expenses, monitors, notifications. Domain "sites" non supporté — utiliser /api/seed/reset (global) puis /api/seed/demo. Refusé si NODE_ENV=production.',
  })
  async resetDomain(@Request() req: AuthRequest, @Param('domain') domain: string) {
    if (!RESET_DOMAINS.includes(domain as ResetDomain)) {
      throw new Error(
        `Unknown reset domain "${domain}". Supported: ${RESET_DOMAINS.join(', ')}.`,
      );
    }
    return this.seedService.resetDomain(req.user.tenantId, domain as ResetDomain);
  }
}
