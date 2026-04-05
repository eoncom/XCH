import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('seed')
@ApiBearerAuth()
@Controller('seed')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('demo')
  @Resource('tenants')
  @Action('delete')
  @ApiOperation({
    summary: '[ADMIN ONLY] Load demo data',
    description: 'Loads comprehensive demo data (sites, assets, racks, tasks). Idempotent - can be run multiple times safely.',
  })
  async loadDemo(@Request() req: AuthRequest) {
    return this.seedService.loadDemo(req.user.tenantId);
  }

  @Post('reset')
  @Resource('tenants')
  @Action('delete')
  @ApiOperation({
    summary: '[ADMIN ONLY] Reset all data',
    description: 'Deletes all data EXCEPT admin user and tenant. Use with caution!',
  })
  async reset(@Request() req: AuthRequest) {
    return this.seedService.resetData(req.user.tenantId, req.user.id);
  }
}
