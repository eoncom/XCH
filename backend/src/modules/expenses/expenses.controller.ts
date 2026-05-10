import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, Res, ForbiddenException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { FilterExpenseDto } from './dto/filter-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireManage } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { Response } from 'express';
import { PermissionService } from '../../common/services/permission.service';
import { ExpenseResponseDto } from './dto/expense.response.dto';
import { ExpenseListResponseDto } from './dto/expense-list.response.dto';
import {
  ExpenseProjectionResponseDto,
  ExpenseReportByBearerResponseDto,
  ExpenseReportByMonthResponseDto,
  ExpenseReportByTargetResponseDto,
  ExpenseReportChargebackResponseDto,
} from './dto/expense-report.response.dto';
import { ExpenseDeletedResultResponseDto } from './dto/expense-action-result.response.dto';
import { ExpensesSummaryResponseDto } from './dto/expenses-summary.response.dto';

@ApiTags('expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly permissionService: PermissionService,
  ) {}

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
  @ApiCreatedResponse({ type: ExpenseResponseDto })
  async create(@Body() dto: CreateExpenseDto, @Request() req: AuthRequest) {
    const scope = await this.scopeOrFail(req, dto.delegationId);
    return this.expensesService.create(req.user.tenantId, dto, req.user.userId, scope);
  }

  @Get()
  @RequireManage()
  @ApiOperation({ summary: 'List all expenses (scoped to managed delegations for non super-admins)' })
  @ApiOkResponse({ type: ExpenseListResponseDto })
  async findAll(
    @Query() filters: FilterExpenseDto,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.scopeOrFail(req, filters.delegationId);
    return this.expensesService.findAll(req.user.tenantId, filters, scope);
  }

  @Get('summary')
  @RequireManage()
  @ApiOperation({
    summary:
      'Aggregate counterpart to GET /expenses (sum + count + byType over the full filtered set, no pagination slice). Feeds the costs page summary cards.',
  })
  @ApiOkResponse({ type: ExpensesSummaryResponseDto })
  async summary(
    @Query() filters: FilterExpenseDto,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.scopeOrFail(req, filters.delegationId);
    return this.expensesService.summary(req.user.tenantId, filters, scope);
  }

  @Get('reports/by-bearer')
  @RequireManage()
  @ApiOperation({ summary: 'Report: total by bearer' })
  @ApiOkResponse({ type: ExpenseReportByBearerResponseDto })
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
  @ApiOkResponse({ type: ExpenseReportByMonthResponseDto })
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
  @ApiOkResponse({ type: ExpenseReportByTargetResponseDto })
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
  @ApiOkResponse({ type: ExpenseReportChargebackResponseDto })
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Project expenses over a date range (monthly breakdown)' })
  @ApiOkResponse({ type: ExpenseProjectionResponseDto })
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
  @ApiOkResponse({ description: 'Binary CSV stream (text/csv with BOM)' })
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

    const headers = ['Label', 'Type', 'Montant', 'Devise', 'Fréquence', 'Date', 'Porteur', 'Vendor', 'Facture', 'PO', 'Cibles (%)'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (expenses as any[]).map((e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targets = (e.allocations || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    res.send('﻿' + csv);
  }

  @Get(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Get an expense with allocations' })
  @ApiOkResponse({ type: ExpenseResponseDto })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const expense = await this.expensesService.findOne(req.user.tenantId, id, ctx);
    await this.scopeOrFail(req, (expense as { delegationId?: string }).delegationId);
    return expense;
  }

  @Patch(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Update an expense' })
  @ApiOkResponse({ type: ExpenseResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const existing = await this.expensesService.findOne(req.user.tenantId, id, ctx);
    const scope = await this.scopeOrFail(req, (existing as { delegationId?: string }).delegationId);
    if (dto.delegationId) await this.scopeOrFail(req, dto.delegationId);
    return this.expensesService.update(req.user.tenantId, id, dto, scope, ctx);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete an expense' })
  @ApiOkResponse({ type: ExpenseDeletedResultResponseDto })
  async remove(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const existing = await this.expensesService.findOne(req.user.tenantId, id, ctx);
    await this.scopeOrFail(req, (existing as { delegationId?: string }).delegationId);
    return this.expensesService.remove(req.user.tenantId, id, ctx);
  }
}
