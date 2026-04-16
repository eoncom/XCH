import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRead } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Global search across assets, sites, racks, tasks, contacts' })
  search(
    @Query('q') q: string,
    @Query('limit') limit: string | undefined,
    @Request() req: AuthRequest,
  ) {
    const lim = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50);
    return this.service.search(req.user.tenantId, q || '', lim);
  }
}
