import { Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import {
  SeedDemoResponseDto,
  SeedResetResponseDto,
  SeedResetDomainResponseDto,
} from './dto/seed.response.dto';
import { toResponse } from '../../common/utils/to-response.util';
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
/**
 * @SkipDelegation — Catégorie 5 (dev/test only) :
 * dev seed data, gated par env flag (NODE_ENV !== 'production').
 * Cf. ADR-028.
 */
@SkipDelegation()
@RequireManage()
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('demo')
  @ApiOperation({
    summary: '[ADMIN ONLY] Load demo data',
    description: 'Loads comprehensive demo data (sites, assets, racks, tasks). Idempotent - can be run multiple times safely.',
  })
  @ApiOkResponse({ type: SeedDemoResponseDto, description: 'Per-entity counts of seeded rows' })
  async loadDemo(@Request() req: AuthRequest): Promise<SeedDemoResponseDto> {
    const result = await this.seedService.loadDemo(req.user.tenantId);
    return toResponse(SeedDemoResponseDto, result);
  }

  @Post('reset')
  @ApiOperation({
    summary: '[ADMIN ONLY] Reset all data',
    description: 'Deletes all data EXCEPT admin user and tenant. Use with caution!',
  })
  @ApiOkResponse({ type: SeedResetResponseDto })
  async reset(@Request() req: AuthRequest): Promise<SeedResetResponseDto> {
    const result = await this.seedService.resetData(req.user.tenantId, req.user.id);
    return toResponse(SeedResetResponseDto, result);
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
  @ApiOkResponse({ type: SeedResetDomainResponseDto })
  async resetDomain(@Request() req: AuthRequest, @Param('domain') domain: string): Promise<SeedResetDomainResponseDto> {
    if (!RESET_DOMAINS.includes(domain as ResetDomain)) {
      throw new Error(
        `Unknown reset domain "${domain}". Supported: ${RESET_DOMAINS.join(', ')}.`,
      );
    }
    const result = await this.seedService.resetDomain(req.user.tenantId, domain as ResetDomain);
    return toResponse(SeedResetDomainResponseDto, result);
  }
}
