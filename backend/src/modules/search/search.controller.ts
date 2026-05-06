import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';
import { SearchResponseDto, toSearchResponseDto } from './dto/search.response.dto';
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
  // 5 requêtes parallèles findMany à chaque appel — limite à 30/min/user
  // pour éviter qu'un client trop bavard tape la DB en boucle.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Global search across assets, sites, racks, tasks, contacts' })
  @ApiOkResponse({ type: SearchResponseDto, description: 'Hits[] + per-type counts (Cas B — Record manually mapped)' })
  async search(
    @Query('q') q: string,
    @Query('limit') limit: string | undefined,
    @Request() req: AuthRequest,
  ): Promise<SearchResponseDto> {
    const lim = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50);
    const result = await this.service.search(req.user.tenantId, q || '', lim);
    return toSearchResponseDto(result);
  }
}
