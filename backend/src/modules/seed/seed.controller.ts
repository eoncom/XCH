import { Controller, Post, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { AuthRequest } from '../../types/request.interface';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { RequireManage } from '../../common/decorators/require-right.decorator';

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
}
