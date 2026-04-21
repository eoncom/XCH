import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto, UpdateBudgetDto, FilterBudgetDto } from './dto/create-budget.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireManage } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';
import { PermissionService } from '../../common/services/permission.service';

@ApiTags('budgets')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BudgetsController {
  constructor(
    private readonly service: BudgetsService,
    private readonly permissionService: PermissionService,
  ) {}

  private async scopeOrFail(req: AuthRequest, filterDelegationId?: string | null): Promise<string[] | null> {
    const scope = await this.permissionService.getManagedDelegationIds(
      req.user.tenantId,
      req.user.userId,
    );
    if (scope === null) return null;
    if (scope.length === 0) {
      throw new ForbiddenException('Aucune délégation managée — accès refusé.');
    }
    if (filterDelegationId && !scope.includes(filterDelegationId)) {
      throw new ForbiddenException('Délégation hors périmètre managé.');
    }
    return scope;
  }

  @Post()
  @RequireManage()
  @ApiOperation({ summary: 'Create a budget' })
  async create(@Body() dto: CreateBudgetDto, @Request() req: AuthRequest) {
    const scope = await this.scopeOrFail(req, dto.delegationId ?? undefined);
    // Non super-admins can't create a "global" budget (delegationId=null).
    // Otherwise a manager could create a budget they're then unable to see
    // back, because the read scope only exposes their managed delegations.
    if (scope !== null && !dto.delegationId) {
      throw new ForbiddenException(
        'Un budget global (sans délégation) est réservé aux super administrateurs. Sélectionnez une délégation.',
      );
    }
    return this.service.create(req.user.tenantId, dto);
  }

  @Get()
  @RequireManage()
  @ApiOperation({ summary: 'List budgets (scoped to managed delegations)' })
  async findAll(@Query() filters: FilterBudgetDto, @Request() req: AuthRequest) {
    const scope = await this.scopeOrFail(req, filters.delegationId);
    return this.service.findAll(req.user.tenantId, filters, scope);
  }

  @Get(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Get a budget' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    const budget = await this.service.findOne(req.user.tenantId, id);
    await this.scopeOrFail(req, (budget as any).delegationId ?? undefined);
    return budget;
  }

  @Get(':id/status')
  @RequireManage()
  @ApiOperation({ summary: 'Get budget status (spent vs budgeted + matching expenses)' })
  async getStatus(@Param('id') id: string, @Request() req: AuthRequest) {
    const budget = await this.service.findOne(req.user.tenantId, id);
    await this.scopeOrFail(req, (budget as any).delegationId ?? undefined);
    return this.service.getStatus(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Update a budget' })
  async update(@Param('id') id: string, @Body() dto: UpdateBudgetDto, @Request() req: AuthRequest) {
    const existing = await this.service.findOne(req.user.tenantId, id);
    const scope = await this.scopeOrFail(req, (existing as any).delegationId ?? undefined);
    if (dto.delegationId) await this.scopeOrFail(req, dto.delegationId);
    // Prevent a manager from "downgrading" an existing budget to global.
    if (scope !== null && 'delegationId' in dto && !dto.delegationId) {
      throw new ForbiddenException(
        'Un budget global (sans délégation) est réservé aux super administrateurs.',
      );
    }
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete a budget' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    const existing = await this.service.findOne(req.user.tenantId, id);
    await this.scopeOrFail(req, (existing as any).delegationId ?? undefined);
    return this.service.remove(req.user.tenantId, id);
  }
}
