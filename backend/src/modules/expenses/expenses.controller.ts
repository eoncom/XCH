import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, Res, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { FilterExpenseDto } from './dto/filter-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireManage } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';
import { Response } from 'express';
import { PermissionService } from '../../common/services/permission.service';

@ApiTags('expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * Resolve the delegation IDs the current user is allowed to see cost data
   * for. null = super-admin (no restriction). Empty array = blocked — means
   * the user lost MANAGE between the guard check and the query. Callers
   * should also reject filters pointing outside this list.
   */
  private async scopeOrFail(req: AuthRequest, filterDelegationId?: string): Promise<string[] | null> {
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
  @ApiOperation({ summary: 'Create an expense with optional allocations' })
  async create(@Body() dto: CreateExpenseDto, @Request() req: AuthRequest) {
    // Guard against cross-delegation writes: ensure the expense's delegationId
    // is in the user's managed scope (super-admin bypasses). Threads the
    // scope to the service so allocation targets are also scope-checked (D2).
    const scope = await this.scopeOrFail(req, dto.delegationId);
    return this.expensesService.create(req.user.tenantId, dto, req.user.userId, scope);
  }

  @Get()
  @RequireManage()
  @ApiOperation({ summary: 'List all expenses (scoped to managed delegations for non super-admins)' })
  async findAll(
    @Query() filters: FilterExpenseDto,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.scopeOrFail(req, filters.delegationId);
    return this.expensesService.findAll(req.user.tenantId, filters, scope);
  }

  @Get('reports/by-bearer')
  @RequireManage()
  @ApiOperation({ summary: 'Report: total by bearer' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async reportByBearer(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.scopeOrFail(req);
    return this.expensesService.reportByBearer(req.user.tenantId, { dateFrom, dateTo }, scope);
  }

  @Get('reports/by-month')
  @RequireManage()
  @ApiOperation({ summary: 'Report: monthly spending evolution (feeds dashboard chart)' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'delegationId', required: false })
  @ApiQuery({ name: 'expenseType', required: false })
  async reportByMonth(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('delegationId') delegationId: string | undefined,
    @Query('expenseType') expenseType: string | undefined,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.scopeOrFail(req, delegationId);
    return this.expensesService.reportByMonth(
      req.user.tenantId,
      { dateFrom, dateTo, delegationId, expenseType },
      scope,
    );
  }

  @Get('reports/by-target')
  @RequireManage()
  @ApiOperation({ summary: 'Report: total by target' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async reportByTarget(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.scopeOrFail(req);
    return this.expensesService.reportByTarget(req.user.tenantId, { dateFrom, dateTo }, scope);
  }

  @Get('reports/chargeback')
  @RequireManage()
  @ApiOperation({ summary: 'Report: chargeback detail' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async reportChargeback(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.scopeOrFail(req);
    return this.expensesService.reportChargeback(req.user.tenantId, { dateFrom, dateTo }, scope);
  }

  @Get('projection')
  @RequireManage()
  @ApiOperation({ summary: 'Project expenses over a date range (monthly breakdown)' })
  @ApiQuery({ name: 'from', required: true, description: 'Start month YYYY-MM' })
  @ApiQuery({ name: 'to', required: true, description: 'End month YYYY-MM' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['type', 'delegation', 'site'] })
  projection(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('groupBy') groupBy: 'type' | 'delegation' | 'site',
    @Request() req: AuthRequest,
  ) {
    return this.expensesService.projection(req.user.tenantId, from, to, groupBy);
  }

  @Get('export')
  @RequireManage()
  @ApiOperation({ summary: 'Export expenses to Excel' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async exportExcel(
    @Query('type') type: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
    @Res() res: Response,
  ) {
    const result = await this.expensesService.findAll(req.user.tenantId, { type, dateFrom, dateTo, page: 1, pageSize: 100 } as FilterExpenseDto);
    const expenses = result.data;

    // Build CSV export (simple, no external dependency needed)
    const headers = ['Label', 'Type', 'Montant', 'Devise', 'Fréquence', 'Date', 'Porteur', 'Vendor', 'Facture', 'PO', 'Cibles (%)'];
    const rows = expenses.map((e: any) => {
      const targets = (e.allocations || [])
        .map((a: any) => `${a.target?.name || a.targetId} (${a.percentage}%)`)
        .join('; ');
      return [
        e.label,
        e.type,
        e.totalAmount,
        e.currency,
        e.frequency,
        new Date(e.dateIncurred).toISOString().split('T')[0],
        e.bearer?.name || e.bearerId,
        e.vendor || '',
        e.invoiceRef || '',
        e.poNumber || '',
        targets,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=expenses-export.csv');
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  }

  @Get(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Get an expense with allocations' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    const expense = await this.expensesService.findOne(req.user.tenantId, id);
    await this.scopeOrFail(req, (expense as any).delegationId);
    return expense;
  }

  @Patch(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Update an expense' })
  async update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @Request() req: AuthRequest) {
    const existing = await this.expensesService.findOne(req.user.tenantId, id);
    const scope = await this.scopeOrFail(req, (existing as any).delegationId);
    if (dto.delegationId) await this.scopeOrFail(req, dto.delegationId);
    return this.expensesService.update(req.user.tenantId, id, dto, scope);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete an expense' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    const existing = await this.expensesService.findOne(req.user.tenantId, id);
    await this.scopeOrFail(req, (existing as any).delegationId);
    return this.expensesService.remove(req.user.tenantId, id);
  }
}
