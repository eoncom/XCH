import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { FilterExpenseDto } from './dto/filter-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';
import { Response } from 'express';

@ApiTags('expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create an expense with optional allocations' })
  create(@Body() dto: CreateExpenseDto, @Request() req: AuthRequest) {
    return this.expensesService.create(req.user.tenantId, dto, req.user.userId);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'List all expenses' })
  findAll(
    @Query() filters: FilterExpenseDto,
    @Request() req: AuthRequest,
  ) {
    return this.expensesService.findAll(req.user.tenantId, filters);
  }

  @Get('reports/by-bearer')
  @RequireRead()
  @ApiOperation({ summary: 'Report: total by bearer' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  reportByBearer(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
  ) {
    return this.expensesService.reportByBearer(req.user.tenantId, { dateFrom, dateTo });
  }

  @Get('reports/by-month')
  @RequireRead()
  @ApiOperation({ summary: 'Report: monthly spending evolution (feeds dashboard chart)' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'delegationId', required: false })
  @ApiQuery({ name: 'expenseType', required: false })
  reportByMonth(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('delegationId') delegationId: string | undefined,
    @Query('expenseType') expenseType: string | undefined,
    @Request() req: AuthRequest,
  ) {
    return this.expensesService.reportByMonth(req.user.tenantId, {
      dateFrom,
      dateTo,
      delegationId,
      expenseType,
    });
  }

  @Get('reports/by-target')
  @RequireRead()
  @ApiOperation({ summary: 'Report: total by target' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  reportByTarget(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
  ) {
    return this.expensesService.reportByTarget(req.user.tenantId, { dateFrom, dateTo });
  }

  @Get('reports/chargeback')
  @RequireRead()
  @ApiOperation({ summary: 'Report: chargeback detail' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  reportChargeback(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: AuthRequest,
  ) {
    return this.expensesService.reportChargeback(req.user.tenantId, { dateFrom, dateTo });
  }

  @Get('projection')
  @RequireRead()
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
  @RequireRead()
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
  @RequireRead()
  @ApiOperation({ summary: 'Get an expense with allocations' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.expensesService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update an expense' })
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @Request() req: AuthRequest) {
    return this.expensesService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete an expense' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.expensesService.remove(req.user.tenantId, id);
  }
}
